# 36g Rain Tagger

36g Rain Tagger is an automated image tagging software.

With it, you can:

- Run a python api tagger that crawls a file system, mapping a set of 10.8k tags to each image.
- Host a web UI to search tagged images. Searching can be done via tags, or image upload.

36g Rain Tagger uses [timm](https://huggingface.co/docs/timm/index) and leverages the model [SmilingWolf/wd-swinv2-tagger-v3](https://huggingface.co/SmilingWolf/wd-swinv2-tagger-v3).

It should run on Linux and Windows.

It is named after [36g](https://vocaloid.fandom.com/wiki/36g).

## Set Up

```bash
git clone https://github.com/skwzrd/36g-Rain-Tagger
cd 36g-Rain-Tagger
python3.12 -m venv venv
source venv/bin/activate
python3.12 -m pip install -r requirements.txt
# copy configs_copy.toml to configs.toml
# set variables in your configs.toml
cd src/
```

**Note:** The tagger will automatically download the image tagging model and save it to `~/.cache/huggingface/hub`.

The web ui is run with `python3.12 web.py` and the tagger is run with `python3.12 tagger.py`.

#### Desktop, Info Mode

<img src="https://github.com/skwzrd/36g-Rain-Tagger/blob/master/preview/preview1.png" height="400">

#### Desktop, Gallery Mode

<img src="https://github.com/skwzrd/36g-Rain-Tagger/blob/master/preview/preview3.png" height="400">

#### Desktop, Uploaded Image Search

<img src="https://github.com/skwzrd/36g-Rain-Tagger/blob/master/preview/preview4.png" height="400">


#### Mobile, Gallery Mode

<img src="https://github.com/skwzrd/36g-Rain-Tagger/blob/master/preview/preview2.png" height="400">


## Performance

### Tagging

| Device         |   Images   | Total Time (s) | Time per Image (s) |
|----------------|:----------:|---------------:|-------------------:|
| 4060 TI 16GB GPU    |     45     |          2.172 |              0.048 |
| 5700X x 8 CPU      |     45     |         21.277 |              0.473 |
| i7 8665U x 8 CPU    |     45     |         76.273 |              1.695 |


### Searching

0.1s - 0.4s results on hundreds of thousands of images.

`Searched 238,302 in 0.313s and found 25 results.`
