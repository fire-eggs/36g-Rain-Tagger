import mimetypes
import os
import sys
from datetime import datetime
from functools import lru_cache
from time import perf_counter

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from celery.result import AsyncResult
from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    send_file
)
from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.security import safe_join

from db import get_db
from processor import process_images_from_imgs
from utils import get_sha256_from_bytesio, make_path

if 'web.celery_app' in sys.argv:
    # avoids loading model when running flask app with
    # gunicorn -b 127.0.0.1:8000 -w 1 --threads 1 web:flask_app
    from single_init import model, tag_data, torch_device, transform


bp = Blueprint('image_tagging_app', __name__)


def get_filters() -> list[str]:
    return ['f_tag', 'f_general', 'f_sensitive', 'f_explicit', 'f_questionable']


def clamp(val, default, min_, max_):
    if not val:
        return default
    if isinstance(val, list):
        return [max(min(v, max_), min_) for v in val]
    return max(min(val, max_), min_)


@shared_task(ignore_result=False, soft_time_limit=16, expires=60*60, max_retries=0, rate_limit='2/s')
def task_process_images_from_imgs(img_path: str, page: int, per_page: int):
    try:
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

        image_count = get_db().get_image_count(datetime.now().strftime('%Y%m%d'))
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

    except SoftTimeLimitExceeded:
        return {
            'message': f'Yikes... there was a time limit exception thrown...',
            'results': [{}]
        }
    except Exception:
        return {
            'message': f'Uh-oh... We ran into an unexpected issue...',
            'results': [{}]
        }


@bp.get('/task_result/<string:id>')
def task_result(id: str) -> dict[str, object]:
    result = AsyncResult(id)
    return {
        'ready': result.ready(),
        'successful': result.successful(),
        'value': result.result if result.ready() else None,
    }


@bp.route('/search_w_file', methods=['POST'])
def search_w_file():
    file_image: FileStorage = request.files.get('img')
    if not file_image:
        abort(400)

    sha256 = get_sha256_from_bytesio(file_image.stream)
    ext = mimetypes.guess_extension(file_image.mimetype)

    img_path = make_path('uploads', f'{sha256}.{ext}')
    file_image.stream.seek(0)
    file_image.save(img_path)

    page = 0
    per_page = 25

    task = task_process_images_from_imgs.delay(img_path, page, per_page)
    return jsonify({'task_id': task.id}), 202


@bp.route('/search_w_tags', methods=['GET'])
def search_w_tags():
    filters = {k: clamp(request.args.get(k, type=float), 0.0, 0.0, 1.0) for k in get_filters()}
    page = clamp(request.args.get('page', type=int), 0, 0, 10)
    per_page = clamp(request.args.get('per_page', type=int), 25, 0, 25)

    general_tag_ids = request.args.getlist('general_tag_ids', type=int)
    character_tag_ids = request.args.getlist('character_tag_ids', type=int)

    tags = general_tag_ids + character_tag_ids
    if not tags:
        return {'message': 'Try changing your filters.', 'result': [{}]}

    i1 = perf_counter()
    results = get_db().get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) if tags else []
    f1 = perf_counter() - i1

    image_count = get_db().get_image_count(datetime.now().strftime('%Y%m%d'))
    return {
        'message': f'We searched the tags of {image_count:,} images in {f1:.3f}s and found {len(results):,} results.',
        'results': results
    }


@bp.route('/')
def index():
    return render_template('index.html')


@lru_cache(maxsize=1)
def get_all_tags():
    tags = get_db().get_tags()
    if not tags:
        return jsonify([]), 200
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_name': tag[2]} for tag in tags])


@bp.route('/tags', methods=['GET'])
def tags():
    return get_all_tags()


@bp.route(f'/serve/<path:file_path>')
def serve(file_path: str):
    file_path = safe_join(current_app.root_folder, file_path)

    if not file_path:
        abort(404)

    if not file_path.split('.')[-1].lower().endswith(current_app.exts):
        abort(404)

    if not file_path.startswith(current_app.root_folder):
        abort(404)

    if not os.path.isfile(file_path):
        abort(404)

    return send_file(file_path)
