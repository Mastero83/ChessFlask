from flask import Flask, render_template, jsonify
from chess_engine import *
import chess

app = Flask(__name__)

@app.route('/')
def index():
    return render_template("index.html")


@app.route('/move/<int:depth>/<path:fen>/')
def get_move(depth, fen):
    print(depth)
    print("Calculating...")
    engine = Engine(fen)
    move = engine.iterative_deepening(depth - 1)
    print("Move found!", move)
    print()
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
    # Sort by score (descending for white, ascending for black)
    reverse = board.turn == chess.WHITE
    moves_scores.sort(key=lambda x: x['score'], reverse=reverse)
    # Return up to 5 best moves
    return jsonify(moves_scores[:5])


if __name__ == '__main__':
    app.run(debug=True)