import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { plans, stripe } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan } = await request.json() as { plan: keyof typeof plans };
  const price = plans[plan];
  if (!price) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=cancelled`,
    client_reference_id: userId,
  });

  return NextResponse.json({ url: session.url });
}
