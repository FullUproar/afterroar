/* ------------------------------------------------------------------ */
/*  Stripe client setup for Store Ops                                   */
/*                                                                      */
/*  Two Stripe relationships:                                           */
/*  1. Platform (FU's account) — creates Connect accounts, manages      */
/*     Terminal connection tokens, receives webhooks                    */
/*  2. Connected accounts (stores) — where money flows                  */
/*                                                                      */
/*  Env vars:                                                           */
/*    STRIPE_SECRET_KEY         — FU's live Stripe secret key          */
/*    STRIPE_SECRET_KEY_TEST    — FU's test Stripe secret key          */
/*    STRIPE_WEBHOOK_SECRET     — for verifying webhook signatures      */
/*    PAYMENT_MODE              — "dev" | "test" | "live"              */
/* ------------------------------------------------------------------ */

import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-03-31.basil" as Stripe.LatestApiVersion;

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;

  const mode = process.env.PAYMENT_MODE ?? "dev";

  if (mode === "dev") return null; // No Stripe in dev mode

  const key =
    mode === "test"
      ? process.env.STRIPE_SECRET_KEY_TEST
      : process.env.STRIPE_SECRET_KEY;

  if (!key) return null;

  stripeInstance = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
  });

  return stripeInstance;
}

/** Check if Stripe is configured and available */
export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}
