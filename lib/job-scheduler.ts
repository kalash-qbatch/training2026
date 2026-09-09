/**
 * Job Scheduler Microservice Client (FastAPI + Celery + Redis)
 */

const JOB_SCHEDULER_URL = process.env.JOB_SCHEDULAR_URL || "http://localhost:8000";
const INTERNAL_KEY =
  process.env.JOB_SCHEDULAR_INTERNAL_KEY || "super-secret-internal-key-for-nextjs";

interface JobEnqueueResponse {
  status: string;
  job_id: string;
  message: string;
}

interface JobStatusResponse {
  job_id: string;
  state: "PENDING" | "STARTED" | "PROGRESS" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED";
  meta?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

async function postJob(path: string, body: Record<string, unknown>): Promise<JobEnqueueResponse> {
  const url = `${JOB_SCHEDULER_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Job scheduler unreachable at ${url}: ${message}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Job scheduler ${path} failed: ${res.status} ${errorText}`);
  }

  return res.json();
}

export async function enqueueEmailJob(params: {
  emailType:
    | "forgot_password"
    | "invoice"
    | "order_cancelled"
    | "order_approved"
    | "payment_failed"
    | "payment_success"
    | "order_delivered";
  to: string;
  payload: Record<string, unknown>;
}): Promise<JobEnqueueResponse> {
  const result = await postJob("/api/jobs/email/send", {
    email_type: params.emailType,
    to: params.to,
    payload: params.payload,
  });
  console.warn(`[email] queued ${params.emailType} → ${params.to} (job_id=${result.job_id})`);
  return result;
}

export async function enqueueBulkProductsJob(
  products: Array<{
    title: string;
    description?: string;
    price: number;
    stock: number;
    image?: string;
    images?: Array<{ url: string; color?: string }>;
    color?: string;
    size?: string;
    category?: string;
    categoryName?: string;
    variants?: Array<{ color: string; size: string; qty: number }>;
  }>
): Promise<JobEnqueueResponse> {
  return postJob("/api/jobs/products/bulk", { products });
}

/** Schedule auto-cancel if order is still unpaid after delay (default 5 minutes). */
export async function enqueueOrderAutoCancelJob(params: {
  orderId: string;
  delaySeconds?: number;
}): Promise<JobEnqueueResponse> {
  const result = await postJob("/api/jobs/orders/schedule-cancel", {
    order_id: params.orderId,
    delay_seconds: params.delaySeconds ?? 300,
  });
  console.warn(
    `[email] scheduled auto-cancel for order ${params.orderId} in ${params.delaySeconds ?? 300}s (job_id=${result.job_id})`
  );
  return result;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${JOB_SCHEDULER_URL}/api/jobs/${jobId}/status`, {
    headers: {
      "X-Internal-Key": INTERNAL_KEY,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to check job status: ${res.status}`);
  }

  return res.json();
}
