import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff, handleAuthError } from "@/lib/require-staff";
import { getStripe } from "@/lib/stripe";

/* ------------------------------------------------------------------ */
/*  POST /api/stripe/terminal — create a connection token               */
/*  The Stripe Terminal JS SDK calls this to authenticate with readers. */
/*  Returns a short-lived token scoped to the store's connected account.*/
/* ------------------------------------------------------------------ */
export async function POST() {
  try {
    const { storeId } = await requireStaff();

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 400 }
      );
    }

    // Get the store's connected account ID
    const store = await prisma.posStore.findUnique({
      where: { id: storeId },
      select: { settings: true },
    });

    const settings = (store?.settings ?? {}) as Record<string, unknown>;
    const connectedAccountId = settings.stripe_connected_account_id as string | undefined;

    if (!connectedAccountId) {
      return NextResponse.json(
        { error: "Store has not connected a Stripe account" },
        { status: 400 }
      );
    }

    // Create a connection token on the connected account
    const token = await stripe.terminal.connectionTokens.create(
      {},
      { stripeAccount: connectedAccountId }
    );

    return NextResponse.json({ secret: token.secret });
  } catch (error) {
    return handleAuthError(error);
  }
}
