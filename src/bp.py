import json
import mimetypes
import os
from datetime import datetime
from functools import lru_cache
from time import perf_counter

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
from werkzeug.datastructures import FileStorage
from werkzeug.exceptions import (
    BadRequest,
    Forbidden,
    NotFound,
    UnsupportedMediaType
)
from werkzeug.security import safe_join

from celery_app.tasks import task_process_images_from_paths
from configs import use_celery
from db import get_db
from shared import app_process_images_from_paths, get_filters
from utils import clamp, get_sha256_from_bytesio, make_path

bp = Blueprint('image_tagging_app', __name__)


@bp.get('/task_result/<string:id>')
def task_result(id: str) -> dict[str, object]:
    if not use_celery:
        abort(NotFound)

    result = AsyncResult(id)
    return jsonify({
        'ready': result.ready(),
        'successful': result.successful(),
        'value': result.result if result.ready() else None,
    })


@bp.route('/search_w_file', methods=['POST'])
def search_w_file():
    file_image: FileStorage = request.files.get('img')
    if not file_image:
        abort(BadRequest)

    sha256 = get_sha256_from_bytesio(file_image.stream)
    ext = mimetypes.guess_extension(file_image.mimetype)

    img_path = make_path('uploads', f'{sha256}.{ext}')
    file_image.stream.seek(0)
    file_image.save(img_path)

    page = 0
    per_page = 25

    if use_celery:
        task = task_process_images_from_paths.delay(img_path, page, per_page)
        return jsonify({'task_id': task.id})

    return jsonify(app_process_images_from_paths(img_path, page, per_page))


@bp.route('/search_w_tags', methods=['GET'])
def search_w_tags():
    filters = {k: clamp(request.args.get(k, type=float), 0.0, 0.0, 1.0) for k in get_filters()}
    page = clamp(request.args.get('page', type=int), 0, 0, 10)
    per_page = clamp(request.args.get('per_page', type=int), 25, 0, 25)

    general_tag_ids = request.args.getlist('general_tag_ids', type=int)
    character_tag_ids = request.args.getlist('character_tag_ids', type=int)

    tags = general_tag_ids + character_tag_ids
    if not tags:
        return jsonify({'message': 'Try changing your filters.', 'result': [{}]})

    i1 = perf_counter()
    results = get_db().get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) if tags else []
    f1 = perf_counter() - i1

    image_count = get_db().get_image_count()
    return jsonify({
        'message': f'We searched the tags of {image_count:,} images in {f1:.3f}s and found {len(results):,} results.',
        'results': results
    })


@bp.route('/all_images', methods=['GET'])
def all_images():
    """An endpoint for testing demo.html only.

    This will populate the file ~/demo/results.js.
    """

    if not current_app.debug:
        raise ValueError('Not in debug mode.')

    results = get_db()._get_all_images()

    with open(make_path('..', 'demo', 'results.js'), mode='w') as f:
        # I know.
        s = 'const results = ' + json.dumps(results) + ';'
        f.write(s)

    # You can also use bash with this one liner...
    # echo -n "const results = " > ~/Desktop/results.js && curl -s http://127.0.0.1:8000/all_images >> ~/Desktop/results.js && echo ";" >> ~/Desktop/results.js

    return jsonify(results)


@bp.route('/')
def index():
    return render_template('index.html')


@lru_cache(maxsize=1)
def get_all_tags():
    tags = get_db().get_tags()
    if not tags:
        return jsonify([])
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_name': tag[2]} for tag in tags])


@bp.route('/tags', methods=['GET'])
def tags():
    return get_all_tags()


@bp.route(f'/serve/<path:file_path>')
def serve(file_path: str):
    file_path = safe_join(current_app.root_folder, file_path)

    if not file_path:
        abort(NotFound)

    if not file_path.split('.')[-1].lower().endswith(current_app.exts):
        abort(UnsupportedMediaType)

    if not file_path.startswith(current_app.root_folder):
        abort(Forbidden)

    if not os.path.isfile(file_path):
        abort(NotFound)

    return send_file(file_path)
