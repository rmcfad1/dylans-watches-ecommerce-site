export type ItemStatus = "available" | "listed" | "sold" | "archived";
export type PlatformName = "eBay" | "meta" | "mercari";
export type OrderStatusName = "paid" | "shipped" | "delivered" | "returned";
export type Condition = "Excellent" | "Good" | "Fair" | "Poor";
export type Category = "Smartwatch" | "Watch" | "Electronics" | "Other";

export interface ItemRecord {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string;
  condition: string;
  notes: string | null;
  archived: boolean;
  status: ItemStatus;
  inventory: { quantity: number; dateOfLastPurchase: string | null } | null;
  listings: ListingRecord[];
  createdAt: string;
}

export interface ListingRecord {
  id: string;
  itemId: string;
  listingTitle: string;
  listingDesc: string | null;
  listedPrice: number;
  freeShipping: boolean;
  listedOnEbay: boolean;
  listedOnMeta: boolean;
  listedOnMercari: boolean;
  orders: OrderRecord[];
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface OrderRecord {
  id: string;
  itemId: string;
  item: { id: string; title: string };
  customer: CustomerRecord | null;
  orderStatus: { id: string; name: string };
  listing: { id: string } | null;
  salePrice: number;
  shippingCost: number;
  trackingCode: string | null;
  labelUrl: string | null;
  stripeSessionId: string | null;
  createdAt: string;
}
