# Release Notes

## Major Update: Stockfish Integration & Modern UI

### Engine & Analysis
- All move generation, evaluation, and cheat suggestions now powered by Stockfish
- Cheat panel shows Stockfish's top moves with chess.com-style evaluation
- AI assistant leverages Stockfish for smarter feedback

### UI/UX
- Top icon bar for all navigation and controls
- Removed legacy buttons for a cleaner look
- Accordion-style settings panel for sound and advanced options
- Real-time Stockfish debug output panel
- Consistent, modern design throughout

### Setup
- Requires Stockfish binary in `stockfish/`
- Requires `flask-socketio` and `stockfish` Python packages

See README.md for full setup and usage instructions.

## vNext
- Added a startup screen with options for playing against AI or analysing openings
- New 'Analyse and Learn Openings' module: upload a PGN file, search/select games, and load them for review 