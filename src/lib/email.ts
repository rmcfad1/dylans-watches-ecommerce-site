import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = () => process.env.RESEND_FROM_EMAIL ?? "orders@dylans-watches.com";
const ADMIN = () => process.env.ADMIN_EMAIL ?? "bryan@mainstreetaiconsultants.com";

interface Address {
  line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

function formatAddress(addr: Address | null): string {
  if (!addr) return "No address provided";
  return [addr.line1, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(", ");
}

export async function sendOrderNotification(opts: {
  customerName: string | null;
  customerEmail: string | null;
  itemTitle: string;
  salePrice: number;
  shippingCost: number;
  taxCollected?: number;
  shippingAddress: Address | null;
  orderId: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const addr = formatAddress(opts.shippingAddress);
  const tax = opts.taxCollected ?? 0;
  const taxRow = tax > 0 ? `<tr><td style="padding:6px 12px;color:#666">Tax</td><td style="padding:6px 12px">$${tax.toFixed(2)}</td></tr>` : "";
  await getResend().emails.send({
    from: FROM(),
    to: ADMIN(),
    subject: `New order: ${opts.itemTitle}`,
    html: `
      <h2>New Order — Dylan's Watches</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="padding:6px 12px;color:#666">Item</td><td style="padding:6px 12px;font-weight:bold">${opts.itemTitle}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Customer</td><td style="padding:6px 12px">${opts.customerName ?? "Unknown"} &lt;${opts.customerEmail ?? "—"}&gt;</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Ship to</td><td style="padding:6px 12px">${addr}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Sale price</td><td style="padding:6px 12px">$${opts.salePrice.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Shipping</td><td style="padding:6px 12px">$${opts.shippingCost.toFixed(2)}</td></tr>
        ${taxRow}
        <tr><td style="padding:6px 12px;color:#666">Order ID</td><td style="padding:6px 12px;font-size:11px;color:#999">${opts.orderId}</td></tr>
      </table>
      <p style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_STORE_URL ?? "https://dylans-watches-ecommerce-site.vercel.app"}/orders" style="background:#f59e0b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in Admin →</a></p>
    `,
  });
}

export async function sendOrderConfirmation(opts: {
  customerName: string | null;
  customerEmail: string;
  itemTitle: string;
  salePrice: number;
  shippingCost: number;
  taxCollected?: number;
  shippingAddress: Address | null;
  orderId: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const addr = formatAddress(opts.shippingAddress);
  const tax = opts.taxCollected ?? 0;
  const taxRow = tax > 0 ? `<tr><td style="padding:6px 12px;color:#666">Tax</td><td style="padding:6px 12px">$${tax.toFixed(2)}</td></tr>` : "";
  const total = opts.salePrice + opts.shippingCost + tax;
  await getResend().emails.send({
    from: FROM(),
    to: opts.customerEmail,
    subject: `Order confirmed — ${opts.itemTitle}`,
    html: `
      <h2>Thanks for your order${opts.customerName ? `, ${opts.customerName.split(" ")[0]}` : ""}!</h2>
      <p style="font-family:sans-serif;font-size:14px;color:#444">Your order has been received and is being prepared for shipment.</p>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;margin-top:16px">
        <tr><td style="padding:6px 12px;color:#666">Item</td><td style="padding:6px 12px;font-weight:bold">${opts.itemTitle}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Ship to</td><td style="padding:6px 12px">${addr}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Subtotal</td><td style="padding:6px 12px">$${opts.salePrice.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 12px;color:#666">Shipping</td><td style="padding:6px 12px">$${opts.shippingCost.toFixed(2)}</td></tr>
        ${taxRow}
        <tr><td style="padding:6px 12px;color:#666;font-weight:bold">Total paid</td><td style="padding:6px 12px;font-weight:bold">$${total.toFixed(2)}</td></tr>
      </table>
      <p style="font-family:sans-serif;font-size:13px;color:#999;margin-top:24px">You'll receive another email with your tracking number once the item ships.</p>
      <p style="font-family:sans-serif;font-size:13px;color:#999">Questions? Reply to this email.</p>
    `,
  });
}

export async function sendShipmentNotification(opts: {
  customerName: string | null;
  customerEmail: string;
  itemTitle: string;
  trackingCode: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: FROM(),
    to: opts.customerEmail,
    subject: `Your order has shipped — ${opts.itemTitle}`,
    html: `
      <h2>Your order is on its way!</h2>
      <p style="font-family:sans-serif;font-size:14px;color:#444">Your item <strong>${opts.itemTitle}</strong> has been shipped via USPS.</p>
      <p style="font-family:sans-serif;font-size:14px;margin-top:16px">
        <strong>Tracking number:</strong>
        <a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${opts.trackingCode}" style="color:#f59e0b">${opts.trackingCode}</a>
      </p>
      <p style="font-family:sans-serif;font-size:13px;color:#999;margin-top:24px">Track your package at usps.com or click the link above.</p>
    `,
  });
  // Also notify admin
  await getResend().emails.send({
    from: FROM(),
    to: ADMIN(),
    subject: `Shipped: ${opts.itemTitle} — tracking ${opts.trackingCode}`,
    html: `<p>Order shipped. Tracking: <a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${opts.trackingCode}">${opts.trackingCode}</a></p>`,
  });
}

export async function sendDeliveryNotification(opts: {
  customerName: string | null;
  customerEmail: string;
  itemTitle: string;
  trackingCode: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: FROM(),
    to: opts.customerEmail,
    subject: `Delivered — ${opts.itemTitle}`,
    html: `
      <h2>Your order has been delivered!</h2>
      <p style="font-family:sans-serif;font-size:14px;color:#444">Your item <strong>${opts.itemTitle}</strong> has been delivered.</p>
      <p style="font-family:sans-serif;font-size:13px;color:#999;margin-top:16px">Enjoy your purchase! If you have any questions, just reply to this email.</p>
    `,
  });
  await getResend().emails.send({
    from: FROM(),
    to: ADMIN(),
    subject: `Delivered: ${opts.itemTitle} — ${opts.trackingCode}`,
    html: `<p>Package delivered. Tracking: ${opts.trackingCode}</p>`,
  });
}
