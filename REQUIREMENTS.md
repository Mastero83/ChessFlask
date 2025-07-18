# ChessClub AI Assistant Requirements & Setup

## Dependencies
- Python 3.7+
- Flask
- flask-socketio
- stockfish (Python package)
- python-chess
- pymongo (for MongoDB integration)
- Stockfish binary (download from https://stockfishchess.org/download/ and place in stockfish/)
- MongoDB (required for game library and PGN upload features)

## Installation
1. Install Python 3.7+
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. (Optional) Install and run MongoDB for game library features

## Running the App
```sh
python flask_app.py
```
Then open your browser to [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Project Structure
- `flask_app.py` — Main Flask server
- `chess_engine.py` — Chess logic and Stockfish integration
- `static/` — JS, CSS, images, sounds
- `templates/` — HTML templates
- `releaseNotes/` — Release notes, screenshots, and documentation

## Features
- Modern UI: startup, play, and login screens
- Cheat panel with depth slider and improved layout
- MongoDB-backed game library and PGN upload/filtering
- Move evaluation (CPL) for every move, with toggle
- Improved move information panel and navigation (with play button)
- Table filtering: library table always matches filtered games
- Play chess, analyze games, use cheat mode, and more!
- See `RELEASE_NOTES.md` for new features.

## PGN Uploads & Library
- PGN files are processed and stored in MongoDB for library features.
- Large PGN files are supported; only the first 10 games are shown for selection. 