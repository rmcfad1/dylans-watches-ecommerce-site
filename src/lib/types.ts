export type ItemStatus = "available" | "listed" | "sold" | "archived";
export type ListingStatus = "draft" | "active" | "sold" | "ended";
export type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";
export type Platform = "meta" | "ebay" | "mercari";
export type Condition = "Excellent" | "Good" | "Fair" | "Poor";
export type Category = "Smartwatch" | "Watch" | "Electronics" | "Other";

export interface InventoryItemWithListings {
  id: string;
  title: string;
  description: string | null;
  purchasePrice: number;
  condition: string;
  category: string;
  brand: string | null;
  model: string | null;
  notes: string | null;
  images: string;
  status: string;
  listings: ListingWithOrder[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingWithOrder {
  id: string;
  inventoryItemId: string;
  platform: string;
  platformListingId: string | null;
  platformUrl: string | null;
  status: string;
  listingTitle: string;
  listingDesc: string | null;
  listedPrice: number;
  order: OrderRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderRecord {
  id: string;
  listingId: string;
  platform: string;
  platformOrderId: string | null;
  buyerName: string | null;
  salePrice: number;
  shippingCost: number | null;
  profit: number | null;
  labelUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalItems: number;
  availableItems: number;
  activeListings: number;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  recentOrders: OrderRecord[];
}
