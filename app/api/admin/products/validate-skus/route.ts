import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/controllers/http";
import { validateSkus } from "@/lib/services/products";

export async function POST(request: Request) {
  const { error } = await requireAdminUser();
  if (error) return NextResponse.json(error.body, { status: error.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const skus = Array.isArray((body as { skus?: unknown })?.skus)
    ? ((body as { skus: unknown[] }).skus.filter((s) => typeof s === "string") as string[])
    : [];

  const result = await validateSkus(skus);
  return NextResponse.json({ success: true, ...result });
}
