from functools import lru_cache

from flask import g, jsonify

from configs import db_path
from db.db import ImageDb


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = ImageDb(db_path)
    return db
