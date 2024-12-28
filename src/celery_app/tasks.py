from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from shared import app_process_images_from_paths


@shared_task(ignore_result=False, soft_time_limit=16, expires=60*60, max_retries=0, rate_limit='2/s')
def task_process_images_from_paths(img_path: str, page: int, per_page: int):
    try:
        import time
        time.sleep(10)
        return app_process_images_from_paths(img_path, page, per_page)
    except SoftTimeLimitExceeded:
        return {
            'message': f'Yikes... there was a time limit exception thrown...',
            'results': [{}]
        }
