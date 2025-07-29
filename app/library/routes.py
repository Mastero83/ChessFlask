import time
import io
import threading
import uuid
import chess
from ..main.routes import MENU_ITEMS
import chess.pgn
from flask import render_template, request, jsonify, redirect, url_for

from . import bp
from .. import utils


def process_pgn_job(job_id, pgn_data, max_games='1000'):
    games = []
    pgn_io = io.StringIO(pgn_data)
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
            continue
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
            utils.pgn_jobs[job_id]['progress'] = int(loaded * 100 / total_games)
        else:
            utils.pgn_jobs[job_id]['progress'] = 0
        utils.pgn_jobs[job_id]['games_loaded'] = loaded
        utils.pgn_jobs[job_id]['total_games'] = total_games
    utils.pgn_jobs[job_id]['games'] = games
    utils.pgn_jobs[job_id]['status'] = 'done'
    utils.pgn_jobs[job_id]['progress'] = 100


@bp.route('/openings', methods=['GET', 'POST'])
def openings():
    if request.method == 'POST':
        file = request.files.get('pgnfile')
        max_games = request.form.get('max_games', '1000')
        if file:
            pgn_data = file.read().decode('utf-8')
            job_id = str(uuid.uuid4())
            utils.pgn_jobs[job_id] = {
                'status': 'processing',
                'games': [],
                'created_at': time.time(),
                'filename': file.filename,
                'pgn_data': pgn_data,
                'max_games': max_games
            }
            threading.Thread(target=process_pgn_job, args=(job_id, pgn_data, max_games)).start()
            return redirect(url_for('library.openings', job_id=job_id))
    job_id = request.args.get('job_id')
    games = []
    status = None
    if job_id and job_id in utils.pgn_jobs:
        job = utils.pgn_jobs[job_id]
        games = job.get('games', [])
        status = job.get('status', 'unknown')
    return render_template('openings.html', games=games, status=status, job_id=job_id)


@bp.route('/openings_status/<job_id>')
def openings_status(job_id):
    job = utils.pgn_jobs.get(job_id)
    if not job:
        return jsonify({'status': 'not_found'})
    return jsonify({'status': job['status'], 'games': job.get('games', []), 'progress': job.get('progress', 0), 'games_loaded': job.get('games_loaded', 0), 'total_games': job.get('total_games', 0)})


@bp.route('/get_pgn_game/<job_id>/<int:index>')
def get_pgn_game(job_id, index):
    job = utils.pgn_jobs.get(job_id)
    if not job:
        return ''
    pgn_data = job.get('pgn_data', '')
    pgn_io = io.StringIO(pgn_data)
    for _ in range(index + 1):
        game = chess.pgn.read_game(pgn_io)
    out = io.StringIO()
    exporter = chess.pgn.FileExporter(out)
    game.accept(exporter)
    return out.getvalue()


@bp.route('/upload')
def upload():
    return render_template('upload.html', menu_items=bp.menu_items if hasattr(bp, 'menu_items') else [])


@bp.route('/process_pgn', methods=['POST'])
def process_pgn():
    file = request.files.get('pgnfile')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400
    pgn_data = file.read().decode('utf-8')
    job_id = str(uuid.uuid4())
    utils.pgn_jobs_library[job_id] = {
        'progress': 0,
        'total_games': 0,
        'invalid_first_move': 0,
        'valid_games_count': 0,
        'done': False,
        'error': None
    }

    def process_job():
        try:
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
                while node.variations:
                    next_node = node.variations[0]
                    moves.append(next_node.uci())
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
                if total_games % 10 == 0:
                    utils.pgn_jobs_library[job_id]['progress'] = int((total_games / (total_games + 1)) * 100)
                    utils.pgn_jobs_library[job_id]['total_games'] = total_games
                    utils.pgn_jobs_library[job_id]['invalid_first_move'] = invalid_first_move
                    utils.pgn_jobs_library[job_id]['valid_games_count'] = len(valid_games)
            utils.pgn_jobs_library[job_id]['progress'] = 100
            utils.pgn_jobs_library[job_id]['total_games'] = total_games
            utils.pgn_jobs_library[job_id]['invalid_first_move'] = invalid_first_move
            utils.pgn_jobs_library[job_id]['valid_games_count'] = len(valid_games)
            utils.pgn_jobs_library[job_id]['valid_games'] = valid_games
            utils.pgn_jobs_library[job_id]['done'] = True
        except Exception as e:
            utils.pgn_jobs_library[job_id]['error'] = str(e)
            utils.pgn_jobs_library[job_id]['done'] = True

    threading.Thread(target=process_job, daemon=True).start()
    return jsonify({'job_id': job_id})


@bp.route('/pgn_progress/<job_id>')
def pgn_progress(job_id):
    job = utils.pgn_jobs_library.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
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


@bp.route('/save_to_library', methods=['POST'])
def save_to_library():
    data = request.get_json()
    opening = data.get('opening')
    games = data.get('games')
    debug = {}
    if not games:
        return jsonify({'error': 'No games to save'}), 400
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
    result = utils.library_collection.insert_many(docs)
    debug['inserted_ids'] = [str(_id) for _id in result.inserted_ids]
    debug['count'] = len(result.inserted_ids)
    return jsonify({'status': 'ok', 'debug': debug})


@bp.route('/library')
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
    total_games = utils.library_collection.count_documents(query)
    games = list(utils.library_collection.find(query, {'_id': 1, 'headers': 1, 'opening': 1, 'moves': 1})
                                  .skip((page - 1) * per_page).limit(per_page))
    for g in games:
        g['id'] = str(g['_id'])
    all_games = list(utils.library_collection.find(query, {'_id': 1, 'headers': 1, 'opening': 1, 'moves': 1}))
    for g in all_games:
        g['id'] = str(g['_id'])
    return render_template('library.html', games=games, all_games=all_games, page=page, per_page=per_page, total_games=total_games, search=search, menu_items=bp.menu_items if hasattr(bp, 'menu_items') else [])


@bp.route('/openings_list')
def openings_list():
    openings = utils.library_collection.distinct('opening')
    openings = [o for o in openings if o]
    openings.sort()
    return jsonify({'openings': openings})


@bp.route('/library_management')
def library_management():
    pipeline = [
        {"$group": {"_id": "$opening", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    results = list(utils.library_collection.aggregate(pipeline))
    openings = [
        {"name": r["_id"], "count": r["count"]}
        for r in results if r["_id"]
    ]
    return render_template('library_management.html', openings=openings, menu_items=bp.menu_items if hasattr(bp, 'menu_items') else [])


@bp.route('/delete_opening', methods=['POST'])
def delete_opening():
    data = request.get_json()
    opening = data.get('opening')
    if not opening:
        return jsonify({'error': 'No opening specified'}), 400
    result = utils.library_collection.delete_many({'opening': opening})
    return jsonify({'status': 'ok', 'deleted_count': result.deleted_count})


@bp.route('/download_pgn/<opening>')
def download_pgn(opening):
    pgn_io = io.StringIO()
    games = list(utils.library_collection.find({'opening': opening}))
    for game in games:
        headers = game.get('headers', {})
        moves = game.get('moves', [])
        annotations = game.get('move_annotations', [])
        board = chess.Board()
        pgn_game = chess.pgn.Game()
        for k, v in headers.items():
            if v:
                pgn_game.headers[k] = v
        node = pgn_game
        for idx, move_uci in enumerate(moves):
            move = board.parse_uci(move_uci)
            node = node.add_variation(move)
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


@bp.route('/play_game/<game_id>')
def play_game(game_id):
    game = utils.library_collection.find_one({'_id': uuid.UUID(game_id) if '-' in game_id else game_id})
    color = request.args.get('color', 'white')
    move_annotations = {}
    game_json = None
    if game:
        game_json = dict(game)
        game_json.pop('_id', None)
        if 'move_annotations' in game:
            move_annotations = {str(i + 1): ann for i, ann in enumerate(game['move_annotations']) if ann}
    return render_template('index.html', color=color, menu_items=bp.menu_items if hasattr(bp, 'menu_items') else [], move_annotations=move_annotations, game_json=game_json, game_id=game_id)

