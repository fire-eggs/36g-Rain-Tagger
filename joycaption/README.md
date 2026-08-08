# Using joycaption

The goal was to attempt to generate "Booru" image tags similar to those from the WD models. The results were different: in some ways superior yet with some limitations. For instance, joycaption generated a much larger set of tags than WD (e.g. about 60,000 vs 10,000). The joycaption tags include spaces, plurals, and some duplication (e.g. "nude female" and "female nude"; "abstract art" and "abstract_art").

## Generating tags

The assumption is all files in the tree are image files. Joycaption will generate an error if the file is unrecognized, e.g. "cannot identify image file". The desired Pillow extensions (AVIF, WEBP, HEIC, etc) should already be installed.

```bash
# tag all images in /home/kevin/jc_test tree
find /home/kevin/jc_test -type f > filelist.txt
python3 batch-captionMe.py --filelist filelist.txt --prompt-file="joyprompt.json"
```

The current prompt I'm using is (from joyprompt.json):

```
[
"Determine the content rating first. Rating definitions: 1) safe: no nudity or sexual activity; 2) suggestive: sexualized presentation, partial nudity, fetishwear, or emphasis on sexual features, but no visible genitalia and no sexual acts; 3) explicit: visible genitalia, visible nipples, or sexual activity. Output the rating as: rating:safe, rating:suggestive or rating:explicit. Then write a long list of Booru-like tags for this image. Ignore all text, dates, timestamps, watermarks, emojis, logos, and interface elements unless they are part of the actual artwork."
]
```

Ideally, this results in a "rating:" tag and a comma-separated list of tags. Note the results do not include probabilities as compared to the WD models.

Known limitations:

- The tags are written to a file of the form "image_file.txt". Thus, if there are multiple image files with the same base path but different extension, the first file "wins". E.g. "imageFoo.jpg" and "imageFoo.webp", only one "imageFoo.txt" file is created, containing the tags for the first one processed.
- A MatMul8bitLt warning is output, suggesting a possible inefficiency
- Some images produce a message: "Palette images with Transparency expressed in bytes should be converted to RGBA images"; were these images processed or not?
- Despite being prompted to provide a rating, joycaption doesn't always do so. See below.
- Sometimes joycaption includes extra "noise" in the output. See below.

## Gathering tags

Once joycaption has generated all the tag .txt files, the results are gathered into a 36g-compatible database. The script `coll_tags_to_db.py` does this work.

The `DB_PATH` and `IMG_BASE` values are manually modified to point at the (empty) 36g database, and to the root of the image tree.

```bash
# DB_PATH is assumed to be "./36g_style_rate.db"
cp 36g_style_rate[empty].db 36g_style_rate.db
python3 coll_tags_to_db.py
```

Some scenarios that `coll_tags_to_db.py` attempts to handle:

- All tags are in lowercase with extra whitespace stripped
- Tags which are all numeric or leading '@' [twitter handle] are ignored
- Accented characters are changed to generic ASCII
- Simple plurals are modified (e.g. "keys" to "key")
- if no "rating:" tag is found in a .txt file, use "rating:unrated"
- Instances of extra "noise" around the "rating:" tag are handled: "rating:safe\n\ntags: tag_text"; "rating:safe\n\ntag_text"; "rating: safe"
- Only tags which appear more than once are used

## Web interface

The web interface will work "out of the box" when pointing at a joycaption database. However, some web features won't quite work properly, and some changes are required. This is due to joycaption not providing tag probabilities.

1. For the explore view, db.py uses the `tags_for_images` view
2. For the cloud view, db.py uses the `tags_for_images` view
3. In `explore.js`, probability configurations are ignored
4. When adding new tags, spaces are allowed (not converted to underscore).
5. When searching by tags, the user needs to ignore the rating and probability sliders. Add a "rating:" tag to the search to filter by rating.

source deltas TBD
