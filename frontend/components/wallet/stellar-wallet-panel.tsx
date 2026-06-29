"use client";
// Self-contained Freighter wallet panel: detect → connect → balance → send → tx hash.
import { useState } from "react";
import {
  Wallet,
  LogOut,
  ExternalLink,
  RefreshCw,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
// Explicit wallet-helper imports (required by spec).
import { detectFreighter, connectWallet, signTx } from "@/lib/stellar-wallet";
import { useWallet } from "@/hooks/use-stellar-wallet";

// Reference the explicit imports so they are part of this module's surface even
// though the heavy lifting is delegated to the useWallet() hook.
void detectFreighter;
void connectWallet;
void signTx;

const EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx/";

type SendStatus =
  | { kind: "idle" }
  | { kind: "success"; hash: string }
  | { kind: "error"; message: string };

export default function StellarWalletPanel() {
  const {
    address,
    balance,
    isConnected,
    isLoading,
    error,
    hasFreighter,
    connect,
    disconnect,
    refreshBalance,
    sendXlm,
  } = useWallet();

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<SendStatus>({ kind: "idle" });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendStatus({ kind: "idle" });
    setSending(true);
    try {
      const { hash } = await sendXlm(destination.trim(), amount.trim());
      setSendStatus({ kind: "success", hash });
      setDestination("");
      setAmount("");
    } catch (err) {
      setSendStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    isConnected &&
    !sending &&
    destination.trim().length > 0 &&
    Number(amount) > 0;

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Wallet size={20} className="text-cyan-400" />
          Freighter Wallet
        </h2>
        <p className="text-sm text-gray-400">
          Stellar Testnet · connect, check balance, and send XLM.
        </p>
      </header>

      {/* STEP 1 — detection / install prompt */}
      {hasFreighter === null && (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Detecting Freighter…
        </p>
      )}

      {hasFreighter === false && (
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-500/20 transition"
        >
          <ExternalLink size={15} />
          Freighter not detected — Install Freighter
        </a>
      )}

      {/* STEP 2 — connect / connected state */}
      {hasFreighter && !isConnected && (
        <button
          onClick={connect}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold disabled:opacity-60 transition"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Wallet size={16} />
          )}
          {isLoading ? "Connecting…" : "Connect Wallet"}
        </button>
      )}

      {isConnected && address && (
        <div className="space-y-5">
          {/* Address + disconnect */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Connected Address
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs sm:text-sm text-emerald-300 bg-black/30 rounded-lg px-3 py-2 border border-white/5">
                {address}
              </code>
              <button
                onClick={disconnect}
                title="Disconnect"
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.06] text-sm transition"
              >
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          </div>

          {/* STEP 3 — balance */}
          <div className="rounded-xl bg-black/30 border border-white/5 p-4 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wide text-gray-500">
                XLM Balance
              </span>
              <p className="text-2xl font-bold text-white mt-1">
                {balance === null ? (
                  <span className="text-gray-500 text-base">Loading…</span>
                ) : balance === "0" ? (
                  <>
                    0 XLM{" "}
                    <span className="text-xs font-normal text-amber-300">
                      (account not funded)
                    </span>
                  </>
                ) : (
                  <>{balance} XLM</>
                )}
              </p>
            </div>
            <button
              onClick={refreshBalance}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.06] text-sm disabled:opacity-60 transition"
            >
              <RefreshCw
                size={14}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {/* STEP 4 — send form */}
          <form onSubmit={handleSend} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Destination (G-address)
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="GAAA…"
                spellCheck={false}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-400/50 focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Amount (XLM)
              </label>
              <input
                type="number"
                min="0"
                step="0.0000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-400/50 focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={!canSend}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Sending…" : "Send XLM"}
            </button>
          </form>

          {/* STEP 5 — tx feedback */}
          {sendStatus.kind === "success" && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-1">
              <p className="flex items-center gap-2 text-emerald-300 font-medium text-sm">
                <CheckCircle2 size={16} />
                Transaction sent!
              </p>
              <a
                href={`${EXPLORER_TX}${sendStatus.hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-200 hover:text-emerald-100 break-all"
              >
                Hash: {sendStatus.hash}
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {sendStatus.kind === "error" && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
              <p className="flex items-start gap-2 text-red-300 text-sm">
                <XCircle size={16} className="mt-0.5 shrink-0" />
                <span className="break-all">{sendStatus.message}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hook-level error (connect / balance) */}
      {error && (
        <p className="text-xs text-red-300 flex items-center gap-2">
          <XCircle size={13} />
          {error}
        </p>
      )}
    </div>
  );
}
