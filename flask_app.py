from flask import Flask, render_template, jsonify, request, redirect, url_for, send_file, session, g
from chess_engine import *
from chess_engine import StockfishEngine
import chess
import io
import os
import tempfile
import threading
import time
import uuid
from flask_socketio import SocketIO, emit
import subprocess
from pymongo import MongoClient
import chess.pgn
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
socketio = SocketIO(app, cors_allowed_origins="*")
app.secret_key = app.config['SECRET_KEY']

# In-memory PGN job storage
pgn_jobs = {}
pgn_jobs_library = {}

# MongoDB setup
mongo_client = MongoClient(app.config['MONGO_HOST'], 27017)
db = mongo_client['chessclub']
users_collection = db['users']
library_collection = db['library_games']
sessions_collection = db['sessions']

import functools

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

@app.before_request
def before_request():
    if request.endpoint not in ('static',):
        log_page_visit(request.endpoint)

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        session['username'] = username
        get_session_id()  # ensure session_id is set
        # Store user in MongoDB if not already present
        if username and not users_collection.find_one({'username': username}):
            users_collection.insert_one({'username': username})
        return redirect(url_for('startup'))
    return render_template('login.html')


# Update MENU_ITEMS for new sidebar structure
MENU_ITEMS = [
    {'name': 'Home', 'url': '/startup'},
    {'name': 'Play', 'url': '/play'},
    {'name': 'Library', 'url': None},  # Parent for tree menu
    {'name': 'Openings', 'url': '/openings'},
    {'name': 'Analysis (Placeholder)', 'url': '/analysis'},
    {'name': 'Annotate (Placeholder)', 'url': '/annotate'},
    {'name': 'Record/Film (Placeholder)', 'url': '/record'},
    {'name': 'Chess Club (Placeholder)', 'url': '/club'},
    {'name': 'Submit Ideas (Placeholder)', 'url': '/ideas'},
]

# Remove chess.com import menu item
MENU_ITEMS = [item for item in MENU_ITEMS if item.get('url') != '/upload_chesscom']

@app.route('/startup')
def startup():
    username = session.get('username')
    return render_template("startup.html", username=username, menu_items=MENU_ITEMS)

@app.route('/play')
def play():
    color = request.args.get('color', 'white')
    return render_template("index.html", color=color, menu_items=MENU_ITEMS, game_id=None)

@app.route('/openings', methods=['GET', 'POST'])
def openings():
    if request.method == 'POST':
        file = request.files.get('pgnfile')
        max_games = request.form.get('max_games', '1000')
        if file:
            pgn_data = file.read().decode('utf-8')
            job_id = str(uuid.uuid4())
            pgn_jobs[job_id] = {
                'status': 'processing',
                'games': [],
                'created_at': time.time(),
                'filename': file.filename,
                'pgn_data': pgn_data,
                'max_games': max_games
            }
            threading.Thread(target=process_pgn_job, args=(job_id, pgn_data, max_games)).start()
            return redirect(url_for('openings', job_id=job_id))
    job_id = request.args.get('job_id')
    games = []
    status = None
    if job_id and job_id in pgn_jobs:
        job = pgn_jobs[job_id]
        games = job.get('games', [])
        status = job.get('status', 'unknown')
    return render_template("openings.html", games=games, status=status, job_id=job_id)

@app.route('/openings_status/<job_id>')
def openings_status(job_id):
    job = pgn_jobs.get(job_id)
    if not job:
        return jsonify({'status': 'not_found'})
    return jsonify({'status': job['status'], 'games': job.get('games', []), 'progress': job.get('progress', 0), 'games_loaded': job.get('games_loaded', 0), 'total_games': job.get('total_games', 0)})

def process_pgn_job(job_id, pgn_data, max_games='1000'):
    import chess.pgn
    games = []
    pgn_io = io.StringIO(pgn_data)
    # Count total games for progress
    total_games = 0
    for _ in chess.pgn.read_headers(io.StringIO(pgn_data)):
        total_games += 1
    pgn_io.seek(0)
    loaded = 0
    if max_games == 'max':
        max_games = None
    else:
        max_games = int(max_games)
    while True:
        if max_games and loaded >= max_games:
            break
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            break
        headers = game.headers
        node = game
        moves = []
        for i in range(10):
            if node.variations:
                node = node.variations[0]
                moves.append(node.uci())
            else:
                moves.append(None)
        if not moves[0]:
            continue  # skip games with unknown first move
        game_dict = {
            'event': headers.get('Event', ''),
            'white': headers.get('White', ''),
            'black': headers.get('Black', ''),
            'result': headers.get('Result', ''),
            'date': headers.get('Date', ''),
            'round': headers.get('Round', ''),
            'site': headers.get('Site', ''),
            'eco': headers.get('ECO', ''),
            'index': len(games)
        }
        for i in range(10):
            game_dict[f'move_{i+1}'] = moves[i]
        games.append(game_dict)
        loaded += 1
        if total_games:
            pgn_jobs[job_id]['progress'] = int(loaded * 100 / total_games)
        else:
            pgn_jobs[job_id]['progress'] = 0
        pgn_jobs[job_id]['games_loaded'] = loaded
        pgn_jobs[job_id]['total_games'] = total_games
    pgn_jobs[job_id]['games'] = games
    pgn_jobs[job_id]['status'] = 'done'
    pgn_jobs[job_id]['progress'] = 100

@app.route('/get_pgn_game/<job_id>/<int:index>')
def get_pgn_game(job_id, index):
    job = pgn_jobs.get(job_id)
    if not job:
        return ''
    pgn_data = job.get('pgn_data', '')
    import chess.pgn
    pgn_io = io.StringIO(pgn_data)
    for i in range(index+1):
        game = chess.pgn.read_game(pgn_io)
    out = io.StringIO()
    exporter = chess.pgn.FileExporter(out)
    game.accept(exporter)
    return out.getvalue()

@app.route('/move/<int:depth>/<path:fen>/', methods=['GET', 'POST'])
def get_move(depth, fen):
    # Accept engine settings from frontend
    engine_settings = request.args.get('engine_settings')
    if not engine_settings and request.is_json:
        engine_settings = request.get_json().get('engine_settings')
    import json
    params = None
    if engine_settings:
        if isinstance(engine_settings, str):
            params = json.loads(engine_settings)
        else:
            params = engine_settings
    # If ELO settings are provided, ignore depth and use only ELO
    if params and params.get('UCI_LimitStrength') == 'true' and 'UCI_Elo' in params:
        sf = StockfishEngine(parameters=params)
    else:
        sf = StockfishEngine(depth=depth, parameters=params)
    
    if not sf.engine:
        return jsonify({'error': 'Stockfish engine not available'}), 503

    sf.set_fen(fen)
    move = sf.get_best_move()
    return move or ''

@app.route('/test/<string:tester>')
def test_get(tester):
    return tester

@app.route('/eval/<path:fen>/')
def get_eval(fen):
    sf = StockfishEngine()
    if not sf.engine:
        return '0' # Return a default evaluation if engine is not available
    sf.set_fen(fen)
    score = sf.get_evaluation()
    # score is a dict: {"type": "cp" or "mate", "value": int}
    if isinstance(score, dict):
        if score.get('type') == 'cp':
            return str(score.get('value', 0))
        elif score.get('type') == 'mate':
            return f"mate {score.get('value', 0)}"
        else:
            return '0'
    return str(score)

@app.route('/cheat_moves/<int:depth>/<path:fen>/')
def get_cheat_moves(depth, fen):
    import chess
    board = chess.Board(fen)
    sf = StockfishEngine(depth=depth)
    if not sf.engine:
        return jsonify([]) # Return empty list if engine is not available
    moves_scores = []
    for move in board.legal_moves:
        san = board.san(move)
        board.push(move)
        sf.set_fen(board.fen())
        eval_info = sf.get_evaluation()
        # Use centipawn value for sorting, mate is treated as very high/low value
        if eval_info['type'] == 'cp':
            score = eval_info['value']
        elif eval_info['type'] == 'mate':
            score = 100000 if eval_info['value'] > 0 else -100000
        else:
            score = 0
        board.pop()
        moves_scores.append({'san': san, 'score': score})
    reverse = board.turn == chess.WHITE
    moves_scores.sort(key=lambda x: x['score'], reverse=reverse)
    return jsonify(moves_scores[:5])

@app.route('/stockfish_move/<int:depth>/<path:fen>/')
def stockfish_move(depth, fen):
    sf = StockfishEngine(depth=depth)
    if not sf.engine:
        return jsonify({'error': 'Stockfish engine not available'}), 503
    sf.set_fen(fen)
    best_move = sf.get_best_move()
    evaluation = sf.get_evaluation()
    return jsonify({'best_move': best_move, 'evaluation': evaluation})

@socketio.on('start_stockfish_debug')
def start_stockfish_debug():
    stockfish_path = os.path.join(os.path.dirname(__file__), 'stockfish', 'stockfish.exe')
    if not os.path.exists(stockfish_path):
        from shutil import which
        stockfish_path = which('stockfish')
    
    if not stockfish_path:
        emit('debug_output', 'ERROR: Stockfish executable not found.')
        return

    try:
        process = subprocess.Popen([stockfish_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        emit('debug_output', 'Stockfish started...')
        def stream_output():
            for line in process.stdout:
                emit('debug_output', line.rstrip())
        threading.Thread(target=stream_output, daemon=True).start()
    except Exception as e:
        emit('debug_output', f"ERROR: Failed to start Stockfish: {e}")

@app.route('/analyze_game/', methods=['POST'])
def analyze_game():
    import chess
    import chess.pgn
    data = request.get_json()
    pgn = data.get('pgn')
    depth = int(data.get('depth', 5))
    game = chess.pgn.read_game(io.StringIO(pgn))
    board = game.board()
    sf = StockfishEngine(depth=depth)
    if not sf.engine:
        return jsonify({'evals': []}) # Return empty list if engine not available
    evals = []
    prev_eval = None
    for move in game.mainline_moves():
        board.push(move)
        sf.set_fen(board.fen())
        eval_info = sf.get_evaluation()
        if eval_info['type'] == 'cp':
            score = eval_info['value']
        elif eval_info['type'] == 'mate':
            score = 100000 if eval_info['value'] > 0 else -100000
        else:
            score = 0
        evals.append(score)
    return jsonify({'evals': evals})

@app.route('/upload')
def upload():
    return render_template('upload.html', menu_items=MENU_ITEMS)

@app.route('/process_pgn', methods=['POST'])
def process_pgn():
    file = request.files.get('pgnfile')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400
    pgn_data = file.read().decode('utf-8')
    job_id = str(uuid.uuid4())
    pgn_jobs_library[job_id] = {
        'progress': 0,
        'total_games': 0,
        'invalid_first_move': 0,
        'valid_games_count': 0,
        'done': False,
        'error': None
    }
    def process_job():
        try:
            import chess.pgn
            import io
            pgn_io = io.StringIO(pgn_data)
            total_games = 0
            invalid_first_move = 0
            valid_games = []
            while True:
                game = chess.pgn.read_game(pgn_io)
                if game is None:
                    break
                total_games += 1
                node = game
                moves = []
                move_annotations = []
                # Traverse the mainline and collect moves and comments
                while node.variations:
                    next_node = node.variations[0]
                    moves.append(next_node.uci())
                    # Store comment for this move (if any)
                    comment = next_node.comment if hasattr(next_node, 'comment') else ''
                    move_annotations.append(comment)
                    node = next_node
                if not moves:
                    invalid_first_move += 1
                    continue
                game_dict = {
                    'headers': dict(game.headers),
                    'moves': moves,
                    'move_annotations': move_annotations
                }
                valid_games.append(game_dict)
                # Update progress every 10 games
                if total_games % 10 == 0:
                    pgn_jobs_library[job_id]['progress'] = int((total_games / (total_games + 1)) * 100)
                    pgn_jobs_library[job_id]['total_games'] = total_games
                    pgn_jobs_library[job_id]['invalid_first_move'] = invalid_first_move
                    pgn_jobs_library[job_id]['valid_games_count'] = len(valid_games)
            # Final update
            pgn_jobs_library[job_id]['progress'] = 100
            pgn_jobs_library[job_id]['total_games'] = total_games
            pgn_jobs_library[job_id]['invalid_first_move'] = invalid_first_move
            pgn_jobs_library[job_id]['valid_games_count'] = len(valid_games)
            pgn_jobs_library[job_id]['valid_games'] = valid_games
            pgn_jobs_library[job_id]['done'] = True
        except Exception as e:
            pgn_jobs_library[job_id]['error'] = str(e)
            pgn_jobs_library[job_id]['done'] = True
    threading.Thread(target=process_job, daemon=True).start()
    return jsonify({'job_id': job_id})

@app.route('/pgn_progress/<job_id>')
def pgn_progress(job_id):
    job = pgn_jobs_library.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    # Don't send all games until done
    resp = {
        'progress': job['progress'],
        'total_games': job['total_games'],
        'invalid_first_move': job['invalid_first_move'],
        'valid_games_count': job['valid_games_count'],
        'done': job['done'],
        'error': job['error']
    }
    if job.get('done') and 'valid_games' in job:
        resp['valid_games'] = job['valid_games']
    return jsonify(resp)

@app.route('/save_to_library', methods=['POST'])
def save_to_library():
    data = request.get_json()
    opening = data.get('opening')
    games = data.get('games')
    debug = {}
    if not games:
        return jsonify({'error': 'No games to save'}), 400
    # Save each game as a document with the opening
    docs = []
    for g in games:
        doc = {
            'opening': opening,
            'headers': g.get('headers', {}),
            'moves': g.get('moves', [])
        }
        if 'move_annotations' in g:
            doc['move_annotations'] = g['move_annotations']
        docs.append(doc)
    result = library_collection.insert_many(docs)
    debug['inserted_ids'] = [str(_id) for _id in result.inserted_ids]
    debug['count'] = len(result.inserted_ids)
    return jsonify({'status': 'ok', 'debug': debug})

@app.route('/library')
def library():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    search = request.args.get('search', '').strip()
    query = {}
    if search:
        regex = {'$regex': search, '$options': 'i'}
        query = {'$or': [
            {'opening': regex},
            {'headers.White': regex},
            {'headers.Black': regex},
            {'headers.Date': regex},
            {'headers.Result': regex},
            {'headers.Event': regex},
            {'headers.Site': regex},
        ]}
    total_games = library_collection.count_documents(query)
    games = list(library_collection.find(query, {'_id': 1, 'headers': 1, 'opening': 1, 'moves': 1})
                .skip((page-1)*per_page).limit(per_page))
    for g in games:
        g['id'] = str(g['_id'])
    # Get all matching games for move logic and next-move panel
    all_games = list(library_collection.find(query, {'_id': 1, 'headers': 1, 'opening': 1, 'moves': 1}))
    for g in all_games:
        g['id'] = str(g['_id'])
    return render_template('library.html', games=games, all_games=all_games, page=page, per_page=per_page, total_games=total_games, search=search, menu_items=MENU_ITEMS)

@app.route('/openings_list')
def openings_list():
    # Return all unique opening names in the library
    openings = library_collection.distinct('opening')
    openings = [o for o in openings if o]  # Remove empty/null
    openings.sort()
    return jsonify({'openings': openings})

@app.route('/analysis')
def analysis():
    return render_template('placeholder.html', title='Analysis Page', menu_items=MENU_ITEMS)

@app.route('/annotate')
def annotate():
    return render_template('placeholder.html', title='Annotate Game', menu_items=MENU_ITEMS)

@app.route('/record')
def record():
    return render_template('placeholder.html', title='Record/Film Game', menu_items=MENU_ITEMS)

@app.route('/club')
def club():
    return render_template('placeholder.html', title='Chess Club Module', menu_items=MENU_ITEMS)

@app.route('/ideas')
def ideas():
    return render_template('placeholder.html', title='Submit Improvement Ideas', menu_items=MENU_ITEMS)

@app.route('/library_management')
def library_management():
    # Aggregate unique openings and their game counts
    pipeline = [
        {"$group": {"_id": "$opening", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    results = list(library_collection.aggregate(pipeline))
    openings = [
        {"name": r["_id"], "count": r["count"]}
        for r in results if r["_id"]
    ]
    return render_template('library_management.html', openings=openings, menu_items=MENU_ITEMS)

@app.route('/delete_opening', methods=['POST'])
def delete_opening():
    data = request.get_json()
    opening = data.get('opening')
    if not opening:
        return jsonify({'error': 'No opening specified'}), 400
    result = library_collection.delete_many({'opening': opening})
    return jsonify({'status': 'ok', 'deleted_count': result.deleted_count})

@app.route('/download_pgn/<opening>')
def download_pgn(opening):
    import chess.pgn
    import io
    # Find all games for this opening
    games = list(library_collection.find({'opening': opening}))
    pgn_io = io.StringIO()
    for game in games:
        headers = game.get('headers', {})
        moves = game.get('moves', [])
        annotations = game.get('move_annotations', [])
        # Build PGN game
        board = chess.Board()
        pgn_game = chess.pgn.Game()
        for k, v in headers.items():
            if v:
                pgn_game.headers[k] = v
        node = pgn_game
        for idx, move_uci in enumerate(moves):
            move = board.parse_uci(move_uci)
            node = node.add_variation(move)
            # Add annotation as comment if present
            if idx < len(annotations) and annotations[idx]:
                node.comment = annotations[idx]
            board.push(move)
        exporter = chess.pgn.FileExporter(pgn_io)
        pgn_game.accept(exporter)
        pgn_io.write('\n')
    pgn_str = pgn_io.getvalue()
    return (pgn_str, 200, {
        'Content-Type': 'application/x-chess-pgn',
        'Content-Disposition': f'attachment; filename="{opening}.pgn"'
    })

# Remove /user-usage and /api/user-usage routes and references

@app.route('/logoff')
def logoff():
    end_session()
    return redirect(url_for('login'))

@app.route('/play_game/<game_id>')
def play_game(game_id):
    game = library_collection.find_one({'_id': uuid.UUID(game_id) if '-' in game_id else game_id})
    color = request.args.get('color', 'white')
    move_annotations = {}
    game_json = None
    if game:
        # Remove _id for frontend safety
        game_json = dict(game)
        game_json.pop('_id', None)
        if 'move_annotations' in game:
            # Convert list to {ply: annotation} format (1-based)
            move_annotations = {str(i+1): ann for i, ann in enumerate(game['move_annotations']) if ann}
    return render_template("index.html", color=color, menu_items=MENU_ITEMS, move_annotations=move_annotations, game_json=game_json, game_id=game_id)

@app.route('/api/game_json/<game_id>')
def api_game_json(game_id):
    game = library_collection.find_one({'_id': uuid.UUID(game_id) if '-' in game_id else game_id})
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    game_json = dict(game)
    game_json.pop('_id', None)
    return jsonify({'game': game_json})

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
