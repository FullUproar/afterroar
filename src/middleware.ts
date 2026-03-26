import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";

  // ops.afterroar.store → /ops route
  if (hostname.startsWith("ops.")) {
    return NextResponse.rewrite(new URL("/ops", request.url));
  }

  // www.afterroar.store (or anything else) → /www route
  return NextResponse.rewrite(new URL("/www", request.url));
}

export const config = {
  matcher: ["/"],
};
