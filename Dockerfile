# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies, including Stockfish
RUN apt-get update && apt-get install -y stockfish

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container
COPY . .

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV FLASK_APP=flask_app.py

# Run the application
# Note: We use 0.0.0.0 to make the app accessible from outside the container
CMD ["flask", "run", "--host=0.0.0.0"]