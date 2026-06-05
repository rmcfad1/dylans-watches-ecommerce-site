import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { PlatformConnection } from "@/generated/prisma/client";

export async function GET() {
  const connections = await prisma.platformConnection.findMany();
  // Never expose tokens to the client
  return NextResponse.json(
    connections.map((c: PlatformConnection) => ({
      id: c.id,
      platform: c.platform,
      isActive: c.isActive,
      shopId: c.shopId,
      catalogId: c.catalogId,
      pageId: c.pageId,
      hasToken: !!c.accessToken,
      expiresAt: c.expiresAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const connection = await prisma.platformConnection.upsert({
    where: { platform: body.platform },
    create: {
      platform: body.platform,
      accessToken: body.accessToken ?? null,
      refreshToken: body.refreshToken ?? null,
      shopId: body.shopId ?? null,
      pageId: body.pageId ?? null,
      catalogId: body.catalogId ?? null,
      isActive: body.isActive ?? false,
    },
    update: {
      accessToken: body.accessToken ?? undefined,
      refreshToken: body.refreshToken ?? undefined,
      shopId: body.shopId ?? undefined,
      pageId: body.pageId ?? undefined,
      catalogId: body.catalogId ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  return NextResponse.json({ id: connection.id, platform: connection.platform, isActive: connection.isActive });
}
