import os
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "ecommerce_jobs",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.product_tasks",
        "app.tasks.order_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_concurrency=4,
    broker_connection_retry_on_startup=True,
)

# Configure Celery Beat schedules
celery_app.conf.beat_schedule = {
    "cancel-failed-orders-periodic": {
        "task": "app.tasks.order_tasks.cancel_stale_failed_orders_task",
        "schedule": float(settings.AUTO_CANCEL_SCHEDULE_MINUTES * 60),  # runs periodically
    },
}
