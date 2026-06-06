export interface StripeAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export async function createLabel(opts: {
  toName: string;
  toAddress: StripeAddress;
  weightOz: number;
}): Promise<{ trackingCode: string; labelUrl: string; rate: number }> {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) throw new Error("SHIPPO_API_KEY not set");

  const headers = {
    Authorization: `ShippoToken ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Create shipment with async:false so rates come back immediately
  const shipRes = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers,
    body: JSON.stringify({
      address_from: {
        name: process.env.SELLER_NAME ?? "Dylan's Watches",
        street1: process.env.SELLER_STREET,
        city: process.env.SELLER_CITY,
        state: process.env.SELLER_STATE,
        zip: process.env.SELLER_ZIP,
        country: "US",
        phone: process.env.SELLER_PHONE ?? "",
        email: process.env.ADMIN_EMAIL ?? "orders@dylans-watches.com",
      },
      address_to: {
        name: opts.toName,
        street1: opts.toAddress.line1,
        street2: opts.toAddress.line2 ?? undefined,
        city: opts.toAddress.city,
        state: opts.toAddress.state,
        zip: opts.toAddress.postal_code,
        country: opts.toAddress.country ?? "US",
      },
      parcels: [{
        length: "6",
        width: "4",
        height: "3",
        distance_unit: "in",
        weight: String(opts.weightOz),
        mass_unit: "oz",
      }],
      async: false,
    }),
  });

  if (!shipRes.ok) {
    const err = await shipRes.text();
    throw new Error(`Shippo error: ${err}`);
  }

  const shipment = await shipRes.json();
  const rates: Array<{ object_id: string; provider: string; amount: string; servicelevel: { name: string } }> =
    shipment.rates ?? [];

  if (!rates.length) throw new Error("No shipping rates returned");

  const uspsRates = rates.filter((r) => r.provider === "USPS");
  const pool = uspsRates.length > 0 ? uspsRates : rates;
  const cheapest = pool.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0];

  // Purchase label
  const txRes = await fetch("https://api.goshippo.com/transactions/", {
    method: "POST",
    headers,
    body: JSON.stringify({
      rate: cheapest.object_id,
      label_file_type: "PDF",
      async: false,
    }),
  });

  if (!txRes.ok) {
    const err = await txRes.text();
    throw new Error(`Shippo transaction error: ${err}`);
  }

  const tx = await txRes.json();

  if (tx.status !== "SUCCESS") {
    const msgs = (tx.messages ?? []).map((m: { text: string }) => m.text).join(", ");
    throw new Error(`Label failed: ${msgs || tx.status}`);
  }

  return {
    trackingCode: tx.tracking_number,
    labelUrl: tx.label_url,
    rate: parseFloat(cheapest.amount),
  };
}
