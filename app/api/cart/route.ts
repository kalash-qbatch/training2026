import { NextResponse } from "next/server";
import {
  addCartItem,
  deleteCartItems,
  listCart,
  patchCartItem,
} from "@/lib/controllers/cart";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await listCart();
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("cart GET:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load cart" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await addCartItem(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("cart POST:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add to cart" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = await patchCartItem(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("cart PATCH:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update cart" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await deleteCartItems(request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("cart DELETE:", err);
    return NextResponse.json(
      { success: false, error: "Failed to remove cart item" },
      { status: 500 }
    );
  }
}
