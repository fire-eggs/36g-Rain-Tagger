from celery import Celery, Task
from flask import Flask, g

from bp import bp
from configs import debug, exts, host, port, root_folder
from db import get_db


def create_celery_app(flask_app: Flask) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with flask_app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(flask_app.name, task_cls=FlaskTask)
    celery_app.config_from_object(flask_app.config['CELERY'])
    celery_app.set_default()
    flask_app.extensions['celery'] = celery_app
    return celery_app


def create_flask_app() -> Flask:
    flask_app = Flask(__name__)
    flask_app.register_blueprint(bp)
    flask_app.root_folder = root_folder
    flask_app.exts = exts

    flask_app.config.from_mapping(
        CELERY=dict(
            broker_url='redis://localhost:6379',
            result_backend='redis://localhost:6379',
            task_ignore_result=True,
            broker_connection_retry_on_startup=False,
        ),
    )
    create_celery_app(flask_app)
    return flask_app


print('flask_app, starting')
flask_app = create_flask_app()
celery_app = flask_app.extensions['celery']
print('flask_app, created')


@flask_app.teardown_request
def close_connection(e):
    db = getattr(g, '_database', None)
    if db is not None:
        get_db().close()


if __name__=='__main__':
    print('flask_app.fun, starting')
    # gunicorn -b 127.0.0.1:8000 -w 1 --threads 1 web:flask_app
    flask_app.run(host=host, port=port, debug=debug)
    print('flask_app.fun, complete')
