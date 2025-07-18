# Contributing to ChessClub AI Assistant

Thank you for your interest in contributing!

## How to Contribute
- **Report bugs**: Open an issue with steps to reproduce
- **Suggest features**: Open an issue or discussion
- **Submit code**: Fork the repo, create a branch, and open a pull request
- **Improve docs**: PRs for documentation are welcome

## Code Style
- Follow PEP8 for Python
- Use clear, descriptive commit messages

## Questions?
Open an issue or discussion and we'll be happy to help!

## Guidelines
- Ensure compatibility with Stockfish engine integration
- Follow the new UI structure (top icon bar, accordion settings, debug panel, modern home screen)
- Use the new `base.html` for all pages with a sidebar menu; update `sidebar_menu.html` for menu changes
- Test changes with real-time Stockfish output, cheat panel, and accuracy/analysis features
- Document new features in README and release notes
- Keep MongoDB indexes up to date for any new fields used in queries (see `scripts/create_library_indexes.py`)

## Areas for Contribution
- Engine/analysis improvements (accuracy, move classification)
- UI/UX enhancements (home screen, analysis mode, accuracy boxes)
- Real-time features (SocketIO, debug, etc.)
- Documentation and tutorials 