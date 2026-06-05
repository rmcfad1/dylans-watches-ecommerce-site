import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    include: { listings: { include: { order: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item = await prisma.inventoryItem.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      purchasePrice: Number(body.purchasePrice),
      condition: body.condition,
      category: body.category,
      brand: body.brand ?? null,
      model: body.model ?? null,
      notes: body.notes ?? null,
      images: body.images ? JSON.stringify(body.images) : "[]",
      status: "available",
    },
  });
  return NextResponse.json(item, { status: 201 });
}
