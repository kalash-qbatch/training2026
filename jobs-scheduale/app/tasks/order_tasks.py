from datetime import datetime, timedelta
import uuid
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Order, OrderItem, Notification, User, Product, Specification
from app.config import settings


PAID_STATUSES = {"SUCCEEDED", "PAID", "PROCESSING"}
UNPAID_STATUSES = {"UNPAID", "FAILED", "PENDING"}

DATABASE_RETRY_OPTIONS = {
    "autoretry_for": (OperationalError,),
    "retry_kwargs": {"max_retries": 5},
    "retry_backoff": True,
    "retry_backoff_max": 60,
    "retry_jitter": True,
}


def _sync_product_stock(db, product_id: str):
    total = (
        db.query(func.coalesce(func.sum(Specification.qty), 0))
        .filter(Specification.productId == product_id)
        .scalar()
    )
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is not None:
        product.stock = int(total or 0)


def _restore_stock_for_order(db, order: Order):
    items = db.query(OrderItem).filter(OrderItem.orderId == order.id).all()
    for item in items:
        if item.specificationId:
            spec = db.query(Specification).filter(Specification.id == item.specificationId).first()
            if spec:
                spec.qty = (spec.qty or 0) + item.quantity
                _sync_product_stock(db, item.productId)
            continue

        product = db.query(Product).filter(Product.id == item.productId).first()
        if not product:
            continue

        specs = db.query(Specification).filter(Specification.productId == product.id).all()
        color = (item.color or "").strip()
        size = (item.size or "").strip()

        if specs and (color or size):
            matched = next(
                (
                    s
                    for s in specs
                    if s.color.lower() == color.lower() and s.size.lower() == size.lower()
                ),
                None,
            )
            if matched:
                matched.qty = (matched.qty or 0) + item.quantity
                _sync_product_stock(db, product.id)
                continue

        product.stock = (product.stock or 0) + item.quantity


def _cancel_order_and_notify(db, order: Order, reason: str):
    """Cancel unpaid order, restore stock only (cart stays empty until Order Again)."""
    if order.paymentMethod != "CARD":
        return False
    if order.status == "CANCELLED":
        return False
    if order.paymentStatus in PAID_STATUSES:
        return False
    if order.status not in ("PENDING", "PROCESSING"):
        return False

    _restore_stock_for_order(db, order)

    order.status = "CANCELLED"
    order.paymentStatus = "UNPAID"
    order.nextPaymentRetryAt = None
    order.updatedAt = datetime.utcnow()

    db.add(
        Notification(
            id=str(uuid.uuid4()),
            userId=order.userId,
            title="Order cancelled",
            message=f"Your order {order.id} was cancelled because {reason}.",
            orderId=order.id,
            read=False,
            createdAt=datetime.utcnow(),
        )
    )

    user = db.query(User).filter(User.id == order.userId).first()
    user_email = order.shippingEmail or (user.email if user else None)
    user_name = order.shippingFullName or (user.fullName if user else None) or (
        user.name if user else None
    ) or "Customer"

    if user_email:
        from app.tasks.email_tasks import send_email_task

        send_email_task.delay(
            email_type="order_cancelled",
            to=user_email,
            payload={
                "order_id": order.id, "order_number": order.id,
                "name": user_name,
                "reason": reason,
                "subject": f"Order {order.id} has been Cancelled",
            },
        )

    return True


@celery_app.task(
    name="app.tasks.order_tasks.cancel_unpaid_order_task",
    **DATABASE_RETRY_OPTIONS,
)
def cancel_unpaid_order_task(order_id: str):
    """
    Delayed auto-cancel for a single order (default: 5 minutes after first payment failure).
    Idempotent: skips if already paid or cancelled.
    """
    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            return {"cancelled": False, "reason": "order_not_found", "order_id": order_id}

        if order.paymentStatus in PAID_STATUSES:
            return {
                "cancelled": False,
                "reason": "already_paid",
                "order_id": order_id,
                "paymentStatus": order.paymentStatus,
            }

        if order.status == "CANCELLED":
            return {"cancelled": False, "reason": "already_cancelled", "order_id": order_id}

        if order.paymentStatus not in UNPAID_STATUSES:
            return {
                "cancelled": False,
                "reason": "payment_status_not_unpaid",
                "order_id": order_id,
                "paymentStatus": order.paymentStatus,
            }

        cancelled = _cancel_order_and_notify(
            db,
            order,
            reason="payment was not completed within 5 minutes",
        )
        db.commit()
        return {
            "cancelled": cancelled,
            "order_id": order_id,
            "id": order.id,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(
    name="app.tasks.order_tasks.cancel_stale_failed_orders_task",
    **DATABASE_RETRY_OPTIONS,
)
def cancel_stale_failed_orders_task(hours_threshold: int = None):
    """
    Celery Beat backup: cancel orders still unpaid after AUTO_CANCEL_HOURS.
    Primary path is cancel_unpaid_order_task (5-minute countdown per order).
    """
    if hours_threshold is None:
        hours_threshold = settings.AUTO_CANCEL_HOURS

    cutoff = datetime.utcnow() - timedelta(hours=hours_threshold)
    db = SessionLocal()
    cancelled_orders = []

    try:
        stale_orders = (
            db.query(Order)
            .filter(
                Order.paymentMethod == "CARD",
                Order.status.in_(["PENDING", "PROCESSING"]),
                Order.paymentStatus.in_(["FAILED", "UNPAID"]),
                Order.updatedAt < cutoff,
            )
            .with_for_update(skip_locked=True)
            .all()
        )

        for order in stale_orders:
            if _cancel_order_and_notify(
                db,
                order,
                reason="payment could not be completed in time",
            ):
                cancelled_orders.append(
                    {
                        "id": order.id,
                        "userId": order.userId,
                    }
                )

        db.commit()
        return {
            "processed": len(cancelled_orders),
            "cancelled_orders": cancelled_orders,
            "cutoff_timestamp": cutoff.isoformat(),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
