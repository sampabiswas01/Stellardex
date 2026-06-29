"use client";
import { useEffect, useState } from "react";
import { isConnected, getPublicKey, requestAccess } from "@stellar/freighter-api";
import { useDexStore } from "@/lib/store";
import { Wallet, LogOut, ExternalLink } from "lucide-react";

export default function WalletButton() {
  const { walletAddress, setWalletAddress } = useDexStore();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isConnected().then((c) => setAvailable(c));
  }, []);

  async function connect() {
    try {
      await requestAccess();
      const pub = await getPublicKey();
      if (pub) setWalletAddress(pub);
    } catch (err) {
      console.error("Wallet connect:", err);
    }
  }

  function disconnect() {
    setWalletAddress(null);
  }

  if (available === false) {
    return (
      <a
        href="https://www.freighter.app"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl btn-glow text-white"
      >
        <ExternalLink size={14} />
        Install Freighter
      </a>
    );
  }

  if (walletAddress) {
    return (
      <button
        onClick={disconnect}
        title={walletAddress}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 live-dot" />
        {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
        <LogOut size={13} className="text-gray-500 ml-1" />
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl btn-glow text-white"
    >
      <Wallet size={15} />
      Connect Wallet
    </button>
  );
}
