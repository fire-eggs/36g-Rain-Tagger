from dataclasses import dataclass
from enum import Enum
from typing import List


@dataclass
class TagData:
    names: List[str]
    rating: List[int]
    general: List[int]
    character: List[int]


class Ext(Enum):
    jpg = 1
    jpeg = 2
    png = 3
    gif = 4
    webp = 5
    avif = 6
    apng = 7
    tif = 8
    tiff = 9


class TagType(Enum):
    general = 0
    character = 4
    rating = 9
    future = 32


class Ratings(Enum):
    general = 0
    sensitive = 1
    questionable = 2
    explict = 3


class SafeSearch(Enum):
    off = 0
    moderate = 1
    safe = 2
    unsafe = 3
