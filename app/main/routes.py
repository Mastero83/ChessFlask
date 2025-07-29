from flask import render_template, request, session
from . import bp
from .. import utils


MENU_ITEMS = [
    {'name': 'Home', 'url': '/startup'},
    {'name': 'Play', 'url': '/play'},
    {'name': 'Library', 'url': None},
    {'name': 'Openings', 'url': '/openings'},
    {'name': 'Analysis (Placeholder)', 'url': '/analysis'},
    {'name': 'Annotate (Placeholder)', 'url': '/annotate'},
    {'name': 'Record/Film (Placeholder)', 'url': '/record'},
    {'name': 'Chess Club (Placeholder)', 'url': '/club'},
    {'name': 'Submit Ideas (Placeholder)', 'url': '/ideas'},
]

MENU_ITEMS = [item for item in MENU_ITEMS if item.get('url') != '/upload_chesscom']


@bp.route('/startup')
def startup():
    username = session.get("username")
    return render_template('startup.html', username=username, menu_items=MENU_ITEMS)


@bp.route('/play')
def play():
    color = request.args.get('color', 'white')
    return render_template('index.html', color=color, menu_items=MENU_ITEMS, game_id=None)


@bp.route('/analysis')
def analysis():
    return render_template('placeholder.html', title='Analysis Page', menu_items=MENU_ITEMS)


@bp.route('/annotate')
def annotate():
    return render_template('placeholder.html', title='Annotate Game', menu_items=MENU_ITEMS)


@bp.route('/record')
def record():
    return render_template('placeholder.html', title='Record/Film Game', menu_items=MENU_ITEMS)


@bp.route('/club')
def club():
    return render_template('placeholder.html', title='Chess Club Module', menu_items=MENU_ITEMS)


@bp.route('/ideas')
def ideas():
    return render_template('placeholder.html', title='Submit Improvement Ideas', menu_items=MENU_ITEMS)

