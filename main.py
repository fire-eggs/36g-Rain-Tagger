import argparse
from itertools import batched
from pathlib import Path
from time import perf_counter
import os
from timm.data import create_transform, resolve_data_config

from db import ImageDb
from processor import load_model, make_tag_data, process_images
from utils import (
    get_image_paths,
    get_sha256,
    get_torch_device,
    get_valid_extensions,
    make_path,
    printr,
    get_image_file_count,
)


def main(
        path: str|list[str]=None,
        gmin: int=0.2,
        cmin: int=0.2,
        valid_extensions: str='png,jpeg,jpg,gif',
        bsize: int=1,
        nmax: int=0,
        db_name=make_path('image.db'),
        skip: bool=True,
        idx: bool=True,
        save: bool=True,
        printt: bool=False,
        cpu: bool=False,
    ):
    repo_id = 'SmilingWolf/wd-swinv2-tagger-v3' # 'SmilingWolf/wd-convnext-tagger-v3' 'SmilingWolf/wd-vit-tagger-v3'

    parser = argparse.ArgumentParser(description='Image tagging utility for extracting and saving tags from images.')
    parser.add_argument(
        '--path',
        type=Path,
        default=path,
        help=f'Path to an image file or a directory containing images. '
             f'Can also accept a list of paths. Default: {path if path else "None"}'
    )
    parser.add_argument(
        '--gmin',
        type=float,
        default=gmin,
        help=f'Minimum probability threshold for general tags. '
             f'Range: [0.0, 1.0], where 1.0 means a very strong match. Default: {gmin}'
    )
    parser.add_argument(
        '--cmin',
        type=float,
        default=cmin,
        help=f'Minimum probability threshold for character tags. '
             f'Range: [0.0, 1.0], where 1.0 means a very strong match. Default: {cmin}'
    )
    parser.add_argument(
        '--exts',
        type=str,
        default=valid_extensions,
        help=f'Comma-separated list of valid image file extensions to process. '
             f'Default: {valid_extensions}'
    )
    parser.add_argument(
        '--nmax',
        type=int,
        default=nmax,
        help='Maximum number of images to tag. Set to 0 to process all images found in the specified path. '
            f'Default: {nmax}'
    )
    parser.add_argument(
        '--bsize',
        type=int,
        default=bsize,
        help='Batch size for processing images. For faster processing, use a batch size of 1. '
            f'Default: {bsize}'
    )
    parser.add_argument(
        '--db_name',
        type=str,
        default=db_name,
        help=f'Name of the SQLite database file to save results. Default: {db_name}'
    )
    parser.add_argument(
        '--skip',
        type=bool,
        default=skip,
        help=f'Skip images that already have tags saved in the database. Use --no-skip to reprocess them. Default: {skip}',
        action=argparse.BooleanOptionalAction
    )
    parser.add_argument(
        '--idx',
        type=bool,
        default=idx,
        help=f'Enable index-to-probability mappings. Required to save results. Use --no-idx to disable. Default: {idx}',
        action=argparse.BooleanOptionalAction
    )
    parser.add_argument(
        '--save',
        type=bool,
        default=save,
        help=f'Save results to the SQLite database. Use --no-save to skip saving. Default: {save}',
        action=argparse.BooleanOptionalAction
    )
    parser.add_argument(
        '--printt',
        type=bool,
        default=printt,
        help=f'Print results. Use --no-printt to disable printing. Default: {printt}',
        action=argparse.BooleanOptionalAction
    )
    parser.add_argument(
        '--cpu',
        type=bool,
        default=cpu,
        help=f'Run on CPU instead of GPU. Use --no-cpu to use GPU. Default: {cpu}',
        action=argparse.BooleanOptionalAction
    )

    args = parser.parse_args()
    db_name = args.db_name
    nmax = args.nmax
    bsize = args.bsize
    skip_existing = args.skip
    gmin = args.gmin
    cmin = args.cmin
    valid_extensions = args.exts
    path = args.path
    idx = args.idx
    save = args.save and args.idx
    printt = args.printt
    cpu = args.cpu

    valid_extensions = get_valid_extensions(valid_extensions)
    image_paths = get_image_paths(path, valid_extensions)
    if path.is_dir():
        nfiles = get_image_file_count(str(path), valid_extensions)
        print(f'Found ({nfiles}) {valid_extensions} files in {path}')

    printr('Setting up database')
    db = ImageDb(db_name, init=True)
    tag_data = make_tag_data(make_path('tags.csv'))
    db.insert_tags(tag_data)
    printr('Setting up database, complete')
    print()

    sha256s = set()
    if skip_existing:
        sha256s = db.get_sha256s()
        printr(f'Found {len(sha256s)} images in database')
        print()

    printr('Loading model')
    torch_device = get_torch_device(cpu)
    model = load_model(repo_id).to(torch_device, non_blocking=True)
    transform = create_transform(**resolve_data_config(model.pretrained_cfg, model=model))
    printr('Loading model, complete')
    print()

    timesum = 0
    count = 0
    next_commit_count = max(1000, bsize * 20)
    next_commit_iter = max(1000, bsize * 20)
    for image_paths_i in batched(image_paths, bsize):
        count += len(image_paths_i)
        if nmax and count > nmax:
            break

        p = []
        for image_path_i in image_paths_i:
            if skip_existing and get_sha256(image_path_i) in sha256s:
                continue
            p.append(image_path_i)
        if len(p) < 1:
            continue
        image_paths_i = p

        start = perf_counter()

        try:
            info = process_images(image_paths_i, model, transform, torch_device, tag_data, gmin, cmin, by_idx=idx)
        except Exception as e:
            print(e)
            continue

        if save:
            for image_path, (ratings, characters, generals) in zip(image_paths_i, info):
                db.insert_image_tags(image_path, ratings | characters | generals)

            if count > next_commit_count:
                db.save()
                next_commit_count += next_commit_iter

        if printt:
            for image_path, (ratings, characters, generals) in zip(image_paths_i, info):
                print(f'\n{image_path=}')
                print(f'\t{ratings=}')
                print(f'\t{characters=}')
                print(f'\t{generals=}')

        timesum += perf_counter() - start

        printr(f'Images: {count}')

    if save:
        db.save_and_close()

    print()
    print(f'Total time: {timesum:.3f}s')
    print(f'Time per image: {timesum/count:.3f}s')


if __name__ == '__main__':
    path = ['/path/to/image', '/path/to/image']
    path = '/path/to/image'
    path = '/path/to/dir'
    path = '/home/dolphin/Documents/image_data_set'
    main(
        path=path,
        gmin=0.2,
        cmin=0.2,
        valid_extensions='png,jpeg,jpg,gif',
        bsize=1,
        nmax=0,
        db_name=make_path('image.db'),
        skip=False,
        idx=True,
        save=True,
        printt=False,
        cpu=False,
    )
