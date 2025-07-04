from flask import Flask, render_template, jsonify, request, redirect, url_for, send_file, session
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

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
app.secret_key = 'chessflask_secret_key'

# In-memory PGN job storage
pgn_jobs = {}

@app.route('/')
def startup():
    return render_template("startup.html")

@app.route('/play')
def play():
    return render_template("index.html")

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

@app.route('/move/<int:depth>/<path:fen>/')
def get_move(depth, fen):
    sf = StockfishEngine(depth=depth)
    sf.set_fen(fen)
    move = sf.get_best_move()
    return move or ''

@app.route('/test/<string:tester>')
def test_get(tester):
    return tester

@app.route('/eval/<path:fen>/')
def get_eval(fen):
    sf = StockfishEngine()
    sf.set_fen(fen)
    score = sf.get_evaluation()
    return str(score)

@app.route('/cheat_moves/<int:depth>/<path:fen>/')
def get_cheat_moves(depth, fen):
    import chess
    board = chess.Board(fen)
    sf = StockfishEngine(depth=depth)
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
    sf.set_fen(fen)
    best_move = sf.get_best_move()
    evaluation = sf.get_evaluation()
    return jsonify({'best_move': best_move, 'evaluation': evaluation})

@socketio.on('start_stockfish_debug')
def start_stockfish_debug():
    stockfish_path = os.path.join(os.path.dirname(__file__), 'stockfish', 'stockfish.exe')
    process = subprocess.Popen([stockfish_path], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    emit('debug_output', 'Stockfish started...')
    def stream_output():
        for line in process.stdout:
            emit('debug_output', line.rstrip())
    threading.Thread(target=stream_output, daemon=True).start()

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

if __name__ == '__main__':
    socketio.run(app, debug=True)