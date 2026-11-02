import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { tags } from "@/lib/data/directory";
import { fulfilPayment, verifyStripeSignature } from "@/lib/payments";

// Stripe calls this when a checkout finishes. Point a Stripe webhook at
// https://beautybook.my/api/payments/webhook for checkout.session.completed
// and checkout.session.async_payment_succeeded.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as {
    type: string;
    data: { object: { payment_status?: string; metadata?: { payment_id?: string } } };
  };
  const session = event.data.object;
  const paid =
    (event.type === "checkout.session.completed" && session.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (paid && session.metadata?.payment_id) {
    await fulfilPayment(session.metadata.payment_id);
    revalidateTag(tags.listings, { expire: 0 });
  }
  return NextResponse.json({ received: true });
}
