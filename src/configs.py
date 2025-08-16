import os

import toml

from enums import Ext
from utils import make_path


config_path = make_path('..', 'configs.toml')


try:
    with open(config_path, 'r') as f:
        user_configs = toml.load(f)
except FileNotFoundError:
    raise FileNotFoundError(f"Config file not found: {config_path}")
except toml.TomlDecodeError:
    raise ValueError(f"Invalid TOML format in config file: {config_path}")


class TaggerConfigs:
    def __init__(self, configs: dict):
        self.root_path = os.path.realpath(configs['root_path'])
        assert os.path.isdir(self.root_path), self.root_path

        self.db_path = configs.get('db_path', make_path('..', '36g.db'))
        self.sql_echo = configs.get('sql_echo', False)
        self.sql_insert_batch_size = configs.get('sql_insert_batch_size', 10_000)
        self.commit_tags = configs.get('commit_tags', True)

        self.cpu = configs.get('cpu', False)
        self.tag_model_repo_id = configs.get('tag_model_repo_id', 'SmilingWolf/wd-swinv2-tagger-v3')

        self.process_n_files_together = configs.get('process_n_files_together', 1)
        self.process_n_files = configs.get('process_n_files', 0)

        self.min_general_tag_val = configs.get('min_general_tag_val', 0.2)
        self.min_character_tag_val = configs.get('min_character_tag_val', 0.2)

        self.commit_sha256 = configs.get('commit_sha256', True)

        valid_extensions = configs.get('valid_extensions', 'png,jpeg,jpg,gif')
        self.valid_extensions = tuple([v.strip() for v in valid_extensions.split(',')])
        assert self.valid_extensions, self.valid_extensions
        for v in self.valid_extensions: Ext[v]

        self.host = configs.get('host')
        self.port = configs.get('port')
        self.debug = configs.get('debug')
        self.allow_file_upload_search = configs.get('allow_file_upload_search', False)
        self.web_media_roots = tuple(configs.get('web_media_roots', []))


configs = TaggerConfigs(user_configs)
