import io
import os
import threading
import subprocess
import chess
import chess.pgn
import uuid
from flask import jsonify, request
from flask_socketio import SocketIO, emit

from chess_engine import StockfishEngine
from . import bp
from .. import utils

socketio = SocketIO(cors_allowed_origins="*")


@bp.route('/move/<int:depth>/<path:fen>/', methods=['GET', 'POST'])
def get_move(depth, fen):
    engine_settings = request.args.get('engine_settings')
    if not engine_settings and request.is_json:
        engine_settings = request.get_json().get('engine_settings')
    params = None
    if engine_settings:
        if isinstance(engine_settings, str):
            import json
            params = json.loads(engine_settings)
        else:
            params = engine_settings
    if params and params.get('UCI_LimitStrength') == 'true' and 'UCI_Elo' in params:
        sf = StockfishEngine(parameters=params)
    else:
        sf = StockfishEngine(depth=depth, parameters=params)
    if not sf.engine:
        return jsonify({'error': 'Stockfish engine not available'}), 503
    sf.set_fen(fen)
    move = sf.get_best_move()
    return move or ''


@bp.route('/test/<string:tester>')
def test_get(tester):
    return tester


@bp.route('/eval/<path:fen>/')
def get_eval(fen):
    sf = StockfishEngine()
    if not sf.engine:
        return '0'
    sf.set_fen(fen)
    score = sf.get_evaluation()
    if isinstance(score, dict):
        if score.get('type') == 'cp':
            return str(score.get('value', 0))
        elif score.get('type') == 'mate':
            return f"mate {score.get('value', 0)}"
        else:
            return '0'
    return str(score)


@bp.route('/cheat_moves/<int:depth>/<path:fen>/')
def get_cheat_moves(depth, fen):
    board = chess.Board(fen)
    sf = StockfishEngine(depth=depth)
    if not sf.engine:
        return jsonify([])
    moves_scores = []
    for move in board.legal_moves:
        san = board.san(move)
        board.push(move)
        sf.set_fen(board.fen())
        eval_info = sf.get_evaluation()
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


@bp.route('/stockfish_move/<int:depth>/<path:fen>/')
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


@bp.route('/analyze_game/', methods=['POST'])
def analyze_game():
    data = request.get_json()
    pgn = data.get('pgn')
    depth = int(data.get('depth', 5))
    game = chess.pgn.read_game(io.StringIO(pgn))
    board = game.board()
    sf = StockfishEngine(depth=depth)
    if not sf.engine:
        return jsonify({'evals': []})
    evals = []
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


@bp.route('/api/game_json/<game_id>')
def api_game_json(game_id):
    game = utils.library_collection.find_one({'_id': uuid.UUID(game_id) if '-' in game_id else game_id})
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    game_json = dict(game)
    game_json.pop('_id', None)
    return jsonify({'game': game_json})

