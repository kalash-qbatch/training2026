# Jobs Scheduler Microservice (FastAPI + Celery + Celery Beat + Redis)

This microservice handles asynchronous and background jobs for the e-commerce platform **without Docker**.

## Features & Flows

1. **Send Emails**:
   - NextJS sends email requests (Forgot Password, Invoices, Order updates) to FastAPI (`POST /api/jobs/email/send`).
   - FastAPI enqueues the job to Celery via Redis broker and returns `202 ACCEPTED` immediately.
   - Celery worker processes the email and sends it via SMTP.
   - Templates: `forgot_password`, `invoice`, `payment_failed` (Unpaid + Pending), `payment_success`, `order_approved` (Approve → SHIPPED), `order_delivered`, `order_cancelled`.
2. **Upload Multiple Products**:
   - Admin uploads a `.csv` file in the NextJS Admin interface (`+ Add Multiple Products`).
   - NextJS parses the CSV client-side into interactive product cards.
   - Admin can review, modify fields, add rows, delete rows, and upload images.
   - Upon submission, NextJS sends the validated list to FastAPI (`POST /api/jobs/products/bulk`), which returns `202 ACCEPTED`.
   - Celery worker executes the bulk insertion into PostgreSQL one product at a time with validation and category/variant handling.
3. **Payment failed → 5-minute auto-cancel**:
   - On first payment failure, Next.js sets order to `PENDING` / `UNPAID`, emails the user, and calls `POST /api/jobs/orders/schedule-cancel` (countdown **300s**).
   - If the user retries and fails again, the same unpaid email is sent again — **order is not cancelled** on retry failure.
   - After 5 minutes, Celery cancels the order only if still unpaid: restores stock + cart, notifies, and sends `order_cancelled` email.
   - If payment succeeds within 5 minutes, the delayed task is a no-op.
4. **Cancel stale unpaid orders (Beat backup)**:
   - Celery Beat runs periodically (default every 60 minutes).
   - Cancels orders still `PENDING`/`PROCESSING` with `paymentStatus` in `UNPAID`/`FAILED` older than `AUTO_CANCEL_HOURS` (default 120h).

## How to Run (Without Docker)

Create `jobs-scheduale/.env` before starting the service. The secrets have no
source-code defaults, so a missing value fails fast during startup instead of
silently using stale credentials.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@ENDPOINT-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require"
REDIS_URL="redis://localhost:6379/0"
INTERNAL_API_KEY="replace-with-a-long-random-value"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="you@example.com"
SMTP_PASSWORD="replace-with-an-app-password"
EMAIL_SENDER="you@example.com"
APP_BASE_URL="http://localhost:3000"
AUTO_CANCEL_HOURS="120"
AUTO_CANCEL_SCHEDULE_MINUTES="60"
```

The order-cancellation tasks automatically retry transient database connection
failures with exponential backoff (up to five retries).

Run the automated startup script:

```bash
cd jobs-scheduale
./run.sh
```

This script:

1. Starts the local `redis-server` in daemon mode if not already running.
2. Creates and activates the Python virtual environment (`venv`).
3. Starts the **Celery Worker**.
4. Starts the **Celery Beat** periodic scheduler.
5. Starts the **FastAPI Server** on `http://0.0.0.0:8000`.

## Endpoints

- `GET /health` - Service health status.
- `POST /api/jobs/email/send` - Enqueues email task (returns `202 ACCEPTED`).
- `POST /api/jobs/products/bulk` - Enqueues bulk product creation (returns `202 ACCEPTED`).
- `POST /api/jobs/orders/schedule-cancel` - Schedules per-order auto-cancel after N seconds (default 300).
- `POST /api/jobs/orders/trigger-cancellation` - Triggers immediate stale-order cancellation check (returns `202 ACCEPTED`).
- `GET /api/jobs/{job_id}/status` - Inspects status/result of a background task.
