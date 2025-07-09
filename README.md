# ChessFlask: Mastermind Arena

## ♟️ Why ChessFlask?
ChessFlask is the ultimate modern chess web app for players, club enthusiasts, and learners. Powered by Stockfish, it combines world-class analysis, a beautiful interface, and unique features you won't find anywhere else. Whether you want to play, analyze your club games, or explore openings, ChessFlask is your new chess home.

---

## ✨ Features
- **Modern Home, Play, and Login Screens**: Redesigned with gradients, card layouts, and chess-themed backgrounds for a beautiful, consistent experience.
- **Stockfish-Powered Play & Analysis**: Every move, hint, and analysis is backed by the world's strongest chess engine.
- **Cheat Panel with Depth Slider**: Instantly see the best moves at any depth (1–20) with a compact, toggleable cheat panel—perfect for learning or "cheating." Now with improved UI and slider placement.
- **MongoDB-Backed Game Library**: Upload PGN files, filter/search games, and save to your personal library with statistics and opening selection. Requires MongoDB for full functionality.
- **Move Navigation**: Step through your game with first/last/next/previous controls and a move number field.
- **Accuracy Boxes**: After each game, see your accuracy (and your opponent's) in gorgeous, color-coded summary boxes—just like chess.com, but better.
- **Game Summary Table**: Instantly see how many brilliants, bests, goods, inaccuracies, mistakes, and blunders you made, split by color, with emoticons.
- **Openings Explorer**: Upload a PGN, filter by move sequence, and visually explore openings with a live board and move selection.
- **Real-Time Stockfish Debug Panel**: See engine output live for the ultimate chess nerd experience.
- **AI Assistant**: Get fun, real-time commentary on every move.
- **Import/Export PGN**: Edit, import, and download PGN at any time.
- **No Docker Required**: Everything runs locally for instant setup and blazing speed.
- **Consistent Sidebar Menu & Topbar**: Navigate easily with a modern sidebar menu and topbar, now available on all main pages for a seamless experience.

---

## 🚀 Quick Start
1. **Clone the repo**
2. **Download Stockfish** and place `stockfish.exe` in the `stockfish/` folder
3. **Install requirements:**
   ```sh
   python -m pip install -r requirements.txt
   ```
4. **(Optional) Set up MongoDB** for the game library features
5. **Run the app:**
   ```sh
   python flask_app.py
   ```
6. **Open** [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 🖼️ Screenshots
- **Gameplay:**
  ![Gameplay Example](releaseNotes/Gameplay%20early.png)
- **Openings Analysis:**
  ![Openings Analysis](releaseNotes/Analyse%20openings.png)
- **Cheat Panel:**
  <!-- Add a screenshot of the new cheat panel UI here -->
- **Game Over Summary:**
  ![Game Over Summary](releaseNotes/Analyse%20openings.png)

---

## 📚 Documentation
- [Release Notes & Screenshots](releaseNotes/RELEASE_NOTES.md)
- [Requirements & Setup](REQUIREMENTS.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## 🙏 Credits
Based on [brokenloop/FlaskChess](https://github.com/brokenloop/FlaskChess) and extended by the ChessFlask community. Special thanks to all contributors!

Enjoy playing, learning, and mastering chess with ChessFlask! 