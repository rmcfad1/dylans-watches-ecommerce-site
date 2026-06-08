import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Public store routes
  if (
    pathname.startsWith("/shop") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Public API routes (external webhooks + shop data)
  if (
    pathname === "/api/meta/product-feed" ||
    pathname.startsWith("/api/checkout") ||
    pathname.startsWith("/api/meta/webhook") ||
    pathname === "/api/ebay/callback"
  ) {
    return NextResponse.next();
  }
  if (pathname === "/api/inventory" && searchParams.get("shop") === "1") {
    return NextResponse.next();
  }

  const session = req.cookies.get("admin-session")?.value;
  const isAuthed = !!session && session === process.env.ADMIN_SECRET;

  // Login / logout are accessible without auth; redirect authed users away from login
  if (pathname === "/login" || pathname === "/logout") {
    if (isAuthed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (isAuthed) return NextResponse.next();

  // Unauthenticated API call → 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Root path → send customers to the shop
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/shop", req.url));
  }

  // All other admin pages → login
  const url = new URL("/login", req.url);
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
