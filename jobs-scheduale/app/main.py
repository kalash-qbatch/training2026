from fastapi import FastAPI, Header, HTTPException, status, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from celery.result import AsyncResult

from app.config import settings
from app.celery_app import celery_app
from app.tasks.email_tasks import send_email_task
from app.tasks.product_tasks import process_bulk_products_task
from app.tasks.order_tasks import cancel_stale_failed_orders_task, cancel_unpaid_order_task

app = FastAPI(
    title="Jobs Scheduler Microservice",
    description="FastAPI + Celery + Celery Beat + Redis Microservice for Next.js",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_internal_key(x_internal_key: Optional[str] = Header(None)):
    if settings.INTERNAL_API_KEY and x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Internal-Key header",
        )
    return True

# Schemas
class EmailJobRequest(BaseModel):
    email_type: str = Field(..., description="Type of email: forgot_password, invoice, order_cancelled")
    to: str = Field(..., description="Recipient email address")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Custom payload for the email template")

class ProductVariantItem(BaseModel):
    color: Optional[str] = ""
    size: Optional[str] = ""
    qty: int = 0

class ProductImageItem(BaseModel):
    url: str
    color: Optional[str] = ""

class BulkProductItem(BaseModel):
    title: str
    price: float
    stock: int = 0
    image: Optional[str] = None
    images: Optional[List[ProductImageItem]] = None
    color: Optional[str] = None
    size: Optional[str] = None
    category: Optional[str] = None
    categoryName: Optional[str] = None
    variants: Optional[List[ProductVariantItem]] = None

class BulkProductsRequest(BaseModel):
    products: List[BulkProductItem]

class JobResponse(BaseModel):
    status: str
    job_id: str
    message: str

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "jobs-scheduale",
        "broker": "redis",
    }

@app.post("/api/jobs/email/send", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def enqueue_email_job(
    req: EmailJobRequest,
    authenticated: bool = Depends(verify_internal_key),
):
    """
    Enqueue email sending task to Celery and immediately return 202 ACCEPTED.
    """
    task = send_email_task.delay(
        email_type=req.email_type,
        to=req.to,
        payload=req.payload,
    )
    return JobResponse(
        status="accepted",
        job_id=task.id,
        message="Email job queued for background processing",
    )

@app.post("/api/jobs/products/bulk", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def enqueue_bulk_products_job(
    req: BulkProductsRequest,
    authenticated: bool = Depends(verify_internal_key),
):
    """
    Enqueue multiple products creation job to Celery and immediately return 202 ACCEPTED.
    """
    serialized_products = [p.dict() for p in req.products]
    task = process_bulk_products_task.delay(serialized_products)
    return JobResponse(
        status="accepted",
        job_id=task.id,
        message=f"Bulk product upload for {len(req.products)} products queued for processing",
    )

class ScheduleOrderCancelRequest(BaseModel):
    order_id: str = Field(..., description="Order UUID to auto-cancel if still unpaid")
    delay_seconds: Optional[int] = Field(
        None,
        description="Countdown in seconds before cancel (default PAYMENT_CANCEL_DELAY_SECONDS)",
    )


@app.post("/api/jobs/orders/schedule-cancel", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def schedule_order_cancel_job(
    req: ScheduleOrderCancelRequest,
    authenticated: bool = Depends(verify_internal_key),
):
    """
    Schedule a per-order auto-cancel after delay_seconds (default 5 minutes).
    Task is idempotent: skips if payment succeeds or order is already cancelled.
    """
    delay = req.delay_seconds if req.delay_seconds is not None else settings.PAYMENT_CANCEL_DELAY_SECONDS
    task = cancel_unpaid_order_task.apply_async(args=[req.order_id], countdown=max(0, int(delay)))
    return JobResponse(
        status="accepted",
        job_id=task.id,
        message=f"Order cancel scheduled in {delay} seconds",
    )


@app.post("/api/jobs/orders/trigger-cancellation", status_code=status.HTTP_202_ACCEPTED, response_model=JobResponse)
def trigger_order_cancellation_job(
    hours_threshold: Optional[int] = None,
    authenticated: bool = Depends(verify_internal_key),
):
    """
    Trigger manual / on-demand run of the order cancellation job.
    """
    task = cancel_stale_failed_orders_task.delay(hours_threshold)
    return JobResponse(
        status="accepted",
        job_id=task.id,
        message="Order cancellation job queued",
    )

@app.get("/api/jobs/{job_id}/status")
def get_job_status(
    job_id: str,
    authenticated: bool = Depends(verify_internal_key),
):
    """
    Inspect the state and result of a Celery background job in Redis.
    """
    res = AsyncResult(job_id, app=celery_app)
    response = {
        "job_id": job_id,
        "state": res.state,
    }
    if res.state == "PROGRESS":
        response["meta"] = res.info
    elif res.ready():
        if res.successful():
            response["result"] = res.result
        else:
            response["error"] = str(res.result)
    return response
