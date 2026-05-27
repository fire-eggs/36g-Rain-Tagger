Utility scripts for CLI tag work.

2026-05-06 : the utilities currently confirm with the user whether to proceed with operations.

Usage:
1. from the project root: `source venv/bin/activate`
2. `cd src`
3. `export PYTHONPATH=.`
4. `python utility/<utility> <parameters>`

list_dir_tags.py

Used to list all tags currently assigned to images in the target folder. Note: applies to only those images already registered by the tagger.

Usage: `python utility/list_dir_tags.py directory-path`

set_dir_tag.py

Used to add or remove a tag to all images in the target folder. Note: applies to only those images already registered by the tagger.

Usage: `python utility/set_dir_tag.py [-r] tag directory-path`

The -r parameter, if used, means the script will remove the specified tag from all images in the folder.

If the the specified tag doesn't already exist in the database, the tag will be created. 
