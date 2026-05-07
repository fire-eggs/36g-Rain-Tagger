
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
    print("python list_dir_tag.py folder")
    exit()

  if argc < 2:
      print("Missing folder")
      print("python list_dir_tag.py folder")
      exit()
  target = sys.argv[1]

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
  
  sql = f"select distinct(tag_name) from view_tags_for_images where image_id in (select image_id from image where directory_id={dirid}) order by tag_name"
  results = me_db._run_query(sql)
  outstr = ""
  for elem in results:
      outstr += list(elem.values())[0] + ", "
  print(outstr)
  me_db.close()
  exit()
