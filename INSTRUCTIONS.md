# Instructions for AI Assistants

This document provides a concise set of instructions for setting up and running the ChessClub AI Assistant application.

## Running the Application

The recommended way to run this application is with Docker and Docker Compose.

### Steps

1.  **Ensure Docker is running.**
2.  **Open a terminal in the root of the project directory.**
3.  **Run the following command:**

    ```bash
    docker-compose up --build
    ```

4.  **The application will be available at `http://127.0.0.1:5000`.**

### Notes

*   The `docker-compose up` command will start both the Flask application and the MongoDB database.
*   The Stockfish chess engine is installed as part of the Docker build process, so no manual installation is required.
*   The application is configured to connect to the MongoDB container automatically.