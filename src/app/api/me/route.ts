import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Use storeId from session JWT to scope lookup.
  // Prevents multi-store users from getting the wrong store's data.
  const sessionStoreId = (session as unknown as Record<string, unknown>).storeId as string | undefined;
  const staff = await prisma.posStaff.findFirst({
    where: {
      user_id: session.user.id,
      active: true,
      ...(sessionStoreId ? { store_id: sessionStoreId } : {}),
    },
    include: { store: true },
  });

  return NextResponse.json({ staff, store: staff?.store });
}
