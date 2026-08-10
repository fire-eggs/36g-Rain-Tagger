# defaultdict
# open each .txt file
# read the first line
# split on commas
# force each to lowercase, no whitespace surrounding, no trailing period
# add each element of split line to the dictionary, keeping count
#
# at the end, print count/tag only if more than 1 instance

# open sqlite db
# insert or update into tags
# walk files again
#    insert or update into directory
#    if jpg/jpeg/png/webp/gif
#        insert or update into image

# V3: fix bugs
# - when scanning images, need to log any files without matching .txt
# - when scanning .txt to get tags, need to call remove_accents
# - when scanning .txt to get tags, needs a better match for database image id 
# - displaying the count of tags found isn't useful, as only tags which occur more than once are actually stored

# V4: add 'rating:' support
# - if no "rating:" tag is found in a .txt file, use "rating:unrated"
# - include "avif"
# - "rating:safe\n\ntags: tag_text"
# - "rating:safe\n\ntag_text"
# - "rating: safe"
#
# V5: translate underscores to space ("bar_chart" -> "bar chart")
#
import unicodedata
import sqlite3
import glob
import os
from collections import defaultdict

def remove_accents(input_str):
    nfd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfd_form if not unicodedata.combining(c)])

def massage_tag(input_tag):
    tag2=tag.lower().strip().rstrip(".") # all lower, no trail period
    tag3=remove_accents(tag2)
    tag4=tag3.replace("_", " ") # replace underscores with spaces
    return tag4
    
DB_PATH = "./36g_style_rate2.db"
IMG_BASE="/home/kevin/jc_test2"

# collect tags
master = defaultdict(int)

for root, dirs, files in os.walk(IMG_BASE):
    for file in files:
        if file.endswith(".txt"):
            with open(os.path.join(root,file), "r") as f:
                tagline0 = f.read()
                tagline = tagline0.replace("\n\n", ",").replace("tags: ", "") # special cases
                
                tags = tagline.split(",")
                file_set = set() # to remove dupes within a txt file
                for tag in tags:
                    tag2 = massage_tag(tag)
                    if tag2.startswith("\"") or len(tag2) == 0: # no quotes or empty
                        continue
                    if tag2.startswith("@") or tag2.isnumeric(): # no numbers only, no twitter ids
                        continue
                    file_set.add(tag2)
                    
                for tag in file_set:
                    master[tag] += 1  

for key in list(master.keys()):
    # consider using the inflect package
    if key.endswith("s"):
        key_sing = key[:-1]
        if key_sing in master:
            master[key_sing] += master[key]
            master.pop(key)

# Note this is not useful info, as we're not storing into the database tags which occur only once
#print(f"Tag count: {len(list(master.keys()))}")
        
#for key in sorted(master):
#    if master[key] > 1:
#        print(f"({master[key]}): {key}")

# insert tags into Db
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
rowcount = 0
for key in master:
    if master[key] > 1:
        conn.execute("insert or ignore into tag (tag_name) values (?)", (key,))
        rowcount += 1
        if rowcount % 100 == 0:
            conn.commit()
conn.commit()

print("images")
# walk for directories, files, and files <> tag
for root, dirs, files in os.walk(IMG_BASE):
    for file in files:
        if file.endswith((".jpg",".jpeg",".png",".webp",".gif",".riff",".apng",".tif",".avif")):
            
            fname, _ = os.path.splitext(file)
            tagf = os.path.join(root,fname + ".txt")
            if not os.path.exists(tagf):
                print(f"Image has no tag file: |{root}|{file}|")
                
            cursor = conn.execute("insert or ignore into directory (directory) values (?) returning directory_id", (root,))
            res = cursor.fetchall()
            cursor.close()
            if len(res) == 0:
                cursor = conn.execute("select directory_id from directory where directory=?", (root,))
                res = cursor.fetchall()
                cursor.close()
            cursor = conn.execute("""insert or ignore into image (directory_id, filename, ext, sha256, explicit, sensitive, questionable, general)
values (?,?,null,null,0.0,0.0,0.0,0.0) returning image_id""", (res[0][0], file))
            res2 = cursor.fetchall()
            cursor.close()

conn.commit()

cursor = conn.execute("select tag_id from tag where tag_name=?", ("rating:unrated",))
res = cursor.fetchall()
cursor.close()
if (len(res) == 0):
    print("Failed to get tag id for 'rating:unrated'")
    exit()
unr = res[0][0]

print(".txt files")
for root, dirs, files in os.walk(IMG_BASE):
    for file in files:
        if file.endswith(".txt"):
            fname, _ = os.path.splitext(file)
            sqlstr = f'select image_id from image where filename like "{fname}.%" and directory_id=(select directory_id from directory where directory="{root}")'
            cursor = conn.execute(sqlstr, ())
            res = cursor.fetchall()
            cursor.close()
            if len(res) == 0:
                print(f"Image fail: not found in db |{root}|{file}|")
                continue
            if len(res) != 1:
                print(f"Image fail: multiple hits in db |{root}|{file}|")
                continue
                
            image_id = res[0][0]
            unrated = True
            with open(os.path.join(root,file), "r") as f:
                tagline0 = f.read()
                tagline = tagline0.replace("\n\n", ",").replace("tags: ", "") # special cases
                
                tags = tagline.split(",")
                for tag in tags:
                    tag2=massage_tag(tag)
                    if tag2.startswith("\"") or len(tag2) == 0: # no quotes or empty
                        continue
                    if tag2.startswith("@") or tag2.isnumeric(): # no numbers only, no twitter ids
                        continue
                    
                    if tag2.startswith("rating:"):
                        unrated = False
                        if tag2.startswith("rating: "):
                            tag2 = "rating:safe" # TODO check for other ratings
                        
                    tag3 = ""    
                    if tag2.endswith("s"):
                        tag3 = tag2[:-1]
                        
                    if tag2 in master:
                        cursor = conn.execute("select tag_id from tag where tag_name=?", (tag2,))
                        res = cursor.fetchall()
                        cursor.close()
                        if len(res) != 0:
                            conn.execute("insert or ignore into image_tag (image_id,tag_id,prob) values (?,?,?)", (image_id, res[0][0],1.0))
                    elif tag3 in master:
                        cursor = conn.execute("select tag_id from tag where tag_name=?", (tag3,))
                        res = cursor.fetchall()
                        cursor.close()
                        if len(res) != 0:
                            conn.execute("insert or ignore into image_tag (image_id,tag_id,prob) values (?,?,?)", (image_id, res[0][0],1.0))
                            
            if unrated: 
                conn.execute("insert or ignore into image_tag (image_id, tag_id, prob) values (?,?,?)", (image_id, unr, 1.0))
                
conn.commit()

print("update tag_count")
conn.execute("""update tag set tag_count=
                 (select count(image_id) from image_tag where image_tag.tag_id=tag.tag_id) 
                  where exists 
                  (select * from image_tag where image_tag.tag_id = tag.tag_id)""",())
conn.commit()

conn.close()
