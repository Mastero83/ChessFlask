import time
import uuid
from flask import request, session
from pymongo import MongoClient
from config import Config

# Database setup
mongo_client = MongoClient(Config.MONGO_HOST, 27017)
db = mongo_client['chessclub']
users_collection = db['users']
library_collection = db['library_games']
sessions_collection = db['sessions']

# In-memory PGN job storage
pgn_jobs = {}
pgn_jobs_library = {}


def get_session_id():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    return session['session_id']


def log_page_visit(endpoint):
    session_id = get_session_id()
    username = session.get('username')
    now = time.time()
    page = request.path
    sessions_collection.update_one(
        {'session_id': session_id},
        {'$push': {'pages_visited': {'page': page, 'endpoint': endpoint, 'timestamp': now}},
         '$setOnInsert': {'username': username, 'session_id': session_id, 'start_time': now}},
        upsert=True
    )


def end_session():
    session_id = session.get('session_id')
    if not session_id:
        return
    now = time.time()
    sess = sessions_collection.find_one({'session_id': session_id})
    if sess and 'start_time' in sess:
        duration = now - sess['start_time']
        sessions_collection.update_one(
            {'session_id': session_id},
            {'$set': {'end_time': now, 'duration': duration}}
        )
    session.pop('session_id', None)
    session.pop('username', None)

