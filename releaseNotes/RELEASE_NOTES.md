# ChessFlask Release Notes

![Gameplay Example](Gameplay%20early.png)

## 🚀 What's New
- Modern, interactive chess UI with evaluation bar, move navigation, and cheat mode
- AI Assistant with real-time commentary
- Import/export PGN with in-app editing
- Board size and display settings
- Collapsible settings and cheat panels
- Visual move previews on hover
- **Metadata Panel**: View game information (event, players, result, etc.) above the move list, toggleable with an info icon
- **Openings Analysis**: Upload a multi-game PGN, search/select a game, and load it for review
- **Fully in-memory PGN processing**: No database or Docker required!

## 🆕 Features
- **Cheat Mode**: See up to 5 best moves with evaluation, preview moves visually
- **AI Assistant**: Get fun, real-time commentary on every move
- **PGN Import/Export**: Edit, import, and download PGN at any time
- **Move Navigation**: Step through the game without affecting play
- **Customizable Board**: Resize board, toggle evaluation bar, and more
- **Game Metadata Panel**: Toggle game info above the move list

## 🖼️ Screenshots

**Gameplay:**
![Gameplay Example](Gameplay%20early.png)

**Openings Analysis:**
![Openings Analysis](Analyse%20openings.png)

## 🛠️ Improvements
- Modernized right panel with grouped controls
- Responsive, accessible UI
- Bug fixes for evaluation, navigation, and PGN handling

## 📦 How to Use
1. Install requirements (see `REQUIREMENTS.md`)
2. Run `python flask_app.py`
3. Open your browser to `http://127.0.0.1:5000/`

---

For more details, see the requirements and documentation files in this repo. 