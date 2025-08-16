import csv
import os
from functools import lru_cache

from enums import TagData, TagType
from utils import make_path


@lru_cache
def get_tag_data(tag_csv_path: str=make_path('..', 'tags.csv')) -> TagData:
    assert os.path.isfile(tag_csv_path)

    names = []
    rating, general, character = [], [], []
    with open(tag_csv_path, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for idx, row in enumerate(reader):
            names.append(row['tag_name'])
            tag_type_id = int(row['tag_type_id'])
            if tag_type_id == TagType.rating.value:
                rating.append(idx)
            elif tag_type_id == TagType.general.value:
                general.append(idx)
            elif tag_type_id == TagType.character.value:
                character.append(idx)
    return TagData(names=names, rating=rating, general=general, character=character)
