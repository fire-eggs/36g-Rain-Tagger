from flask import Flask, g

from bp import bp
from celery_app import create_celery_app
from configs import debug, exts, host, port, root_folder, use_celery
from db import get_db


def create_flask_app() -> Flask:
    flask_app = Flask(__name__)
    flask_app.register_blueprint(bp)
    flask_app.root_folder = root_folder
    flask_app.exts = exts

    celery_app = create_celery_app(flask_app) if use_celery else None
    flask_app.extensions['celery'] = celery_app
    return flask_app


print('flask_app, building')
flask_app = create_flask_app()
print('flask_app, created')

print('celery_app, building')
celery_app = flask_app.extensions['celery']
print('celery_app, created')


@flask_app.teardown_request
def close_connection(e):
    db = getattr(g, '_database', None)
    if db is not None:
        get_db().close()


if __name__=='__main__':
    print('flask_app.run, starting')
    # gunicorn -b 127.0.0.1:8000 -w 1 --threads 1 web:flask_app
    flask_app.run(host=host, port=port, debug=debug)
    print('flask_app.run, exiting')
