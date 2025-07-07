# Release Notes

## Latest Update: Modern UI, Cheat Panel, and Game Library

### UI/UX
- Modernized startup, play, and login screens with gradients, card layouts, and chess-themed backgrounds
- Top icon bar for all navigation and controls
- Home button now reliably returns to the startup page
- Improved cheat panel UI: depth slider and label are now side by side for better usability

### Engine & Analysis
- All move generation, evaluation, and cheat suggestions powered by Stockfish
- Cheat panel shows Stockfish's top moves with evaluation and is toggleable
- AI assistant leverages Stockfish for smarter feedback

### Game Library & PGN
- MongoDB integration for storing user games and library
- Upload PGN files, process with progress bar, and filter/search games by moves or opening
- Opening selection dropdown and improved move filtering logic

### Bugfixes & Improvements
- Cheat panel toggle and visibility fixed
- Home button navigation fixed
- Move highlighting and drag-and-drop improved
- Consistent, modern design throughout

### Setup
- Requires Stockfish binary in `stockfish/`
- Requires `flask-socketio`, `stockfish`, `python-chess`, and `pymongo` Python packages
- MongoDB required for game library features

See README.md for full setup and usage instructions. 