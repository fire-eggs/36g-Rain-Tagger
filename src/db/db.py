import sqlite3
from functools import lru_cache

from structs import Ratings, TagData, TagType
from utils import get_sha256


def get_phg(l: list) -> str:
    if len(l) < 1:
        raise ValueError(l)
    return ','.join(['?'] * len(l))


class ImageDb:
    def __init__(self, db_name, init=False):
        self.conn = sqlite3.connect(db_name)
        self.cursor = self.conn.cursor()
        if init:
            self._initialize_tables()

    def save(self):
        self.conn.commit()

    def close(self):
        self.cursor.close()
        self.conn.close()

    def save_and_close(self):
        self.save()
        self.close()

    def _initialize_tables(self):
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS image (
                image_id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL UNIQUE,
                sha256 TEXT NOT NULL UNIQUE,
                explicit REAL,
                sensitive REAL,
                questionable REAL,
                general REAL
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS tag_type (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                tag_type_id INTEGER NOT NULL UNIQUE,
                tag_type_name TEXT NOT NULL UNIQUE
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS tag (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                tag_id INTEGER NOT NULL, -- matches the csv row number
                tag_name TEXT NOT NULL,
                tag_type_id INTEGER NOT NULL,
                FOREIGN KEY (tag_type_id) REFERENCES tag_type(tag_type_id),
                UNIQUE (tag_name, tag_type_id)
            )
        """)
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS image_tag (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                prob REAL NOT NULL,
                FOREIGN KEY (image_id) REFERENCES image(image_id),
                FOREIGN KEY (tag_id) REFERENCES tag(tag_id),
                UNIQUE (image_id, tag_id)
            )
        """)
        for tag_type in TagType:
            self.cursor.execute(
                """INSERT OR IGNORE INTO tag_type (tag_type_id, tag_type_name) VALUES (?, ?)""",
                (tag_type.value, tag_type.name)
            )
        self.conn.commit()


    def insert_tags(self, tag_data: TagData):
        params = [
            [(idx, tag_data.names[idx], TagType.rating.value) for idx in tag_data.rating],
            [(idx, tag_data.names[idx], TagType.general.value) for idx in tag_data.general],
            [(idx, tag_data.names[idx], TagType.character.value) for idx in tag_data.character],
        ]
        for p in params:
            self.cursor.executemany('INSERT OR IGNORE INTO tag (tag_id, tag_name, tag_type_id) VALUES (?, ?, ?)', p)
        tag_count = self.cursor.execute('SELECT COUNT(*) FROM tag').fetchone()[0]
        csv_tag_count = 10_861
        if tag_count != csv_tag_count:
            raise ValueError()


    def insert_image_tags(self, image_path: str, ratings: dict, tag_id_2_prob: dict):
        sha256 = get_sha256(image_path)
        general, sensitive, questionable, explicit = ratings[Ratings.general.value], ratings[Ratings.sensitive.value], ratings[Ratings.questionable.value], ratings[Ratings.explict.value]
        row = self.cursor.execute("""
                INSERT OR IGNORE INTO
                image (image_path, sha256, general, explicit, sensitive, questionable)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING image_id"""
                , (image_path, sha256, general, explicit, sensitive, questionable)
        ).fetchone()
        if not row:
            return []
        image_id = row[0]
        params = [(image_id, tag_id, prob) for tag_id, prob in tag_id_2_prob.items()]
        self.cursor.executemany('INSERT OR IGNORE INTO image_tag (image_id, tag_id, prob) VALUES (?, ?, ?)', params)


    def _fetch_results(self, image_ids: list[int]) -> list[dict]:
        if len(image_ids) < 1:
            return []

        phg = get_phg(image_ids)
        self.cursor.execute(f'SELECT image_id, image_path, general, explicit, sensitive, questionable FROM image WHERE image_id IN ({phg})', image_ids)
        rows = self.cursor.fetchall()
        if not rows:
            return []

        image_id_2_data = {row[0]: [row[1], row[2], row[3], row[4], row[5]] for row in rows}

        self.cursor.execute(f"""
            SELECT image_tag.image_id, tag.tag_name, tag.tag_type_id, image_tag.prob
            FROM image_tag
                JOIN tag ON image_tag.tag_id = tag.tag_id
            WHERE image_tag.image_id IN ({phg})""",
            [k for k in image_id_2_data]
        )
        tags = self.cursor.fetchall()
        if not tags:
            return []

        results = {}
        tag_type_map = {TagType.rating.value: 'rating', TagType.general.value: 'general', TagType.character.value: 'character'}
        for image_id, (image_path, general, explicit, sensitive, questionable) in image_id_2_data.items():
            results[image_id] = {
                'image_id': image_id,
                'image_path': image_path,
                'rating': {'general': general, 'explicit': explicit, 'sensitive': sensitive, 'questionable': questionable},
                'general': {},
                'character': {},
            }

        for image_id, tag_name, tag_type_id, prob in tags:
            results[image_id][tag_type_map[tag_type_id]][tag_name] = prob

        return [results[image_id] for image_id in image_ids]


    def _fetch_result(self, image_id: int) -> dict:
        results = self._fetch_results([image_id])
        return results[0] if len(results) and results else None


    def get_tag_by_image_path(self, image_path: str) -> dict:
        row = self.cursor.execute('SELECT image_id FROM image WHERE image_path = ?', (image_path,)).fetchone()
        if not row:
            return []
        result = self._fetch_result(row[0])
        return result


    def get_tag_by_sha256(self, sha256: str) -> dict:
        row = self.cursor.execute('SELECT image_id FROM image WHERE sha256 = ?', (sha256,)).fetchone()
        if not row:
            return []
        result = self._fetch_result(row[0])
        return result


    def get_tags_by_tag_name(self, tag_name: str) -> list[dict]:
        rows = self.cursor.execute("""
            SELECT DISTINCT image_tag.image_id
            FROM tag
                JOIN image_tag ON tag.tag_id = image_tag.tag_id
            WHERE tag.tag_name = ?""",
            (tag_name,)
        ).fetchall()
        if not rows:
            return []

        results = self._fetch_results([row[0] for row in rows])
        return results


    @lru_cache(maxsize=2)
    def get_tags(self) -> list[tuple]:
        rows = self.cursor.execute('SELECT tag_id, tag_name, tag_type_name FROM tag JOIN tag_type USING(tag_type_id)').fetchall()
        if not rows:
            return []
        return rows


    @lru_cache(maxsize=2)
    def get_image_count(self, date: str) -> int:
        return int(self.cursor.execute('SELECT count() FROM image;').fetchone()[0])


    def get_images_by_tag_ids(self, tag_ids: list[int], f_tag: float, f_general: float, f_sensitive: float, f_explicit: float, f_questionable: float, page: int, per_page: int) -> list[dict]:
        offset = max(page - 1, 0) * per_page

        rows = self.cursor.execute(f"""
            SELECT image_tag.image_id
            FROM image JOIN image_tag USING(image_id)
            WHERE
                image_tag.tag_id IN ({get_phg(tag_ids)})
                AND image_tag.prob >= ?
                AND general >= ?
                AND sensitive >= ?
                AND questionable >= ?
                AND explicit >= ?
            GROUP BY image_tag.image_id
            HAVING COUNT(DISTINCT image_tag.tag_id) = ?
            ORDER BY MAX(image_tag.prob) DESC
            LIMIT ?
            OFFSET ?""",
            tag_ids + [f_tag, f_general, f_sensitive, f_questionable, f_explicit, len(tag_ids), per_page, offset]
        ).fetchall()

        if not rows:
            return []

        image_ids = [row[0] for row in rows]


        results = self._fetch_results(image_ids)
        return results


    def get_tags_like_tag_name(self, tag_name: str, tag_type_name: str) -> list[dict]:
        params = [f'%{tag_name}%']

        sql_tag_type_name = ''
        if tag_type_name:
            sql_tag_type_name = f'AND tag_type_name = ?'
            params.append(tag_type_name)

        rows = self.cursor.execute(f"""
            SELECT tag_id, tag_name, tag_type_name
            FROM tag
                JOIN tag_type USING(tag_type_id)
            WHERE tag.tag_name like ? {sql_tag_type_name}""",
            params
        ).fetchall()
        if not rows:
            return []
        return rows


    def get_images_like_tag_name(self, tag_name: str) -> list[dict]:
        tag_name = f'%{tag_name}%'
        rows = self.cursor.execute("""
            SELECT DISTINCT image_tag.image_id
            FROM tag
                JOIN image_tag ON tag.tag_id = image_tag.tag_id
            WHERE tag.tag_name like ?""",
            (tag_name,)
        ).fetchall()
        if not rows:
            return []

        results = self._fetch_results([row[0] for row in rows])
        return results


    def get_image_has_tags_by_image_path(self, image_path: str) -> bool:
        sha256 = get_sha256(image_path)
        row = self.cursor.execute('SELECT image_id FROM image WHERE sha256 = ?', (sha256,)).fetchone()
        return bool(row)


    def get_sha256s(self) -> set[str]:
        return set(row[0] for row in self.cursor.execute('SELECT sha256 FROM image').fetchall())
