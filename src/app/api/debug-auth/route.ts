import { NextResponse } from "next/server";

export async function GET() {
  // Test the auth configuration without actually doing OAuth
  try {
    // Check if NextAuth can initialize
    const { auth } = await import("@/auth");
    const session = await auth();

    // Try to see what the Google provider looks like
    const res = await fetch(`${process.env.AUTH_URL || process.env.NEXTAUTH_URL}/api/auth/providers`);
    const providers = await res.json();

    return NextResponse.json({
      status: "ok",
      session: session ? { user: session.user?.email } : null,
      providers: Object.keys(providers),
      env: {
        AUTH_SECRET: !!process.env.AUTH_SECRET,
        AUTH_URL: process.env.AUTH_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "set" : "MISSING",
      },
    });
  } catch (e) {
    return NextResponse.json({
      status: "error",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    });
  }
}
