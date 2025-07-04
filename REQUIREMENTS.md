# ChessFlask Requirements & Setup

## Dependencies
- Python 3.7+
- Flask
- flask-socketio
- stockfish (Python package)
- python-chess
- Stockfish binary (download from https://stockfishchess.org/download/ and place in stockfish/)

## Installation

1. Install Python 3.7+
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```

## Running the App
```sh
python flask_app.py
```
Then open your browser to [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Project Structure
- `flask_app.py` — Main Flask server
- `chess_engine.py` — Chess logic and evaluation
- `static/` — JS, CSS, images, sounds
- `templates/` — HTML templates
- `releaseNotes/` — Release notes, screenshots, and documentation

## Features
- Play chess, analyze games, use cheat mode, and more!
- See `RELEASE_NOTES.md` for new features.

## PGN Uploads
- PGN files are processed in memory. No database or Docker is required.
- Large PGN files are supported; only the first 10 games are shown for selection. 