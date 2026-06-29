import Link from "next/link";
import { Zap, Globe, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050816]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-glow-sm">
                <Zap size={15} className="text-white fill-white" />
              </div>
              <span className="font-bold text-[17px]">
                <span className="text-white">Stellar</span>
                <span className="gradient-text">DEX</span>
              </span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              The next-generation AMM DEX on Stellar Soroban. Swap XLM &amp; USDC
              with ultra-low fees and lightning-fast settlement.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
              Live on Stellar Testnet
            </div>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Product</p>
            <div className="space-y-2">
              {[
                { href: "/swap", label: "Swap" },
                { href: "/liquidity", label: "Pools" },
                { href: "/portfolio", label: "Portfolio" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-sm text-gray-400 hover:text-white transition"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Resources</p>
            <div className="space-y-2">
              {[
                { href: "https://stellar.org/developers/soroban", label: "Soroban Docs" },
                { href: "https://stellar.expert/explorer/testnet", label: "Block Explorer" },
                { href: "https://www.freighter.app", label: "Get Freighter" },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-gray-400 hover:text-white transition"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2025 StellarDEX. Built on{" "}
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-white transition"
            >
              Stellar
            </a>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-gray-600 hover:text-white rounded-lg hover:bg-white/[0.05] transition"
              aria-label="Stellar Network"
            >
              <Globe size={16} />
            </a>
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noreferrer"
              className="p-2 text-gray-600 hover:text-white rounded-lg hover:bg-white/[0.05] transition"
              aria-label="Block Explorer"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
