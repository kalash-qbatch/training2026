import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/controllers/http";
import { getJobStatus } from "@/lib/job-scheduler";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { error } = await requireAdminUser();
  if (error) {
    return NextResponse.json(error.body, { status: error.status });
  }

  try {
    const { jobId } = await context.params;
    if (!jobId) {
      return NextResponse.json({ success: false, error: "jobId is required" }, { status: 400 });
    }
    const status = await getJobStatus(jobId);
    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch job status",
      },
      { status: 502 }
    );
  }
}
