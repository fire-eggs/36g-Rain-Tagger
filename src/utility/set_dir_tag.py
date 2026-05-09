
import os,sys
from configs import TaggerConfigs, configs
from db import ImageDb

def confirm(msg):
    print(msg)
    while True:
        answer = input("Proceed (y or n)?")
        if answer.lower().startswith('n'):
            return False
        if answer.lower().startswith('y'):
            return True
        print("Unexpected answer. Please enter y or n")
    

if __name__ == '__main__':
  
  # Verify and fetch command line arguments
  argc = len(sys.argv)
  #print(f"{argc} {sys.argv}")
  if (argc < 2):
    print("python set_dir_tag.py [-r] tag folder")
    exit()

  isreverse = sys.argv[1] == "-r"
  if isreverse:
    if argc < 3:
        print("Missing tag")
        print("python set_dir_tag.py [-r] tag folder")
        exit()
    if argc < 4:
        print("Missing folder")
        print("python set_dir_tag.py [-r] tag folder")
        exit()
    tag = sys.argv[2]
    target = sys.argv[3]
  else:
    if argc < 3:
        print("Missing folder")
        print("python set_dir_tag.py [-r] tag folder")
        exit()
    tag = sys.argv[1]
    target = sys.argv[2]

  # Open database  
  me_configs: TaggerConfigs = configs
  if not os.path.exists(me_configs.db_path):
      print(f"Can't open database: '{me_configs.db_path}'")
      exit()
      
  me_db: ImageDb = ImageDb(me_configs.db_path, me_configs.sql_echo)

  # Target folder must already be in database
  sql = f'select directory_id from directory where directory = "{target}"'
  results = me_db._run_query(sql)
  #print(f"count: {len(results)}")
  if (len(results) != 1):
    print("Target folder must have already been processed by tagger.py")
    exit()

  dirid = list(results[0].values())[0]
  #print(f"directory id: {dirid}")

  # Need the tag id for the tag: fetch or add    
  sql = f'select tag_id from tag where tag_name = "{tag}"'
  results = me_db._run_query(sql)
  #print(f"count: {len(results)}")
  if (len(results) < 1):
    if isreverse:
        print(f"Tag '{tag}' doesn't exist.")
        exit()        
    if not confirm(f"About to create new tag '{tag}'."):
        exit()
    sql = 'select max(tag_id) from tag'
    results = me_db._run_query(sql)
    tagid = list(results[0].values())[0] + 1
    sql = f'insert into tag (tag_id, tag_name, tag_type_id) values ({tagid}, "{tag}", 32)' # TODO hard-coded 'future' tag type
    #print(sql)
    results = me_db._run_query(sql)
    me_db.save()
  else:
    tagid = list(results[0].values())[0]

  #print(f"tag_id : {tagid}")

  sql = f"select count(image_id) from image where directory_id={dirid}"
  results = me_db._run_query(sql)
  imgcount = list(results[0].values())[0]
  if isreverse:
    if not confirm(f"About to remove tag '{tag}' from {imgcount} images."):
      exit()
  else:
    if not confirm(f"About to apply tag '{tag}' to {imgcount} images."):
      exit()

  # For every file ALREADY IN THE DATABASE add the tag
  for entry in os.listdir(target):
    sql = f'select image_id from image where directory_id={dirid} and filename="{entry}"'
    results = me_db._run_query(sql)
    if (len(results) < 1):
      print(f'Skipping: "{entry}"')
      continue
    imageid = list(results[0].values())[0]

    if isreverse:
        sql = f'delete from image_tag where image_id={imageid} and tag_id={tagid}'
    else:
        sql = f'insert or ignore into image_tag (image_id, tag_id, prob) values ({imageid},{tagid}, 1.0)'
    me_db._run_query(sql)
    
  me_db.save_and_close()
