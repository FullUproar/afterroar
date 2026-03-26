import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { email, password, storeName, staffName } = await request.json();

  if (!email || !password || !storeName) {
    return NextResponse.json(
      { error: "email, password, and storeName are required" },
      { status: 400 }
    );
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 400 }
    );
  }

  const hashed_password = await hash(password, 12);

  const slug = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create user, store, and staff in a transaction
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        hashed_password,
        name: staffName || email.split("@")[0],
      },
    });

    const store = await tx.store.create({
      data: {
        name: storeName,
        slug,
        owner_id: user.id,
      },
    });

    await tx.staff.create({
      data: {
        user_id: user.id,
        store_id: store.id,
        role: "owner",
        name: staffName || email.split("@")[0],
      },
    });
  });

  return NextResponse.json({ success: true });
}
