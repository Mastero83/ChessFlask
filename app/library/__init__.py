from flask import Blueprint

bp = Blueprint('library', __name__)

from . import routes
