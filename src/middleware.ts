import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;

  // Public routes
  const isPublic =
    path === "/" ||
    path === "/login" ||
    path === "/signup" ||
    path === "/ops" ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/debug");

  if (!req.auth && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (req.auth && (path === "/login" || path === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
