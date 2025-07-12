# ChessFlask

A Flask-based chess web application with MongoDB-backed game library, annotation support, and Stockfish integration.

## Features

- **Play Chess** against Stockfish or in analysis mode.
- **Game Library**: Browse, upload, and manage chess games stored in MongoDB.
- **Move Annotations**: Import/export PGN with move comments, edit annotations in the UI, and store them in MongoDB.
- **Annotation Panel**: View all move annotations for a loaded game, grouped by move and color.
- **Debug JSON Viewer**: In the Annotations panel, see the full MongoDB JSON document for the loaded game.
- **Refresh Annotations from DB**: Button in the Annotations panel to fetch the latest move annotations directly from MongoDB for the current game.
- **Keyboard Navigation**: Use left/right arrows to step through moves.
- **Download to PGN**: Export games or openings to PGN, including all annotations.

## Backend API

- `/api/game_json/<game_id>`: Returns the full MongoDB JSON document for a game, used by the annotation panel for debug and annotation refresh.

## Development Notes

- **Template Variables**: Always pass `game_id` (or `None`) to `index.html` to avoid JSON serialization errors in Jinja. This ensures `window.currentGameId` is always defined in JS.
- **Annotation Panel**: The annotation panel uses `window.currentGameId` to query MongoDB for move annotations, regardless of the URL structure.
- **Robustness**: The frontend and backend are designed to handle missing or undefined fields gracefully.

## How to Commit

1. Ensure all features are documented above.
2. Confirm that all routes rendering `index.html` pass `game_id` (or `None`).
3. Run and test the app to verify:
   - The annotation panel works for all game loading methods.
   - The debug JSON and refresh button function as expected.
   - No serialization errors occur.
4. Stage your changes:
   ```sh
   git add flask_app.py static/scripts.js templates/index.html README.md
   ```
5. Commit with a message, e.g.:
   ```sh
   git commit -m "Add annotation panel DB refresh, debug JSON, and robust game_id handling"
   ```
6. Push to your repository:
   ```sh
   git push
   ```

## Contributing
See `CONTRIBUTING.md` for guidelines. 