import json
import mimetypes
import os
import logging
from functools import lru_cache
from time import perf_counter

from flask import (
    Blueprint,
    Flask,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    send_file,
)
from PIL import Image
from werkzeug.datastructures import FileStorage
from werkzeug.exceptions import (
    BadRequest,
    Forbidden,
    NotFound,
    UnsupportedMediaType
)
from werkzeug.security import safe_join

from configs import configs
from db_flask import FlaskImageDb
from tagger import Tagger
from utils import clamp, get_sha256_from_bytesio, make_path

if configs.allow_file_upload_search:
    from processor import process_images_from_imgs


bp = Blueprint('36g', __name__)


def get_filters() -> list[str]:
    return ['f_tag', 'f_general', 'f_sensitive', 'f_explicit', 'f_questionable']


def app_process_images_from_path(img_path: str, page: int, per_page: int) -> dict:
    i1 = perf_counter()

    img = Image.open(img_path)
    filters = {key: 0.0 for key in get_filters()}
    rating_tags, char_tags, gen_tags = process_images_from_imgs(
        [img],
        current_app.tagger.model,
        current_app.tagger.transform,
        current_app.tagger.torch_device,
        current_app.tagger.tag_data,
        configs.min_general_tag_val,
        configs.min_character_tag_val,
        by_idx=True,
    )[0]
    tags = [*char_tags, *gen_tags]
    os.remove(img_path)

    i2 = perf_counter()
    f1 = i2 - i1
    results,tot_count = current_app.db.get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) #if tags else [],0
    f2 = perf_counter() - i2

    rating_tags = {current_app.tagger.tag_data.names[k]: v for k, v in rating_tags.items()}
    char_tags   = {current_app.tagger.tag_data.names[k]: v for k, v in char_tags.items()}
    gen_tags    = {current_app.tagger.tag_data.names[k]: v for k, v in gen_tags.items()}

    image_count = current_app.db.get_image_count()
    message = '\n'.join([
        f'Processing your image took {f1:.3f}s.',
        f'We searched the tags of {image_count:,} images in {f2:.3f}s and found {tot_count:,} results.',
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


@bp.route('/search_w_file', methods=['POST'])
def search_w_file():
    if not configs.allow_file_upload_search:
        abort(404)

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

    return jsonify(app_process_images_from_path(img_path, page, per_page))


@bp.route('/search_w_tags', methods=['GET'])
def search_w_tags():
    filters = {k: clamp(request.args.get(k, type=float), 0.0, 0.0, 1.0) for k in get_filters()}
    page = clamp(request.args.get('page', type=int), 0, 0, 100_000_000)
    per_page = clamp(request.args.get('per_page', type=int), 25, 0, 1_000)

    general_tag_ids = request.args.getlist('general_tag_ids', type=int)
    character_tag_ids = request.args.getlist('character_tag_ids', type=int)

    tags = general_tag_ids + character_tag_ids
    if not tags:
        return jsonify({'message': 'Try changing your filters.', 'result': [{}]})

    i1 = perf_counter()
    results,tot_count = current_app.db.get_images_by_tag_ids(tags, filters['f_tag'], filters['f_general'], filters['f_sensitive'], filters['f_explicit'], filters['f_questionable'], page, per_page) #if tags else [],0
    f1 = perf_counter() - i1

    image_count = current_app.db.get_image_count()
    return jsonify({
        'message': f'We searched the tags of {image_count:,} images in {f1:.3f}s and found {tot_count:,} results.',
        'results': results,
        'tot_found': tot_count,
    })

@bp.route('/top_tags', methods=['GET'])
def get_top_tags():

    """ Future params:
    - general or character tags
    - probability level
    - count
    """
    choice1 = request.args.get('expOption') # general/sensitive/questionable/explicit
    choice2 = request.args.get('tagType') # general/character; future "artist"

    results = current_app.db.get_top_tags(choice1,choice2)
    return jsonify({
    'results': results,
    })


@bp.route('/all_images', methods=['GET'])
def all_images():
    """An endpoint for testing demo.html only.

    This will populate the file ~/demo/results.js.
    """

    if not current_app.debug:
        raise ValueError('Not in debug mode.')

    results = current_app.db._get_all_images()

    result_js_path = make_path('..', 'demo', 'results.js')
    with open(result_js_path, mode='w') as f:
        # I know.
        s = 'const results = ' + json.dumps(results) + ';'
        f.write(s)

    # You can also use bash with this one liner...
    # echo -n "const results = " > ~/Desktop/results.js && curl -s http://127.0.0.1:8000/all_images >> ~/Desktop/results.js && echo ";" >> ~/Desktop/results.js

    return jsonify(results)


@bp.route('/')
def index():
    return render_template('index.html', allow_file_upload_search=configs.allow_file_upload_search)

@bp.route('/api/selection', methods=["GET"])
def current_selection():
    #print('current_selection')
    selected_ids = request.args.getlist('selected_ids', type=int)
    #print(selected_ids)
    if len(selected_ids) == 0:
        return jsonify([])
    results = current_app.db.get_common_tags(selected_ids,0,0.0)
    return jsonify(results)

@bp.route('/api/applyTagChanges', methods=["GET"])
def applyTagChanges():
    #print('applyTagChanges')
    image_ids = request.args.getlist('image_ids', type=int)
    tag_ids = request.args.getlist('tag_ids', type=int)
    text_tags = request.args.getlist('text_tags')

    blah = current_app.db.get_common_tags(image_ids,0,0.0)
    old_tag_ids = [row["tag_id"] for row in blah]
    
    #print(f"ATC old_tag_ids: {old_tag_ids}")
    #print(f"ATC new_tag_ids: {tag_ids}")
    
    tags_to_delete = list(set(old_tag_ids) - set(tag_ids))
    #print(f'ATC tags to delete: {tags_to_delete}')
    
    if len(tags_to_delete) > 0:
        current_app.db.delete_tags(image_ids, tags_to_delete)

    tags_to_add = list(set(tag_ids) - set(old_tag_ids))
    #print(f'ATC tags to add: {tags_to_add}')

    if len(tags_to_add) > 0:
        #newdb = FlaskImageDb(configs.db_path, sql_echo=configs.sql_echo)        
        current_app.db.add_tags(image_ids, tags_to_add)
        #newdb.close()

    #print(f'ATC text tags: {text_tags}')
    if len(text_tags) > 0:
        current_app.db.add_possibly_new_tags(image_ids, text_tags, 32) # TODO last parameter is hardcoded as FUTURE

    results = current_app.db.get_mra_tags()
    return jsonify(results)        

@bp.route('/api/removeImage', methods=["GET"])
def removeImage():
    image_ids = request.args.get('image_ids')
    current_app.db.remove_image(image_ids)
    return jsonify("")


@lru_cache(maxsize=1)
def get_all_tags():
    tags = current_app.db.get_tags()
    if not tags:
        return jsonify([])
    return jsonify([{'tag_id': tag[0], 'tag_name': tag[1], 'tag_type_name': tag[2]} for tag in tags])

@bp.get('/tags')
def tags():
    @lru_cache
    def _tags():
        return jsonify(current_app.db.get_tags())
    return _tags()

@bp.errorhandler(NotFound)
def file_not_found(e):
  return jsonify(error=str(e)), 404

@bp.route('/serve')
def serve():
    file_path = request.args.get('p')
    if not file_path:
        abort(400)

    if not file_path.split('.')[-1].lower().endswith(configs.valid_extensions):
        abort(UnsupportedMediaType)

    if not file_path.startswith(configs.web_media_roots):
        abort(Forbidden)

    if not os.path.isfile(file_path):
        #print(f"Not found {file_path}")
        abort(404, description=file_path)  # TODO was NotFound, results in LookupError exception

    return send_file(file_path)

@bp.route('/dupl_images')
def dupl_images():
    return current_app.db.get_sha_dupls()

@bp.route('/dupl_images_auto_del')
def dupl_images_auto_delete():
    dupls = current_app.db.get_sha_dupls()
    
    newdupls = []
    
    #print(dupls[0])
    index = 0
    while index < len(dupls):
        
        file1ok = os.path.isfile(dupls[index]["image_path"])
        file2ok = os.path.isfile(dupls[index+1]["image_path"])
        if dupls[index]["tags"] == dupls[index+1]["tags"]:
            todelete = dupls[index]["image_id"] if file2ok else dupls[index+1]["image_id"]
            #print(f"deleting {index} {todelete} {file1ok} {file2ok}")
            current_app.db.remove_image(todelete)
        else:
            newdupls.append(dupls[index])
            newdupls.append(dupls[index+1])
            
        index += 2
        if index < len(dupls) and dupls[index]["sha256"] == dupls[index-1]["sha256"]:
            print("dupl_images_auto_delete: More than two duplications encountered, punting")
            return newdupls

    return newdupls

@bp.route('/keep_tags')
def keep_tags():
    src = request.args.get('from')
    dst = request.args.get('to')
    current_app.db.keep_tags(src, dst)    
    return jsonify("")
    
print('flask_app, starting')

flask_app = Flask(__name__)
logging.getLogger('werkzeug').disabled = True

flask_app.tagger = Tagger(configs)
if configs.allow_file_upload_search:
    flask_app.tagger.load_model()

flask_app.db = FlaskImageDb(configs.db_path, sql_echo=configs.sql_echo)

flask_app.register_blueprint(bp)

@flask_app.teardown_appcontext
def close_db(error):
    flask_app.db.close()

print('flask_app, created')


if __name__=='__main__':
    print('flask_app.run, starting')
    # gunicorn -b 127.0.0.1:8000 -w 1 --threads 1 web:flask_app
    flask_app.run(host=configs.host, port=configs.port, debug=configs.debug)
    print('flask_app.run, exiting')
