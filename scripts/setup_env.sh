#!/usr/bin/env bash
set -e

VENV_DIR="venv"

# Create virtual environment if it does not exist
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

# Activate the virtual environment
source "$VENV_DIR/bin/activate"

# Install dependencies
pip install -r requirements.txt

# Check for Stockfish binary
if ! command -v stockfish >/dev/null 2>&1; then
    echo "WARNING: Stockfish binary not found. Engine features will be disabled until it is installed." >&2
fi

# Create .env file with defaults if missing
if [ ! -f .env ]; then
    cat > .env <<EOT
MONGO_HOST=localhost
SECRET_KEY=change-me
EOT
    echo "Created .env file with default values. Edit it to match your environment."
else
    echo ".env already exists. Verify values for MONGO_HOST and SECRET_KEY."
fi

echo "Setup complete. Activate the environment with 'source $VENV_DIR/bin/activate'."
