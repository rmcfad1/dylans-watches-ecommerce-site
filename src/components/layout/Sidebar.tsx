"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth-actions";
import {
  LayoutDashboard,
  Box,
  Package,
  Tag,
  ShoppingBag,
  Settings,
  Watch,
  Sparkles,
  LogOut,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/items", label: "Items", icon: Box },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/generate", label: "AI Generator", icon: Sparkles },
  { href: "/listings", label: "Listings", icon: Tag },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 flex items-center gap-2 border-b border-gray-700">
        <Watch className="w-6 h-6 text-amber-400" />
        <div>
          <p className="font-bold text-sm leading-tight">Dylan&apos;s Watches</p>
          <p className="text-xs text-gray-400">Reseller Hub</p>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-amber-500 text-gray-900"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-gray-700">
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
