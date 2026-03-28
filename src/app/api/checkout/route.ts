import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { tier, email } = await request.json();

  if (!tier || !email) {
    return NextResponse.json({ error: "Missing tier or email" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    // Mock mode — no Stripe configured
    return NextResponse.json({ url: `/success?mock=true&tier=${tier}` });
  }

  // Stripe mode
  const priceMap: Record<string, string | undefined> = {
    reporter: process.env.STRIPE_PRICE_REPORTER,
    pro: process.env.STRIPE_PRICE_PRO,
    newsroom: process.env.STRIPE_PRICE_NEWSROOM,
  };

  const priceId = priceMap[tier];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  // Dynamic import to avoid issues when stripe isn't installed
  const stripe = new (await import("stripe")).default(stripeKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${request.nextUrl.origin}/success?tier=${tier}`,
    cancel_url: `${request.nextUrl.origin}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
