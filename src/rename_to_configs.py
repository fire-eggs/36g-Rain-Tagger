import os

root_folder = os.path.abspath('/')
exts = ('jpg', 'png', 'jpeg', 'gif')
host = '0.0.0.0'
port = 8000
debug = True
db_path = '/home/image_bk.db'

# image file search
allow_file_search = True
tag_model_repo_id = 'SmilingWolf/wd-swinv2-tagger-v3' # 'SmilingWolf/wd-convnext-tagger-v3' 'SmilingWolf/wd-vit-tagger-v3'
use_cpu = False