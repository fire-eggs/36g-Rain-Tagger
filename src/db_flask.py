import sqlite3
from flask import g

from db import ImageDb
from sqlitedb import row_factory


class FlaskImageDb(ImageDb):
    def __init__(self, db_path, sql_echo=False):
        super().__init__(db_path, sql_echo=sql_echo)


    def get_db(self):
        if 'db' not in g:
            g.db = sqlite3.connect(self.db_path)
            g.db.row_factory = row_factory
        return g.db


    def save(self):
        self.get_db().commit()


    def close(self):
        db = g.pop('db', None)
        if db:
            db.close()


    def save_and_close(self):
        self.save()
        self.close()


    def _set_row_factory(self, dict_row: bool):
        db = self.get_db()
        if dict_row and not db.row_factory:
            db.row_factory = row_factory
        elif not dict_row and db.row_factory:
            db.row_factory = None


    def _run_query(self, sql_string: str, params: tuple=None, commit: bool=False, dict_row: bool=True):
        if self.sql_echo:
            print(f'{sql_string=}\n{params=}')

        self._set_row_factory(dict_row)

        cursor = self.get_db().execute(sql_string, params or ())
        results = cursor.fetchall()
        cursor.close()

        if commit:
            self.get_db().commit()

        return results
