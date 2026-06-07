import { CartProvider } from "@/lib/cart";
import StoreHeader from "@/components/store/StoreHeader";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200/60 py-10">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#6e6e73]">
            <div className="flex items-center gap-2 font-medium text-[#1d1d1f]">
              Dylan&apos;s Watches
            </div>
            <p>Certified used watches &amp; electronics.</p>
            <p>© {new Date().getFullYear()} Dylan&apos;s Watches</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
