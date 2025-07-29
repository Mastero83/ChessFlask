from flask import render_template, redirect, url_for, request, session
from . import bp
from .. import utils


@bp.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        session['username'] = username
        utils.get_session_id()
        if username and not utils.users_collection.find_one({'username': username}):
            utils.users_collection.insert_one({'username': username})
        return redirect(url_for('main.startup'))
    return render_template('login.html')


@bp.route('/logoff')
def logoff():
    utils.end_session()
    return redirect(url_for('auth.login'))
