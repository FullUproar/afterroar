import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.posStaff.findFirst({
    where: { user_id: session.user.id, active: true },
    include: { store: true },
  });

  return NextResponse.json({ staff, store: staff?.store });
}
