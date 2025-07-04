from flask import Flask, render_template, jsonify, request, redirect, url_for, send_file, session
from chess_engine import *
import chess
import io
import os
import tempfile
import threading
import time
import uuid

app = Flask(__name__)
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
        if file:
            pgn_data = file.read().decode('utf-8')
            job_id = str(uuid.uuid4())
            pgn_jobs[job_id] = {
                'status': 'processing',
                'games': [],
                'created_at': time.time(),
                'filename': file.filename,
                'pgn_data': pgn_data
            }
            threading.Thread(target=process_pgn_job, args=(job_id, pgn_data)).start()
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
    return jsonify({'status': job['status'], 'games': job.get('games', [])})

def process_pgn_job(job_id, pgn_data):
    import chess.pgn
    max_games = 10
    games = []
    pgn_io = io.StringIO(pgn_data)
    count = 0
    while count < max_games:
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            break
        headers = game.headers
        games.append({
            'event': headers.get('Event', ''),
            'white': headers.get('White', ''),
            'black': headers.get('Black', ''),
            'result': headers.get('Result', ''),
            'date': headers.get('Date', ''),
            'round': headers.get('Round', ''),
            'site': headers.get('Site', ''),
            'eco': headers.get('ECO', ''),
            'index': len(games)
        })
        count += 1
    pgn_jobs[job_id]['games'] = games
    pgn_jobs[job_id]['status'] = 'done'

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
    engine = Engine(fen)
    move = engine.iterative_deepening(depth - 1)
    return move

@app.route('/test/<string:tester>')
def test_get(tester):
    return tester

@app.route('/eval/<path:fen>/')
def get_eval(fen):
    engine = Engine(fen)
    score = engine.position_eval()
    return str(score)

@app.route('/cheat_moves/<int:depth>/<path:fen>/')
def get_cheat_moves(depth, fen):
    engine = Engine(fen)
    board = engine.board
    moves_scores = []
    for move in list(board.legal_moves):
        san = board.san(move)
        board.push(move)
        score = engine.position_eval()
        board.pop()
        moves_scores.append({'san': san, 'score': score})
    reverse = board.turn == chess.WHITE
    moves_scores.sort(key=lambda x: x['score'], reverse=reverse)
    return jsonify(moves_scores[:5])

if __name__ == '__main__':
    app.run(debug=True)