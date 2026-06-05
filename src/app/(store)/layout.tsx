import { CartProvider } from "@/lib/cart";
import StoreHeader from "@/components/store/StoreHeader";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Dylan&apos;s Watches. All rights reserved.
        </footer>
      </div>
    </CartProvider>
  );
}
