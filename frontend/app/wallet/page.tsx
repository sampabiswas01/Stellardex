"use client";
import StellarWalletPanel from "@/components/wallet/stellar-wallet-panel";

export default function WalletPage() {
  return (
    <div
      className="min-h-screen pt-16"
      style={{
        background: "var(--ray-app-bg)",
        fontFamily: "var(--font-space), var(--font-inter), system-ui",
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(34,209,248,0.055) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Stellar Wallet — Freighter Integration
          </h1>
          <p className="text-sm text-gray-400">
            Detect → Connect → Balance → Send → Transaction hash, all on Stellar
            Testnet.
          </p>
        </header>

        <StellarWalletPanel />
      </div>
    </div>
  );
}
