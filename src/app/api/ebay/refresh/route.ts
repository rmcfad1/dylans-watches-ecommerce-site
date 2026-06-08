import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/ebay";

export async function POST() {
  const conn = await prisma.platformConnection.findUnique({ where: { platform: "ebay" } });
  if (!conn?.refreshToken) {
    return NextResponse.json({ error: "No eBay refresh token stored." }, { status: 400 });
  }
  try {
    const tokens = await refreshAccessToken(conn.refreshToken);
    await prisma.platformConnection.update({
      where: { platform: "ebay" },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
    return NextResponse.json({ refreshed: true, expiresAt: tokens.expiresAt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
