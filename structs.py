from dataclasses import dataclass
from enum import Enum
from typing import List


@dataclass
class TagData:
    names: List[str]
    rating: List[int]
    general: List[int]
    character: List[int]


class TagType(Enum):
    general = 0
    character = 4
    rating = 9
