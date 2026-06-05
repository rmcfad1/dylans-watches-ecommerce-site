import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [totalItems, availableItems, listedItems, orders] = await Promise.all([
    prisma.inventoryItem.count({ where: { status: { not: "archived" } } }),
    prisma.inventoryItem.count({ where: { status: "available" } }),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { listing: { include: { inventoryItem: true } } },
    }),
  ]);

  const totalRevenue = orders.reduce((sum: number, o: { salePrice: number; profit: number | null }) => sum + o.salePrice, 0);
  const totalProfit = orders.reduce((sum: number, o: { salePrice: number; profit: number | null }) => sum + (o.profit ?? 0), 0);

  return NextResponse.json({
    totalItems,
    availableItems,
    activeListings: listedItems,
    totalOrders: orders.length,
    totalRevenue,
    totalProfit,
    recentOrders: orders,
  });
}
