# ChessFlask Release Notes

## 🚀 What's New

ChessFlask is now a modern, visually stunning chess platform for play, analysis, and learning!

- **Modern Home Screen**: Instantly choose to play as White, Black, analyze a game, or learn openings.
- **Stockfish Everywhere**: All move generation, hints, and analysis are powered by Stockfish.
- **Cheat Mode Slider**: Instantly see the best moves at any depth (1–20) with a beautiful slider.
- **Move Navigation**: Step through your game with first/last/next/previous controls and a move number field.
- **Accuracy Boxes**: After each game, see your accuracy (and your opponent's) in gorgeous, color-coded summary boxes—just like chess.com, but better.
- **Game Summary Table**: Instantly see how many brilliants, bests, goods, inaccuracies, mistakes, and blunders you made, split by color, with emoticons.
- **Openings Explorer**: Upload a PGN, filter by move sequence, and visually explore openings with a live board and move selection.
- **Real-Time Stockfish Debug Panel**: See engine output live for the ultimate chess nerd experience.
- **AI Assistant**: Get fun, real-time commentary on every move.
- **Import/Export PGN**: Edit, import, and download PGN at any time.
- **No Database, No Docker**: Everything runs in memory for instant setup and blazing speed.

## 🖼️ Screenshots

**Gameplay:**
![Gameplay Example](Gameplay%20early.png)

**Openings Analysis:**
![Openings Analysis](Analyse%20openings.png)

**Game Over Summary:**
![Game Over Summary](Analyse%20openings.png)

## 🛠️ Improvements
- Modernized right panel with grouped controls
- Responsive, accessible UI
- Bug fixes for navigation, PGN handling, and analysis

## 📦 How to Use
1. Install requirements (see `REQUIREMENTS.md`)
2. Run `python flask_app.py`
3. Open your browser to `http://127.0.0.1:5000/`

## Setup Changes
- Requires Stockfish binary in `stockfish/`
- Requires `flask-socketio` and `stockfish` Python packages

---

For more details, see the requirements and documentation files in this repo. 