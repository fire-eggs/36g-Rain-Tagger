import os

from flask import (
    Blueprint,
    Flask,
    abort,
    g,
    jsonify,
    render_template,
    request,
    send_file,
    Request
)

from api_conf import debug, exts, host, port, root_folders
from db import ImageDb
from utils import make_path


bp = Blueprint('image_tagging_app', __name__)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = ImageDb(make_path('image.db'))
    return db

def get_q(r: Request, q: str, default, minp, maxp, typ) -> int:
    return max(min(typ(r.args.get(q, default)), maxp), minp)

def get_per_page(r: Request) -> int:
    return get_q(r, 'per_page', 25, 10, 200, int)

def get_page(r: Request) -> int:
    return get_q(r, 'page', 0, 0, 1000, int)

def get_list(r: Request, q: str, typ) -> list:
    return [typ(n) for n in r.args.getlist(q)]


def get_f(r: Request) -> float:
    default = 0
    maxp = 1.0
    minp = 0.0
    return max(min(int(r.args.get('page', default)), maxp), minp)


@bp.teardown_app_request
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        get_db().close()


@bp.route('/tags', methods=['GET'])
def get_all_tags():
    tags = get_db().get_tags()
    if not tags:
        return jsonify([]), 200
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_name': tag[2]} for tag in tags])


@bp.route('/search_tags', methods=['GET'])
def search_tags():
    tag_name = request.args.get('tag_name', '').strip()
    tag_type_name = request.args.get('tag_type_name', '').strip()

    if not tag_name:
        return jsonify([]), 200

    tags = get_db().get_tags_like_tag_name(tag_name, tag_type_name)

    if not tags:
        return jsonify([]), 200
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_name': tag[2]} for tag in tags])


@bp.route('/search_images', methods=['GET'])
def search_images():
    try:
        f_tag = get_q(request, 'f_tag', 0.0, 0.0, 1.0, float)
        general_tag_ids = get_list(request, 'general_tag_ids', int)
        character_tag_ids = get_list(request, 'character_tag_ids', int)
        page = get_page(request)
        per_page = get_per_page(request)
    except Exception as e:
        abort(400)

    tags = general_tag_ids + character_tag_ids
    if not tags:
        abort(400)

    results = get_db().get_images_by_tag_ids(tags, f_tag, page, per_page)

    if not results:
        return jsonify([]), 200

    return jsonify(results)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/serve/<path:filename>')
def serve(filename: str):
    file_path = os.path.abspath(os.path.join('/', filename))

    if not file_path.split('.')[-1].lower().endswith(app.exts):
        abort(404)

    if not file_path.startswith(app.root_folders):
        abort(404)

    if not os.path.isfile(file_path):
        abort(404)

    return send_file(file_path)


if __name__=='__main__':
    app = Flask('app')
    app.register_blueprint(bp)
    app.root_folders = root_folders
    app.exts = exts
    app.run(host=host, port=port, debug=debug)
