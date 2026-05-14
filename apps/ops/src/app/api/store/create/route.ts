import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkBusinessApproval } from "@/lib/business-approval/check";

/* ------------------------------------------------------------------ */
/*  POST /api/store/create — create a new store for the logged-in user */
/*  Gated on an approved BusinessApplication on the HQ side (2026-05-14).*/
/*  Used by Google OAuth users who have been formally onboarded.       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await request.json();
    const { store_name, owner_name } = body as { store_name: string; owner_name?: string };

    if (!store_name?.trim()) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }

    // Check if user already has a store (idempotency, before approval
    // check — established tenants shouldn't be re-gated).
    const existingStaff = await prisma.posStaff.findFirst({
      where: { user_id: session.user.id },
    });
    if (existingStaff) {
      return NextResponse.json({ error: "You already have a store" }, { status: 400 });
    }

    // BusinessApplication approval gate. Fail-closed: any error from
    // HQ side treats this as "not approved" and refuses creation.
    // See c:\dev\FULL UPROAR PLATFORM\full-uproar-site\apps\hq\app\api\
    // internal\business-approval\route.ts for the verification side.
    const email = session.user.email ?? null;
    if (!email) {
      return NextResponse.json(
        { error: "Email is required to create a store. Please sign in with an account that has email set." },
        { status: 422 },
      );
    }
    const approval = await checkBusinessApproval(email, 'store_ops');
    if (!approval.approved) {
      return NextResponse.json(
        {
          error: "Store creation requires an approved Store Ops application. Apply at https://hq.fulluproar.com/store-ops",
          code: "approval_required",
          reason: approval.reason,
        },
        { status: 403 },
      );
    }
    if (approval.trialExpiresAt && new Date(approval.trialExpiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: "Your Store Ops trial has expired. Reply to your approval email to convert to a paid plan.",
          code: "trial_expired",
        },
        { status: 403 },
      );
    }

    // Generate slug from store name
    let slug = store_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure slug is unique
    const existingSlug = await prisma.posStore.findFirst({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const userId = session.user.id!;

    // Create store + staff in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const store = await tx.posStore.create({
        data: {
          name: store_name.trim(),
          slug,
          owner_id: userId,
          settings: {
            plan: "trial",
            subscription_status: "trial",
            trial_started_at: new Date().toISOString(),
            trial_days: 14,
          },
        },
      });

      await tx.posStaff.create({
        data: {
          user_id: userId,
          store_id: store.id,
          role: "owner",
          name: owner_name?.trim() || session.user!.name || session.user!.email?.split("@")[0] || "Owner",
        },
      });

      return store;
    });

    return NextResponse.json({
      store_id: result.id,
      slug: result.slug,
    }, { status: 201 });
  } catch (error) {
    console.error("[store/create]", error);
    return NextResponse.json({ error: "Failed to create store" }, { status: 500 });
  }
}
