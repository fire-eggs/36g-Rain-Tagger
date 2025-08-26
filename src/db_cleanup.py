# Using configs.toml, removes all image references where the physical file
# doesn't exist.

import os
from configs import TaggerConfigs, configs
from db import ImageDb

class DbCleanup:
    def __init__(self, configs: TaggerConfigs):
        self.configs: TaggerConfigs = configs

        self.db: ImageDb = ImageDb(self.configs.db_path, self.configs.sql_echo)

    def run_cleanup(self):

        sql = f"""
        select
            directory_id, directory, filename, image_id
        from image
            join directory using (directory_id)
        """

        results = self.db._run_query(sql)
        print(f"count: {len(results)}")
        
        # ?do this by pages using LIMIT and OFFSET

        for result in results:
          fullpath = os.path.join(result['directory'], result['filename'])
          if not os.path.exists(fullpath):
            print(f"Missing! {result['image_id']}:{fullpath}")
            self.db._run_query("delete from image_tag where image_id=?", (result['image_id'],))
            self.db._run_query("delete from image where image_id=?", (result['image_id'],),commit=True)

        # TODO tag.tag_count is now inaccurate            
        
        # TODO should there be a delete trigger on image.image_id ?

        # TODO can the database be compacted?
        
if __name__ == '__main__':
    util = DbCleanup(configs)
    util.run_cleanup()
