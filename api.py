import os

from flask import (
    Blueprint,
    Flask,
    abort,
    g,
    jsonify,
    render_template,
    request,
    send_file
)

from api_conf import debug, exts, host, port, root_folder
from db import ImageDb
from utils import make_path

bp = Blueprint('image_tagging_app', __name__)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = ImageDb(make_path('image.db'))
    return db


@bp.teardown_app_request
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        get_db().close()


@bp.route('/tags', methods=['GET'])
def get_tags():
    tags = get_db().get_tags()
    if not tags:
        return jsonify([]), 200
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_id': tag[2]} for tag in tags])


@bp.route('/search_tags', methods=['GET'])
def search_tags():
    query = request.args.get('q', '').strip()
    tag_type = request.args.get('type', '').strip()
    if not query:
        return jsonify([]), 200
    tags = get_db().get_tags_like_tag_name(query)

    if tag_type:
        tags = [tag for tag in tags if tag[2] == tag_type]

    if not tags:
        return jsonify([]), 200
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type': tag[2]} for tag in tags])


@bp.route('/search_images', methods=['POST'])
def search_images():
    data = request.json
    ratings = data.get('ratings', {})
    general_tag_ids = data.get('general_tags', [])
    character_tag_ids = data.get('character_tags', [])

    if not all(isinstance(rating, (float, int)) and 0 <= rating <= 1 for rating in ratings.values()):
        return jsonify({'error': 'Invalid rating values'}), 400

    if not (isinstance(general_tag_ids, list) and all(isinstance(id, int) for id in general_tag_ids)):
        return jsonify({'error': 'Invalid general tag IDs'}), 400

    if not (isinstance(character_tag_ids, list) and all(isinstance(id, int) for id in character_tag_ids)):
        return jsonify({'error': 'Invalid character tag IDs'}), 400

    results = get_db().get_images_by_tag_ids(general_tag_ids + character_tag_ids, prob_min=ratings['general'])

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

    if not file_path.startswith(app.root_image_folder_web):
        abort(404)

    if not os.path.isfile(file_path):
        abort(404)

    return send_file(file_path)


if __name__=='__main__':
    app = Flask('app')
    app.register_blueprint(bp)
    app.root_image_folder_web = root_folder
    app.exts = exts
    app.run(host=host, port=port, debug=debug)
