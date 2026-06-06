import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { createLabel } from "@/lib/shipping";
import { sendShipmentNotification } from "@/lib/email";

export async function GET() {
  const orders = await prisma.order.findMany({
    include: {
      item: true,
      customer: true,
      orderStatus: true,
      listing: { include: { platform: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Backfill customer address from Stripe for orders missing it
  const stripe = getStripe();
  await Promise.all(
    orders
      .filter((o) => !o.customer?.street && o.stripeSessionId)
      .map(async (o) => {
        try {
          const session = await stripe.checkout.sessions.retrieve(o.stripeSessionId!);
          const s = session as unknown as {
            shipping_details?: { name?: string; address?: Record<string, string> };
            shipping?: { name?: string; address?: Record<string, string> };
          };
          const shipping = s.shipping_details ?? s.shipping ?? null;
          const address = shipping?.address ?? session.customer_details?.address ?? null;
          if (address && o.customerId) {
            await prisma.customer.update({
              where: { id: o.customerId },
              data: {
                street: address.line1 ?? undefined,
                street2: address.line2 ?? undefined,
                city: address.city ?? undefined,
                state: address.state ?? undefined,
                zip: address.postal_code ?? undefined,
              },
            });
          }
        } catch {}
      })
  );

  return NextResponse.json(orders);
}

export async function PUT(req: NextRequest) {
  const { orderId, weightOz, manualAddress } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { item: true, customer: true, orderStatus: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  type Addr = { line1?: string; city?: string; state?: string; postal_code?: string; country?: string };
  let address: Addr | null = manualAddress ?? null;
  if (!address && order.customer) {
    const c = order.customer;
    if (c.street) {
      address = {
        line1: c.street ?? undefined,
        city: c.city ?? undefined,
        state: c.state ?? undefined,
        postal_code: c.zip ?? undefined,
        country: c.country ?? "US",
      };
    }
  }

  if (!address?.line1) return NextResponse.json({ error: "No shipping address on order" }, { status: 400 });

  try {
    const label = await createLabel({
      toName: order.customer
        ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
        : "Customer",
      toAddress: address,
      weightOz: weightOz ?? 8,
    });

    const shippedStatus = await prisma.orderStatus.findUnique({ where: { name: "shipped" } });
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: label.trackingCode,
        labelUrl: label.labelUrl,
        statusId: shippedStatus!.id,
      },
      include: { item: true, customer: true, orderStatus: true, listing: { include: { platform: true } } },
    });

    if (order.customer?.email) {
      await sendShipmentNotification({
        customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
        customerEmail: order.customer.email,
        itemTitle: order.item.title,
        trackingCode: label.trackingCode,
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
