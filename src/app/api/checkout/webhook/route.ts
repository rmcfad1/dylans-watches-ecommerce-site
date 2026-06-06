import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendOrderNotification, sendOrderConfirmation, sendDeliveryNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const stripeSig = req.headers.get("stripe-signature");

  // ── EasyPost / Shippo tracking webhook ────────────────────────────────────
  if (!stripeSig) {
    let event: { description?: string; result?: { tracking_code?: string; status?: string } };
    try {
      event = JSON.parse(body);
    } catch {
      return new NextResponse("Bad request", { status: 400 });
    }

    if (event.description?.startsWith("tracker.") && event.result?.status === "delivered") {
      const trackingCode = event.result.tracking_code;
      if (trackingCode) {
        const order = await prisma.order.findFirst({
          where: { trackingCode },
          include: { item: true, customer: true },
        });
        if (order) {
          const deliveredStatus = await prisma.orderStatus.findUnique({ where: { name: "delivered" } });
          await prisma.order.update({
            where: { id: order.id },
            data: { statusId: deliveredStatus!.id },
          });
          if (order.customer?.email) {
            await sendDeliveryNotification({
              customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
              customerEmail: order.customer.email,
              itemTitle: order.item.title,
              trackingCode,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  }

  // ── Stripe webhook ─────────────────────────────────────────────────────────
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Webhook secret not configured", { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, stripeSig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const itemIds = (session.metadata?.itemIds ?? "").split(",").filter(Boolean);
    const customerDetails = session.customer_details;
    const s = session as unknown as {
      shipping_details?: { name?: string; address?: Record<string, string> };
      shipping?: { name?: string; address?: Record<string, string> };
    };
    const shippingDetails = s.shipping_details ?? s.shipping ?? null;
    const shippingCost = (session.shipping_cost?.amount_total ?? 0) / 100;
    const amountTotal = (session.amount_total ?? 0) / 100;
    const itemTotal = amountTotal - shippingCost;
    const perItemPrice = itemIds.length > 0 ? itemTotal / itemIds.length : 0;
    const shippingAddress = shippingDetails?.address ?? customerDetails?.address ?? null;
    const shippingName = shippingDetails?.name ?? customerDetails?.name ?? null;
    const customerEmail = customerDetails?.email ?? null;

    const paidStatus = await prisma.orderStatus.findUnique({ where: { name: "paid" } });

    for (const itemId of itemIds) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (!item) continue;

      // Create or find Customer
      let customerId: string | null = null;
      if (customerEmail) {
        const nameParts = (shippingName ?? "").trim().split(" ");
        const firstName = nameParts[0] || "Guest";
        const lastName = nameParts.slice(1).join(" ") || "Customer";
        const addr = shippingAddress as Record<string, string> | null;

        const customer = await prisma.customer.upsert({
          where: { email: customerEmail },
          create: {
            firstName,
            lastName,
            email: customerEmail,
            street: addr?.line1 ?? null,
            street2: addr?.line2 ?? null,
            city: addr?.city ?? null,
            state: addr?.state ?? null,
            zip: addr?.postal_code ?? null,
            country: addr?.country ?? "US",
            dateOfLastPurchase: new Date(),
          },
          update: {
            street: addr?.line1 ?? undefined,
            street2: addr?.line2 ?? undefined,
            city: addr?.city ?? undefined,
            state: addr?.state ?? undefined,
            zip: addr?.postal_code ?? undefined,
            dateOfLastPurchase: new Date(),
          },
        });
        customerId = customer.id;
      }

      const listing = await prisma.listing.findUnique({ where: { itemId } });

      const order = await prisma.order.create({
        data: {
          itemId,
          customerId,
          statusId: paidStatus!.id,
          listingId: listing?.id ?? null,
          stripeSessionId: session.id,
          salePrice: perItemPrice,
          shippingCost: shippingCost / itemIds.length,
        },
      });

      // Mark item out of stock
      await prisma.inventory.updateMany({
        where: { itemId },
        data: { quantity: 0, dateOfLastSale: new Date() },
      });

      const parsedAddress = shippingAddress as { line1?: string; city?: string; state?: string; postal_code?: string } | null;

      await sendOrderNotification({
        customerName: shippingName,
        customerEmail,
        itemTitle: item.title,
        salePrice: perItemPrice,
        shippingCost: shippingCost / itemIds.length,
        shippingAddress: parsedAddress,
        orderId: order.id,
      });

      if (customerEmail) {
        await sendOrderConfirmation({
          customerName: shippingName,
          customerEmail,
          itemTitle: item.title,
          salePrice: perItemPrice,
          shippingCost: shippingCost / itemIds.length,
          shippingAddress: parsedAddress,
          orderId: order.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
