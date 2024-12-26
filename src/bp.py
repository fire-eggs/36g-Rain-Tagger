import base64
import os
import sys
from datetime import datetime
from functools import lru_cache
from io import BytesIO
from time import perf_counter

from celery import shared_task
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
from werkzeug.security import safe_join

from db import get_db
from processor import process_images_from_imgs

if 'web.celery_app' in sys.argv:
    # avoids loading model when running flask app with
    # gunicorn -b 127.0.0.1:8000 -w 1 --threads 1 web:flask_app
    from single_init import model, tag_data, torch_device, transform


bp = Blueprint('image_tagging_app', __name__)


def get_filters() -> list[str]:
    return ['f_tag', 'f_general', 'f_sensitive', 'f_explicit', 'f_questionable']


def clamp(val, min_, max_):
    if isinstance(val, list):
        return [max(min(v, max_), min_) for v in val]
    return max(min(val, max_), min_)


def get_images_repsponse(filters: dict[str, float], tags: list[int], page: int, per_page: int) -> dict:
    start_time = perf_counter()
    results = get_db().get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) if tags else []
    elapsed_time = perf_counter() - start_time

    image_count = get_db().get_image_count(datetime.now().strftime('%Y%m%d'))
    return {
        'message': f'Searched {image_count:,} images in {elapsed_time:.3f}s and found {len(results):,} results.',
        'results': results
    }


def img_to_base64(img: Image.Image) -> str:
    buffer = BytesIO()
    img.save(buffer, format=img.format if img.format else 'JPEG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def base64_to_img(b64_string: str) -> Image.Image:
    buffer = BytesIO(base64.b64decode(b64_string))
    return Image.open(buffer)


@shared_task(ignore_result=False)
def task_process_images_from_imgs(b64_img: str, page: int, per_page: int):
    img = base64_to_img(b64_img)
    filters = {key: 0.0 for key in get_filters()}
    rating_tags, char_tags, gen_tags = process_images_from_imgs([img], model, transform, torch_device, tag_data, 0.2, 0.2, by_idx=True)[0]
    tags = [*char_tags, *gen_tags]
    return get_images_repsponse(filters, tags, page, per_page)


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
    file_image = request.files.get('img')
    if not file_image:
        abort(400)

    img = Image.open(file_image.stream)
    page = 0
    per_page = 25
    b64_img = img_to_base64(img)
    task = task_process_images_from_imgs.delay(b64_img, page, per_page)
    return jsonify({'task_id': task.id}), 202


@bp.route('/search_w_tags', methods=['GET'])
def search_w_tags():
    filters = {k: clamp(request.args.get(k, type=float), 0.0, 1.0) for k in get_filters()}
    page = clamp(request.args.get('page', type=int), 0, 10)
    per_page = clamp(request.args.get('per_page', type=int), 0, 25)

    general_tag_ids = request.args.getlist('general_tag_ids', type=int)
    character_tag_ids = request.args.getlist('character_tag_ids', type=int)

    tags = general_tag_ids + character_tag_ids
    if not tags:
        abort(400)

    return get_images_repsponse(filters, tags, page, per_page)


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
