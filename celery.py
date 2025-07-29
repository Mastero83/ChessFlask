import importlib

celery_pkg = importlib.import_module('celery')
Celery = celery_pkg.Celery
AsyncResult = celery_pkg.result.AsyncResult
states = celery_pkg.states

celery = Celery('chessflask')


def init_celery(app):
    celery.conf.update(
        broker_url=app.config.get('CELERY_BROKER_URL'),
        result_backend=app.config.get('CELERY_RESULT_BACKEND')
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return super().__call__(*args, **kwargs)

    celery.Task = ContextTask
    return celery
