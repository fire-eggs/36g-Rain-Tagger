import sqlite3
from functools import lru_cache

from structs import TagData, TagType
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
                sha256 TEXT NOT NULL UNIQUE
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


    def insert_image_tags(self, image_path: str, tag_id_2_prob: dict):
        sha256 = get_sha256(image_path)
        row = self.cursor.execute('INSERT OR IGNORE INTO image (image_path, sha256) VALUES (?, ?) RETURNING image_id', (image_path, sha256)).fetchone()
        if not row:
            return
        image_id = row[0]
        params = [(image_id, tag_id, prob) for tag_id, prob in tag_id_2_prob.items()]
        self.cursor.executemany('INSERT OR IGNORE INTO image_tag (image_id, tag_id, prob) VALUES (?, ?, ?)', params)


    def _fetch_results(self, image_ids: list[int]) -> list[dict] | None:
        if len(image_ids) < 1:
            return None

        phg = get_phg(image_ids)
        self.cursor.execute(f'SELECT image_id, image_path FROM image WHERE image_id IN ({phg})', image_ids)
        rows = self.cursor.fetchall()
        if not rows:
            return None

        image_id_2_path = {row[0]: row[1] for row in rows}

        self.cursor.execute(f"""
            SELECT image_tag.image_id, tag.tag_name, tag.tag_type_id, image_tag.prob
            FROM image_tag
                JOIN tag ON image_tag.tag_id = tag.tag_id
            WHERE image_tag.image_id IN ({phg})""",
            [k for k in image_id_2_path]
        )
        tags = self.cursor.fetchall()
        if not tags:
            return None

        results = {}
        tag_type_map = {TagType.rating.value: 'rating', TagType.general.value: 'general', TagType.character.value: 'character'}
        for image_id in image_id_2_path:
            results[image_id] = {
                'image_id': image_id,
                'image_path': image_id_2_path[image_id],
                'rating': {},
                'general': {},
                'character': {},
            }

        for image_id, tag_name, tag_type_id, prob in tags:
            results[image_id][tag_type_map[tag_type_id]][tag_name] = prob

        return [results[image_id] for image_id in image_ids]


    def _fetch_result(self, image_id: int) -> dict | None:
        results = self._fetch_results([image_id])
        return results[0] if len(results) and results else None


    def get_tag_by_image_path(self, image_path: str) -> dict | None:
        row = self.cursor.execute('SELECT image_id FROM image WHERE image_path = ?', (image_path,)).fetchone()
        if not row:
            return None
        result = self._fetch_result(row[0])
        return result


    def get_tag_by_sha256(self, sha256: str) -> dict | None:
        row = self.cursor.execute('SELECT image_id FROM image WHERE sha256 = ?', (sha256,)).fetchone()
        if not row:
            return None
        result = self._fetch_result(row[0])
        return result


    def get_tags_by_tag_name(self, tag_name: str) -> list[dict] | None:
        rows = self.cursor.execute("""
            SELECT DISTINCT image_tag.image_id
            FROM tag
                JOIN image_tag ON tag.tag_id = image_tag.tag_id
            WHERE tag.tag_name = ?""",
            (tag_name,)
        ).fetchall()
        if not rows:
            return None

        results = self._fetch_results([row[0] for row in rows])
        return results


    @lru_cache
    def get_tags(self) -> list[tuple] | None:
        rows = self.cursor.execute('SELECT tag_id, tag_name, tag_type_name FROM tag JOIN tag_type USING(tag_type_id)').fetchall()
        if not rows:
            return None
        return rows


    def get_images_by_tag_ids(self, tag_ids: list[int], prob_min: float=0) -> list[dict] | None:
        phg = get_phg(tag_ids)

        sql_prob = f'AND prob > {float(prob_min)}' if prob_min else ''

        rows = self.cursor.execute(f"""
            SELECT image_tag.image_id
            FROM image_tag
            WHERE image_tag.tag_id IN ({phg}) {sql_prob}
            GROUP BY image_tag.image_id
            HAVING COUNT(DISTINCT image_tag.tag_id) = {len(tag_ids)}
            ORDER BY prob DESC
            LIMIT 1000""",
            tag_ids
        ).fetchall()
        if not rows:
            return None

        results = self._fetch_results([row[0] for row in rows])
        return results


    def get_tags_like_tag_name(self, tag_name: str) -> list[dict] | None:
        tag_name = f'%{tag_name}%'
        rows = self.cursor.execute("""
            SELECT tag_id, tag_name, tag_type_name
            FROM tag JOIN tag_type USING(tag_type_id)
            WHERE tag.tag_name like ?""",
            (tag_name,)
        ).fetchall()
        if not rows:
            return None
        return rows


    def get_images_like_tag_name(self, tag_name: str) -> list[dict] | None:
        tag_name = f'%{tag_name}%'
        rows = self.cursor.execute("""
            SELECT DISTINCT image_tag.image_id
            FROM tag
                JOIN image_tag ON tag.tag_id = image_tag.tag_id
            WHERE tag.tag_name like ?""",
            (tag_name,)
        ).fetchall()
        if not rows:
            return None

        results = self._fetch_results([row[0] for row in rows])
        return results


    def get_image_has_tags_by_image_path(self, image_path: str) -> bool:
        sha256 = get_sha256(image_path)
        row = self.cursor.execute('SELECT image_id FROM image WHERE sha256 = ?', (sha256,)).fetchone()
        return bool(row)


    def get_sha256s(self) -> set[str]:
        return set(row[0] for row in self.cursor.execute('SELECT sha256 FROM image').fetchall())
