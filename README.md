# ChessFlask

A modern, feature-rich chess web app built with Flask and python-chess.

---

## ✨ Features
- 🧩 Interactive chessboard with move validation
- 📊 Evaluation bar and cheat mode
- 🤖 AI Assistant with real-time commentary
- 📥 Import/export and edit PGN
- ⏪ Move navigation and visual previews
- 🎨 Customizable board and settings
- 🔍 Analyse and learn from openings (multi-game PGN upload)

---

## 🆕 New in This Release
- **Startup Screen**: Choose between 'Play against AI' and 'Analyse and Learn Openings' when you visit the app.
- **Openings Module**: Upload a PGN file with multiple games, search and select a game, and load it into the main interface for analysis.
- **Metadata Panel**: View game information (event, players, result, etc.) above the move list, toggleable with an info icon.
- **Fully in-memory PGN processing**: No database or Docker required!

### How to Use the Openings Module
1. Start the app and choose **Analyse and Learn Openings**.
2. Upload a PGN file containing multiple games (supports large files, shows first 10 for selection).
3. Search and select a game from the list.
4. Click **Load** to open the game in the main interface for review and analysis.

---

## 🚀 Quick Start
1. Install Python 3.7+
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Run the app:
   ```sh
   python flask_app.py
   ```
4. Open your browser to [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 📸 Screenshots

**Gameplay:**
![Gameplay Example](releaseNotes/Gameplay%20early.png)

**Openings Analysis:**
![Openings Analysis](releaseNotes/Analyse%20openings.png)

---

## 📚 Documentation
- [Release Notes & Screenshots](releaseNotes/RELEASE_NOTES.md)
- [Requirements & Setup](REQUIREMENTS.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## 🙏 Credits

This project is based on [brokenloop/FlaskChess](https://github.com/brokenloop/FlaskChess) by [brokenloop](https://github.com/brokenloop).

We have extended and modernized the original codebase with new features, UI improvements, and documentation.

Special thanks to the original author and contributors for their foundational work!

Enjoy playing and analyzing chess with ChessFlask! 