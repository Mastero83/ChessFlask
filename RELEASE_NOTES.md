# Release Notes

## Latest Update: Modern UI, Move Evaluation, and Unified Menu

### UI/UX
- Modernized startup, play, and login screens with gradients, card layouts, and chess-themed backgrounds
- Top icon bar for all navigation and controls
- Home button now reliably returns to the startup page
- Improved cheat panel UI: depth slider and label are now side by side for better usability
- Unified sidebar menu: all pages now extend `base.html` and use a single menu definition for consistency
- Move information panel: improved table, navigation controls, and a new play button for auto-playback.
  Click the play button to automatically cycle through moves; interacting with other controls stops playback.

### Engine & Analysis
- All move generation, evaluation, and cheat suggestions powered by Stockfish
- Move evaluation (CPL): see centipawn loss for every move, for both players, in a color-coded table
- Cheat panel shows Stockfish's top moves with evaluation and is toggleable
- AI assistant leverages Stockfish for smarter feedback

### Game Library & PGN
- MongoDB integration for storing user games and library
- Upload PGN files, process with progress bar, and filter/search games by moves or opening
- Opening selection dropdown and improved move filtering logic
- Table filtering: library table always matches filtered games for the current board position
- MongoDB indexes added for all major search fields for improved performance (see `scripts/create_library_indexes.py`)

### Bugfixes & Improvements
- Cheat panel toggle and visibility fixed
- Home button navigation fixed
- Move highlighting and drag-and-drop improved
- Consistent, modern design throughout
- Chess.com import page and logic removed for a cleaner codebase

### Setup
- Requires Stockfish binary in `stockfish/`
- Requires `flask-socketio`, `stockfish`, `python-chess`, and `pymongo` Python packages
- MongoDB required for game library features

See README.md for full setup and usage instructions.

## vNext
- Added a startup screen with options for playing against AI or analysing openings
- New 'Analyse and Learn Openings' module: upload a PGN file, search/select games, and load them for review 
- Project is now called ChessClub AI Assistant 