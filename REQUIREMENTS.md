# ChessFlask Requirements & Setup

## Dependencies
- Python 3.7+
- Flask
- python-chess
- (Optional) Stockfish for advanced analysis

## Installation
```sh
pip install flask
pip install python-chess[uci,gaviota]
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

## Usage
- Play chess, analyze games, use cheat mode, and more!
- See `RELEASE_NOTES.md` for new features. 