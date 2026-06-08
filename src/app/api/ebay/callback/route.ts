import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens } from "@/lib/ebay";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? req.nextUrl.origin;

  if (error || !code) {
    return NextResponse.redirect(`${base}/settings?ebay=error&reason=${encodeURIComponent(error ?? "no_code")}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.platformConnection.upsert({
      where: { platform: "ebay" },
      create: {
        platform: "ebay",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        isActive: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        isActive: true,
      },
    });
    return NextResponse.redirect(`${base}/settings?ebay=connected`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${base}/settings?ebay=error&reason=${encodeURIComponent(msg)}`);
  }
}
