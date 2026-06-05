import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const orders = await prisma.storeOrder.findMany({
    include: { inventoryItem: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
