#!/bin/bash

# Navigate to jobs-scheduale directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# 1. Start Redis if not already running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis server locally..."
    redis-server --daemonize yes
else
    echo "Redis server is already running."
fi

# 2. Check virtualenv
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    venv/bin/pip install -r requirements.txt
fi

echo "Activating virtualenv..."
source venv/bin/activate

# Clean up background processes on EXIT
trap 'echo "Stopping jobs-scheduale services..."; kill 0' SIGINT SIGTERM EXIT

echo "Starting Celery Worker..."
celery -A app.celery_app.celery_app worker --loglevel=info &

echo "Starting Celery Beat..."
celery -A app.celery_app.celery_app beat --loglevel=info &

echo "Starting FastAPI Server on http://0.0.0.0:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

# Wait for all processes
wait
