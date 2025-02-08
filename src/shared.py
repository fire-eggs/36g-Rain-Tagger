import os
import sys
from time import perf_counter

from PIL import Image

from configs import use_celery
from db import get_db
from processor import process_images_from_imgs

if (not use_celery) or (use_celery and 'web.celery_app' in sys.argv):
    # do not let flask_app load expensive objects when using celery
    # instead, they will be loaded when running
    # celery -A web.celery_app worker --loglevel=info --pool solo
    from single_init import model, tag_data, torch_device, transform


def get_filters() -> list[str]:
    return ['f_tag', 'f_general', 'f_sensitive', 'f_explicit', 'f_questionable']


def app_process_images_from_paths(img_path: str, page: int, per_page: int) -> dict:
    i1 = perf_counter()

    img = Image.open(img_path)
    filters = {key: 0.0 for key in get_filters()}
    rating_tags, char_tags, gen_tags = process_images_from_imgs([img], model, transform, torch_device, tag_data, 0.2, 0.2, by_idx=True)[0]
    tags = [*char_tags, *gen_tags]
    os.remove(img_path)

    i2 = perf_counter()
    f1 = i2 - i1
    results = get_db().get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) if tags else []
    f2 = perf_counter() - i2

    rating_tags = {tag_data.names[k]: v for k, v in rating_tags.items()}
    char_tags = {tag_data.names[k]: v for k, v in char_tags.items()}
    gen_tags = {tag_data.names[k]: v for k, v in gen_tags.items()}

    image_count = get_db().get_image_count()
    message = '\n'.join([
        f'Processing your image took {f1:.3f}s.',
        f'We searched the tags of {image_count:,} images in {f2:.3f}s and found {len(results):,} results.',
        '',
        f'Here are the tags for your uploaded image:',
        '',
        f'Rating: {rating_tags}',
        f'Character: {char_tags}',
        f'General: {gen_tags}',
    ])
    return {
        'message': message,
        'results': results
    }