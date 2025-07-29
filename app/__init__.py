from flask import Flask, request
from config import Config
from . import utils


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    from .main import bp as main_bp
    app.register_blueprint(main_bp)
    from .api import bp as api_bp
    app.register_blueprint(api_bp)
    from .library import bp as library_bp
    app.register_blueprint(library_bp)
    from .auth import bp as auth_bp
    app.register_blueprint(auth_bp)

    @app.before_request
    def before_request():
        if request.endpoint not in ('static',):
            utils.log_page_visit(request.endpoint)

    return app
