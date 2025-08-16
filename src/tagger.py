import os
from itertools import batched
from time import perf_counter

from configs import TaggerConfigs, configs
from db import ImageDb
from enums import Ext
from tag_data import get_tag_data
from utils import get_sha256_from_path, get_torch_device, printr


class Tagger:
    def __init__(self, configs: TaggerConfigs):
        self.configs: TaggerConfigs = configs

        self.db: ImageDb = ImageDb(self.configs.db_path, self.configs.sql_echo)

        printr('init tagging, started\n')
        self.db.init_tagging()
        printr('init tagging, completed\n')
        printr('get_tag_data, started')
        self.tag_data = get_tag_data()
        printr('get_tag_data, completed\n')

        self.torch_device = None
        self.model = None
        self.transform = None


    def load_model(self):
        # heavy imports
        from timm.data import create_transform, resolve_data_config

        from processor import load_model, process_images_from_paths

        printr('Loading model, started')
        self.torch_device = get_torch_device(self.configs.cpu)
        self.model = load_model(self.configs.tag_model_repo_id).to(self.torch_device, non_blocking=True)
        self.transform = create_transform(**resolve_data_config(self.model.pretrained_cfg, model=self.model))
        printr('Loading model, completed\n')


    def scan_and_store(self):
        print(f'Scanning and storing images for {self.configs.root_path=}')

        batch = []
        count = 0

        sql_string = '''insert or ignore into image (directory_id, filename, ext) values (?,?,?)'''

        for directory, _, filenames in os.walk(self.configs.root_path):
            for filename in filenames:
                if not filename.endswith(self.configs.valid_extensions):
                    continue

                ext: int = Ext[filename.rsplit('.', 1)[1]].value

                directory_id = self.db.get_directory_id(directory)
                batch.append((directory_id, filename, ext))
                count += 1

                if len(batch) >= self.configs.sql_insert_batch_size:
                    print(f'images: {count:,}')

                    self.db.run_query_many(sql_string, params=batch, commit=True)
                    batch.clear()

        if batch:
            self.db.run_query_many(sql_string, params=batch, commit=True)
        print(f'Scanning and storing {self.configs.root_path=}, done')


    def run_tagger(self):

        img_path = None
        image_tuple = (None, None, None)

        self.scan_and_store()

        # heavy imports
        from processor import process_images_from_paths
        self.load_model()

        untagged_image_tuples = self.db.get_untagged_images()
        print(f'Found {len(untagged_image_tuples)} non-tagged images in database for all directories')

        timesum = 0
        count = 0
        count_errors = 0
        count_completed = 0
        next_commit_count = 100
        next_commit_iter = 100

        for untagged_image_tuples_batch in batched(untagged_image_tuples, self.configs.process_n_files_together):
            count += len(untagged_image_tuples_batch)
            if self.configs.process_n_files and count > self.configs.process_n_files:
                break

            path_2_image_tuples = dict()
            for untagged_image_tuple in untagged_image_tuples_batch:

                img_path = os.path.join(untagged_image_tuple[1], untagged_image_tuple[2])
                if not os.path.isfile(img_path):
                    print(f'Expected file at: {img_path}')
                    continue

                path_2_image_tuples[img_path] = untagged_image_tuple

            if len(path_2_image_tuples) < 1:
                continue

            start = perf_counter()

            try:
                info = process_images_from_paths(
                    path_2_image_tuples.keys(),
                    self.model,
                    self.transform,
                    self.torch_device,
                    self.tag_data,
                    self.configs.min_general_tag_val,
                    self.configs.min_character_tag_val,
                    by_idx=True,
                )
                count_completed += 1
            except Exception as e:
                count_errors += 1
                print('')
                print(e)
                continue

            if self.configs.commit_tags:
                for (path, image_tuple), (ratings, characters, generals) in zip(path_2_image_tuples.items(), info):

                    sha256 = None
                    if self.configs.commit_sha256:
                        sha256 = get_sha256_from_path(path)

                    # avoid new dict copy
                    tag_id_2_prob = characters
                    tag_id_2_prob.update(generals)

                    self.db.insert_image_tags(image_tuple[0], image_tuple[2], ratings, tag_id_2_prob, sha256=sha256)

                if count > next_commit_count:
                    self.db.save()
                    next_commit_count += next_commit_iter

            timesum += perf_counter() - start
            printr(f'Completed: {count_completed}  Errors: {count_errors}  Directory: {image_tuple[1]}  Last: {img_path if img_path else 'n/a'}')
        printr(f'Completed: {count_completed}  Errors: {count_errors}  Directory: {image_tuple[1]}  Last: {img_path if img_path else 'n/a'}')
        print()

        if self.configs.commit_tags and count:
            self.db.save()

        print('Done processing images!')
        print(f'Total time: {timesum:.3f}s')
        print(f'Time per image: {timesum/max(count, 1):.3f}s')

        if self.configs.commit_tags:
            self.db.save_and_close()


if __name__ == '__main__':
    tagger = Tagger(configs)
    tagger.run_tagger()
