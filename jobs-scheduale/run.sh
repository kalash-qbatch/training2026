#!/bin/bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

usage() {
    echo "Usage: ./run.sh {redis|api|worker|beat|all}"
    echo ""
    echo "Run each component in its own terminal, or use 'all' for the combined launcher."
}

setup_python() {
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
        venv/bin/pip install -r requirements.txt
    fi

    source venv/bin/activate
}

start_redis() {
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "Starting Redis server locally..."
        redis-server --daemonize yes
    else
        echo "Redis server is already running."
    fi
}

start_api() {
    setup_python
    API_PORT="${JOBS_HTTP_PORT:-8000}"
    echo "Starting FastAPI server on http://0.0.0.0:${API_PORT}..."
    exec uvicorn app.main:app --host 0.0.0.0 --port "$API_PORT" --reload
}

start_worker() {
    setup_python
    echo "Starting Celery worker..."
    exec celery -A app.celery_app.celery_app worker --loglevel=info
}

start_beat() {
    setup_python
    echo "Starting Celery Beat..."
    exec celery -A app.celery_app.celery_app beat --loglevel=info
}

case "${1:-}" in
    redis)
        start_redis
        ;;
    api)
        start_api
        ;;
    worker)
        start_worker
        ;;
    beat)
        start_beat
        ;;
    all)
        start_redis
        setup_python
        child_pids=()
        cleanup() {
            trap - SIGINT SIGTERM EXIT
            kill "${child_pids[@]}" 2>/dev/null || true
            wait "${child_pids[@]}" 2>/dev/null || true
        }
        trap cleanup SIGINT SIGTERM EXIT

        celery -A app.celery_app.celery_app worker --loglevel=info &
        child_pids+=("$!")
        celery -A app.celery_app.celery_app beat --loglevel=info &
        child_pids+=("$!")
        API_PORT="${JOBS_HTTP_PORT:-8000}"
        echo "Starting FastAPI server on http://0.0.0.0:${API_PORT}..."
        uvicorn app.main:app --host 0.0.0.0 --port "$API_PORT" --reload &
        child_pids+=("$!")
        wait
        ;;
    *)
        usage
        exit 1
        ;;
esac
