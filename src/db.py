import sqlite3
from datetime import datetime
from functools import lru_cache
import os

from enums import Ratings, TagData, TagType
from sqlitedb import SqliteDb, get_placeholders
from tag_data import get_tag_data
from utils import get_sha256_from_path


class ImageDb(SqliteDb):
    def __init__(self, db_path, sql_echo=False):
        super().__init__(db_path, sql_echo)

        self.directory_2_id: dict = {}
        self.total_csv_tag_count = 10_861


    def is_tags_exist(self) -> bool:
        tag_count = self.run_query_tuple('select count(*) from tag')[0][0]
        print(f'Found {tag_count}/{self.total_csv_tag_count} tags already in database.')
        # KBR tag count may exceed CSV count
        return tag_count >= self.total_csv_tag_count


    def init_tagging(self):
        sqls = [
        """
            CREATE TABLE IF NOT EXISTS image (
                image_id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                ext INTEGER,
                sha256 TEXT,
                explicit REAL,
                sensitive REAL,
                questionable REAL,
                general REAL,
                UNIQUE(directory_id, filename)
            );
        ""","""
            CREATE TABLE IF NOT EXISTS directory (
                directory_id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory TEXT NOT NULL,
                FOREIGN KEY (directory_id) REFERENCES image(directory_id) ON DELETE CASCADE,
                UNIQUE(directory)
            );
        ""","""
            CREATE TABLE IF NOT EXISTS tag_type (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                tag_type_id INTEGER NOT NULL UNIQUE,
                tag_type_name TEXT NOT NULL UNIQUE
            )
        ""","""
            CREATE TABLE IF NOT EXISTS tag (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                tag_id INTEGER NOT NULL UNIQUE, -- matches the csv row number
                tag_name TEXT NOT NULL,
                tag_type_id INTEGER NOT NULL,
                tag_count INTEGER DEFAULT 0,
                FOREIGN KEY (tag_type_id) REFERENCES tag_type(tag_type_id) ON DELETE CASCADE,
                UNIQUE (tag_name, tag_type_id)
            )
        ""","""
            CREATE TABLE IF NOT EXISTS image_tag (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                prob REAL NOT NULL,
                FOREIGN KEY (image_id) REFERENCES image(image_id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tag(tag_id) ON DELETE CASCADE,
                UNIQUE (image_id, tag_id)
            )
        ""","""
            create view IF NOT EXISTS tags_for_images_prob60_v2 AS
            select tag.tag_id, tag.tag_name, image_tag.image_id, image_tag.prob, image.explicit, image.sensitive, image.questionable, image.general
            from tag 
            left join image_tag on tag.tag_id = image_tag.tag_id
            left join image     on image.image_id=image_tag.image_id
            where tag.tag_type_id=0 and image_tag.prob >= 0.6;
        ""","""
            create view IF NOT EXISTS char_tags_for_images_prob60_v2 AS
            select tag.tag_id, tag.tag_name, image_tag.image_id, image_tag.prob, image.explicit, image.sensitive, image.questionable, image.general
            from tag 
            left join image_tag on tag.tag_id = image_tag.tag_id
            left join image     on image.image_id=image_tag.image_id
            where tag.tag_type_id=4 and image_tag.prob >= 0.6;
        """        
        ]

        # CREATE INDEX IF NOT EXISTS idx_image_explicit               ON image (explicit);
        # CREATE INDEX IF NOT EXISTS idx_image_sensitive              ON image (sensitive);
        # CREATE INDEX IF NOT EXISTS idx_image_questionable           ON image (questionable);
        # CREATE INDEX IF NOT EXISTS idx_image_general                ON image (general);
        # CREATE INDEX IF NOT EXISTS idx_tag_type_name                ON tag_type (tag_type_name);
        # CREATE INDEX IF NOT EXISTS idx_image_tag_image_id           ON image_tag (image_id);
        # CREATE INDEX IF NOT EXISTS idx_image_tag_tag_id             ON image_tag (tag_id);
        # CREATE INDEX IF NOT EXISTS idx_image_tag_image_id_prob      ON image_tag (image_id, prob);
        idxs = """
        CREATE INDEX IF NOT EXISTS idx_image_filename               ON image(filename);
        CREATE INDEX IF NOT EXISTS idx_image_directory_id_filename  ON image(directory_id, filename);
        CREATE INDEX IF NOT EXISTS idx_image_sha256                 ON image(sha256);

        CREATE INDEX IF NOT EXISTS idx_directory_id         ON directory(directory_id);
        CREATE INDEX IF NOT EXISTS idx_directory_directory  ON directory(directory);
        
        CREATE INDEX IF NOT EXISTS idx_image_tag_image_id           ON image_tag (image_id);
        CREATE INDEX IF NOT EXISTS idx_image_tag_tag_id             ON image_tag (tag_id);
        """

        sqls += [s.strip() for s in idxs.split('\n') if s.strip()]

        for s in sqls:
            self.run_query_dict(s, commit=True)

        tags_exist = self.is_tags_exist()

        if not tags_exist:
            s = """insert or ignore into tag_type (tag_type_id, tag_type_name) values (?, ?)"""
            for tag_type in TagType:
                self.run_query_dict(s, (tag_type.value, tag_type.name), commit=True)

            self.insert_tags()


    @lru_cache
    def get_directory_id(self, directory: str) -> int:
        """
        Leverages a cache for id lookups.
        """
        if not directory:
            raise ValueError("Directory cannot be empty")

        if directory_id := self.directory_2_id.get(directory):
            return directory_id

        sql_string = '''insert or ignore into directory (directory) values (?) returning directory_id'''
        rows = self.run_query_tuple(sql_string, params=(directory,), commit=True)

        if not rows:
            # https://sqlite.org/lang_returning.html
            sql_select = '''select directory_id from directory where directory = ?'''
            rows = self.run_query_tuple(sql_select, params=(directory,))

        if not rows:
            raise ValueError(f"Failed to get directory_id for {directory=}")

        directory_id = int(rows[0][0])
        self.directory_2_id[directory] = directory_id
        return directory_id

    def insert_tags(self, tag_data: TagData=None):
        if not tag_data:
            tag_data = get_tag_data()

        params = [
            [(idx, tag_data.names[idx], TagType.rating.value) for idx in tag_data.rating],
            [(idx, tag_data.names[idx], TagType.general.value) for idx in tag_data.general],
            [(idx, tag_data.names[idx], TagType.character.value) for idx in tag_data.character],
        ]
        s = 'insert or ignore into tag (tag_id, tag_name, tag_type_id) values (?, ?, ?)'
        for params in params:
            self.run_query_many(s, params)

        tag_count = (self.run_query_tuple('select count(*) from tag'))[0][0]
        
        # TODO verify impact on tagger?
        #if tag_count != self.total_csv_tag_count: # TODO KBR allow adding new tags
        if tag_count < self.total_csv_tag_count:
            raise ValueError()

        self.save()
        print()
        print('Inserted all tags from csv into db successfully.')
        print('Now you should populate the database. Run the tagging script agains some images.')


    def insert_image_tags(self, directory_id: int, filename: str, ratings: dict, tag_id_2_prob: dict, sha256: str=None):
        general, sensitive, questionable, explicit = ratings[Ratings.general.value], ratings[Ratings.sensitive.value], ratings[Ratings.questionable.value], ratings[Ratings.explict.value]
        if sha256:
            sql_string = """
                insert into image (directory_id, filename, sha256, general, explicit, sensitive, questionable)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict(directory_id, filename) do update
                set
                    sha256        = excluded.sha256,
                    general       = excluded.general,
                    explicit      = excluded.explicit,
                    sensitive     = excluded.sensitive,
                    questionable  = excluded.questionable
                returning image_id
            """
            params = (directory_id, filename, sha256, general, explicit, sensitive, questionable)
        else:
            sql_string = """
                insert into image (directory_id, filename, general, explicit, sensitive, questionable)
                values (?, ?, ?, ?, ?, ?)
                on conflict(directory_id, filename) do update
                set
                    general       = excluded.general,
                    explicit      = excluded.explicit,
                    sensitive     = excluded.sensitive,
                    questionable  = excluded.questionable
                returning image_id
            """
            params = (directory_id, filename, general, explicit, sensitive, questionable)

        row = self.run_query_tuple(sql_string, params=params, commit=True)
        if not row:
            return

        image_id = int(row[0][0])
        if not image_id:
            raise ValueError(sql_string, params, image_id)

        params = [(image_id, tag_id, prob) for tag_id, prob in tag_id_2_prob.items()]
        try:
            self.run_query_many('insert into image_tag (image_id, tag_id, prob) values (?, ?, ?)', params)
        except sqlite3.IntegrityError as e:
            error_msg = str(e).join('\n')[:256]
            print(f'Unique constraint failed: {image_id=} {tag_id_2_prob=} {params=} {error_msg=}')


    def _fetch_results(self, image_ids: list[int]) -> list[dict]:
        if len(image_ids) < 1:
            return []

        phg = get_placeholders(image_ids)
        rows = self.run_query_tuple(f'''
            select
                image_id, directory, filename, general, explicit, sensitive, questionable
            from image join directory using (directory_id)
            where image_id in ({phg})
        ''', image_ids)
        if not rows:
            return []

        image_id_2_data = {row[0]: [row[1], row[2], row[3], row[4], row[5], row[6]] for row in rows}

        tags = self.run_query_tuple(f"""
            select image_tag.image_id, tag.tag_name, tag.tag_type_id, image_tag.prob
            from image_tag
                join tag on image_tag.tag_id = tag.tag_id
            where image_tag.image_id in ({phg})""",
            [k for k in image_id_2_data]
        )
        if not tags:
            return []

        results = {}
        tag_type_map = {TagType.rating.value: 'rating', TagType.general.value: 'general', TagType.character.value: 'character'}
        for image_id, (directory, filename, general, explicit, sensitive, questionable) in image_id_2_data.items():
            results[image_id] = {
                'image_id': image_id,
                'image_path': os.path.join(directory, filename),
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


    def get_tag_by_sha256(self, sha256: str) -> dict:
        row = (self.run_query_tuple('select image_id from image where sha256 = ?', (sha256,)))[0]
        if not row:
            return []
        result = self._fetch_result(row[0])
        return result


    def get_tags_by_tag_name(self, tag_name: str) -> list[dict]:
        s = """select distinct image_tag.image_id from tag join image_tag on tag.tag_id = image_tag.tag_id where tag.tag_name = ?"""
        rows = self.run_query_tuple(s, (tag_name,))
        if not rows:
            return []

        results = self._fetch_results([row[0] for row in rows])
        return results


    @lru_cache()
    def get_tags(self) -> list[tuple]:
        rows = self.run_query_tuple('select tag_id, lower(tag_name), tag_type_id from tag join tag_type using(tag_type_id) where tag_count > 0 order by lower(tag_name)')
        if not rows:
            return []
        return rows


    @lru_cache()
    def _get_image_count(self, date: str) -> int:
        sql = """select count(image_id) from image where general is not null;"""
        return int((self.run_query_tuple(sql))[0][0])


    def get_image_count(self) -> int:
        """Utilizes a daily cache."""
        return self._get_image_count(datetime.now().strftime('%Y%m%d'))


    def _get_all_images(self) -> list[dict]:
        """Used for testing on small data sets"""
        rows = self.run_query_tuple("""select image_id from image order by image_id""")

        if not rows:
            return []

        image_ids = [row[0] for row in rows]

        results = self._fetch_results(image_ids)
        return results


    def get_untagged_images(self) -> set[tuple[int, str, str]]:
        sql = f"""
        select
            directory_id, directory, filename
        from image
            join directory using (directory_id)
        where general is null
        """
        return set((row[0], row[1], row[2]) for row in (self.run_query_tuple(sql)))


    def get_images_by_tag_ids(self, tag_ids: list[int], f_tag: float, f_general: float, f_sensitive: float, f_explicit: float, f_questionable: float, page: int, per_page: int) -> list[dict]:
      
        total_rows = self.run_query_tuple(f"""
            select image_tag.image_id
            from image join image_tag using(image_id)
            where
                image_tag.tag_id in ({get_placeholders(tag_ids)})
                and image_tag.prob >= ?
                and general >= ?
                and sensitive >= ?
                and questionable >= ?
                and explicit >= ?
            group by image_tag.image_id
            having count(distinct image_tag.tag_id) = ?
            order by max(image_tag.prob) desc""",
            params=tag_ids + [f_tag, f_general, f_sensitive, f_questionable, f_explicit, len(tag_ids)]
        )
        if not total_rows:
          return [], 0
        
        offset = max(page - 1, 0) * per_page

        rows = self.run_query_tuple(f"""
            select image_tag.image_id
            from image join image_tag using(image_id)
            where
                image_tag.tag_id in ({get_placeholders(tag_ids)})
                and image_tag.prob >= ?
                and general >= ?
                and sensitive >= ?
                and questionable >= ?
                and explicit >= ?
            group by image_tag.image_id
            having count(distinct image_tag.tag_id) = ?
            order by max(image_tag.prob) desc
            limit ?
            offset ?""",
            params=tag_ids + [f_tag, f_general, f_sensitive, f_questionable, f_explicit, len(tag_ids), per_page, offset]
        )

        if not rows:
            return [],0

        image_ids = [row[0] for row in rows]

        results = self._fetch_results(image_ids)
        return results,len(total_rows)

    def update_tag_counts(self):
        sql_string = '''update tag set tag_count=
                 (select count(image_id) from image_tag where image_tag.tag_id=tag.tag_id) 
                  where exists 
                  (select * from image_tag where image_tag.tag_id = tag.tag_id)'''

# 90 percent probability
#update tag set tag_count_90=
#                 (select count(image_id) from image_tag where image_tag.tag_id=tag.tag_id and prob > 0.9) 
#                  where exists 
#                  (select * from image_tag where image_tag.tag_id = tag.tag_id)
 
 



        self.run_query_tuple(sql_string)

    def get_top_tags(self, choice, tagtype):
        
        target = "general";
        match choice:
            case "S":
                target = "sensitive";
            case "X":
                target = "explicit";
            case "Q":
                target = "questionable"
                
        view = "tags_for_images_prob60_v2"
        match tagtype:  # future support for other tagtype values, e.g. "artist"
            case "C":
                view = "char_tags_for_images_prob60_v2"
        
        sql_string = f"select tag_name, count(image_id) as imgcount, tag_id from {view} where {target}"
        sql_string += ''' >= 0.5
                        group by 1
                        order by imgcount desc
                        limit 25'''
        #        '''select tag_name, count(image_id) as imgcount from ''' 
        #             + view + ''' where ''' + target + 
        
        results = self._run_query(sql_string)
        #print(f'gtt: {results}')
        return results
         
    def get_common_tags(self, image_ids, tagtype, prob):
        # get all the tags in common amongst a set of images.
        # filter by tag type and probability
        
        sql = "";
        count = len(image_ids)
        curr = 1
        # A separate select clause for each tag, with intersect for tags 2+
        for imgid in image_ids:
            sql += f"select t.tag_id, t.tag_name from tag t join image_tag it on t.tag_id=it.tag_id where it.image_id={imgid} and it.prob >={prob} and t.tag_type_id={tagtype}"
            if curr != count: # no extra intersect
                sql += " INTERSECT "
            curr += 1
        sql += " order by tag_name asc"
        
        results = self._run_query(sql)
        #blah = [row["tag_name"] for row in results] # list of tag names
        
        #print(f"gct: {blah}")
        return results

    def delete_tags(self, image_ids, tags_to_delete):
        # remove the given tags from the given images
        for tag_id in tags_to_delete:
            sql = f"delete from image_tag where tag_id={tag_id} and image_id in (" + ','.join(map(str, image_ids)) + ")"
            self._run_query(sql, commit=True)
        
    def add_tags(self, image_ids, tags_to_add):
        # add the given tags for the given images
        
        for image_id in image_ids:
            for tag_id in tags_to_add:
                sql = f"insert or ignore into image_tag (image_id, tag_id, prob) values ({image_id},{tag_id},1.0)"
                self._run_query(sql, commit=True)
        
    def add_possibly_new_tags(self, image_ids, tags_to_add, tagTypeId):
        # This is a list of tags as strings, which may or may not exist. They are to be added to the specified images.
        
        for tagText in tags_to_add:
            sql = f"select tag_id from tag where tag_name = '{tagText}'"
            results = self._run_query(sql)
            if len(results) == 0:
                sql = f"select max(tag_id) as new_id from tag"
                results = self._run_query(sql)
                new_id = int(results[0]["new_id"]) + 1
                sql = f"insert or ignore into tag (tag_id, tag_name, tag_type_id, tag_count) values ({new_id}, '{tagText}', {tagTypeId}, 1)"
                self._run_query(sql, commit=True)
            else:
                new_id = int(results[0]["tag_id"])
                
            # add to images with new_id
            for image_id in image_ids:
                sql = f"insert or ignore into image_tag (image_id, tag_id, prob) values ({image_id},{new_id},1.0)"
                self._run_query(sql, commit=True)
