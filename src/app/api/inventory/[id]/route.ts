import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { listings: { include: { order: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description ?? null,
      purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) : undefined,
      condition: body.condition,
      category: body.category,
      brand: body.brand ?? null,
      model: body.model ?? null,
      notes: body.notes ?? null,
      images: body.images ? JSON.stringify(body.images) : undefined,
      status: body.status,
      shopEnabled: body.shopEnabled !== undefined ? Boolean(body.shopEnabled) : undefined,
      shopPrice: body.shopPrice !== undefined ? (body.shopPrice ? Number(body.shopPrice) : null) : undefined,
      shopTitle: body.shopTitle ?? null,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.inventoryItem.update({
    where: { id },
    data: { status: "archived" },
  });
  return NextResponse.json({ success: true });
}
