"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Menu, X } from "lucide-react";
import WalletButton from "@/components/WalletButton";

const NAV_LINKS = [
  { href: "/swap", label: "Swap" },
  { href: "/liquidity", label: "Pools" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/wallet", label: "Wallet" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-white/[0.06] shadow-[0_4px_40px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-purple transition-all duration-300">
            <Zap size={15} className="text-white fill-white" />
          </div>
          <span className="font-bold text-[17px] tracking-tight">
            <span className="text-white">Stellar</span>
            <span className="gradient-text">DEX</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  active
                    ? "text-white bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <WalletButton />
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden glass-md border-b border-white/[0.07] px-4 pb-4 pt-2 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.05] rounded-xl transition"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
