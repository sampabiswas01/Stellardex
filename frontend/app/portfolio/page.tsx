"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { scValToNative } from "@stellar/stellar-sdk";
import {
  Wallet, TrendingUp, Droplets, ArrowLeftRight, Copy, ExternalLink,
  RefreshCw, Activity, Layers, Check,
} from "lucide-react";
import { useDexStore } from "@/lib/store";
import {
  fromStroops, XLM_DECIMALS, USDC_DECIMALS, LP_DECIMALS,
  getRpcClient, POOL_ID,
} from "@/lib/stellar";
import { spotPrice } from "@/lib/math";

/* ── types ── */
type EventType = "Swap" | "Deposit" | "Withdraw" | "Event";
interface OnChainEvent {
  id: string;
  type: EventType;
  ledger: number;
  txHash: string;
}

/* ── helpers ── */
function usd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function num(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/* ── token icon ── */
function TokenIcon({ symbol, size = 36 }: { symbol: "XLM" | "USDC"; size?: number }) {
  const isXlm = symbol === "XLM";
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: isXlm
          ? "linear-gradient(135deg,#60a5fa,#4338ca)"
          : "linear-gradient(135deg,#3b82f6,#1d4ed8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 700, color: "#fff",
      }}
    >
      {isXlm ? "✦" : "$"}
    </div>
  );
}

/* ── event style map ── */
const EV_COLOR: Record<EventType, string> = {
  Swap:    "var(--ray-secondary)",
  Deposit: "var(--ray-positive)",
  Withdraw:"var(--ray-negative)",
  Event:   "var(--ray-text-muted)",
};
const EV_BG: Record<EventType, string> = {
  Swap:    "rgba(34,209,248,0.12)",
  Deposit: "rgba(76,220,193,0.12)",
  Withdraw:"rgba(255,66,114,0.12)",
  Event:   "rgba(171,196,255,0.07)",
};
const EV_SYMBOL: Record<EventType, string> = {
  Swap: "⇄", Deposit: "+", Withdraw: "−", Event: "•",
};

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function PortfolioPage() {
  const {
    walletAddress,
    reserveXlm, reserveUsdc,
    lpBalance, lpTotalSupply,
    xlmBalance, usdcBalance,
    reservesLoading, refreshReserves, txStatus,
  } = useDexStore();

  const [events, setEvents]           = useState<OnChainEvent[]>([]);
  const [evLoading, setEvLoading]     = useState(false);
  const [copied, setCopied]           = useState(false);

  /* ── derived maths ── */
  const price        = spotPrice(reserveXlm, reserveUsdc);
  const xlmAmt       = fromStroops(xlmBalance,    XLM_DECIMALS);
  const usdcAmt      = fromStroops(usdcBalance,   USDC_DECIMALS);
  const lpAmt        = fromStroops(lpBalance,     LP_DECIMALS);
  const lpTotalAmt   = fromStroops(lpTotalSupply, LP_DECIMALS);
  const resXlmAmt    = fromStroops(reserveXlm,    XLM_DECIMALS);
  const resUsdcAmt   = fromStroops(reserveUsdc,   USDC_DECIMALS);
  const shareFrac    = lpTotalAmt > 0 ? lpAmt / lpTotalAmt : 0;
  const sharePct     = shareFrac * 100;
  const posXlm       = resXlmAmt  * shareFrac;
  const posUsdc      = resUsdcAmt * shareFrac;
  const tvl          = resXlmAmt  * price + resUsdcAmt;
  const xlmUsd       = xlmAmt     * price;
  const posUsd       = posXlm     * price + posUsdc;
  const walletUsd    = xlmUsd + usdcAmt;
  const totalUsd     = walletUsd  + posUsd;

  const connected   = !!walletAddress;
  const hasPosition = lpBalance > 0n;

  /* ── on-chain events ── */
  const loadEvents = useCallback(async () => {
    if (!POOL_ID) return;
    setEvLoading(true);
    try {
      const server = getRpcClient();
      const res = await server.getEvents({
        filters: [{ type: "contract", contractIds: [POOL_ID] }],
        limit: 12,
      });
      const rows = (res.events ?? []).map((ev: any) => {
        const topics = (ev.topic ?? []).map((t: any) => {
          try { return String(scValToNative(t)); } catch { return ""; }
        });
        const raw = topics[0]?.toLowerCase() ?? "";
        const type: EventType =
          raw.includes("deposit") ? "Deposit"
          : raw.includes("swap")   ? "Swap"
          : raw.includes("withdraw") ? "Withdraw"
          : "Event";
        return { id: ev.id, type, ledger: Number(ev.ledger), txHash: ev.txHash };
      });
      setEvents(rows.reverse().slice(0, 10));
    } catch { /* silently skip */ }
    finally { setEvLoading(false); }
  }, []);

  useEffect(() => {
    refreshReserves();
    loadEvents();
    const id = setInterval(() => { refreshReserves(); loadEvents(); }, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (txStatus === "success") { refreshReserves(); loadEvents(); }
  }, [txStatus]);

  function copyAddr() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleRefresh() {
    refreshReserves();
    loadEvents();
  }

  /* ════════════════════ JSX ════════════════════ */
  return (
    <div
      className="min-h-screen pt-16"
      style={{
        background: "var(--ray-app-bg)",
        fontFamily: "var(--font-space), var(--font-inter), system-ui",
      }}
    >
      {/* ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(34,209,248,0.055) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--ray-text-primary)", fontFamily: "var(--font-space), system-ui" }}
              >
                Portfolio
              </h1>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: "rgba(254,211,58,0.1)",
                  color: "var(--ray-warning)",
                  border: "1px solid rgba(254,211,58,0.2)",
                }}
              >
                Testnet
              </span>
            </div>
            {connected ? (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono" style={{ color: "var(--ray-text-muted)" }}>
                  {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                </span>
                <button
                  onClick={copyAddr}
                  className="hover:opacity-70 transition"
                  style={{ color: "var(--ray-text-muted)" }}
                  aria-label="Copy address"
                >
                  {copied ? <Check size={11} style={{ color: "var(--ray-positive)" }} /> : <Copy size={11} />}
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${walletAddress}`}
                  target="_blank" rel="noreferrer"
                  className="hover:opacity-70 transition"
                  style={{ color: "var(--ray-text-muted)" }}
                  aria-label="View on explorer"
                >
                  <ExternalLink size={11} />
                </a>
              </div>
            ) : (
              <p className="text-xs mt-1" style={{ color: "var(--ray-text-muted)" }}>
                Connect wallet to view your positions
              </p>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={reservesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80 shrink-0"
            style={{
              background: "var(--ray-tp-07)",
              border: "1px solid var(--ray-tp-12)",
              color: "var(--ray-text-secondary)",
            }}
          >
            <RefreshCw size={12} className={reservesLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Net Worth Banner (connected only) ── */}
        {connected && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: "var(--ray-bg-light)",
              border: "1px solid var(--ray-tp-12)",
            }}
          >
            {/* decorative glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 55% 70% at 90% 10%, rgba(34,209,248,0.08) 0%, transparent 60%)",
              }}
            />

            <p
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--ray-text-muted)" }}
            >
              Total Portfolio Value
            </p>

            <p
              className="font-bold tabular-nums mb-5"
              style={{
                color: "var(--ray-text-primary)",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                lineHeight: 1.05,
              }}
            >
              {reservesLoading
                ? <span style={{ color: "var(--ray-text-muted)" }}>—</span>
                : usd(totalUsd)}
            </p>

            {/* Breakdown bar + legend */}
            {totalUsd > 0 && (
              <div className="space-y-3">
                <div
                  className="h-1.5 rounded-full overflow-hidden flex"
                  style={{ background: "var(--ray-tp-07)", gap: 2 }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(walletUsd / totalUsd) * 100}%`,
                      background: "linear-gradient(90deg,#60a5fa,#4338ca)",
                    }}
                  />
                  {posUsd > 0 && (
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(posUsd / totalUsd) * 100}%`,
                        background: "var(--ray-btn-gradient)",
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#60a5fa" }} />
                    <span style={{ color: "var(--ray-text-muted)" }}>Wallet</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                      {usd(walletUsd)}
                    </span>
                  </div>
                  {posUsd > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--ray-secondary)" }} />
                      <span style={{ color: "var(--ray-text-muted)" }}>Pool Position</span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                        {usd(posUsd)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Connect Prompt (disconnected) ── */}
        {!connected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-10 flex flex-col items-center text-center"
            style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--ray-tp-07)", border: "1px solid var(--ray-tp-12)" }}
            >
              <Wallet size={26} style={{ color: "var(--ray-primary)" }} />
            </div>
            <p className="text-base font-bold mb-1.5" style={{ color: "var(--ray-text-primary)" }}>
              Connect your wallet
            </p>
            <p className="text-sm max-w-xs" style={{ color: "var(--ray-text-muted)" }}>
              Track your XLM &amp; USDC balances, pool positions, and on-chain activity in one place.
            </p>
            <p className="text-xs mt-4 px-3 py-2 rounded-xl" style={{ background: "var(--ray-tp-07)", color: "var(--ray-text-muted)" }}>
              Use <span style={{ color: "var(--ray-primary)" }}>Connect Wallet</span> in the top-right corner
            </p>
          </motion.div>
        )}

        {/* ══════════════════════════════
            2-col layout
        ══════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Token Holdings */}
            {connected && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
              >
                <div
                  className="px-5 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--ray-tp-12)" }}
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--ray-text-secondary)" }}>
                    Token Holdings
                  </p>
                  <Link
                    href="/swap"
                    className="text-xs px-2.5 py-1 rounded-lg transition hover:opacity-80"
                    style={{
                      background: "var(--ray-tp-07)",
                      color: "var(--ray-primary)",
                      border: "1px solid var(--ray-tp-12)",
                    }}
                  >
                    Swap →
                  </Link>
                </div>

                {/* Column headers */}
                <div
                  className="grid px-5 py-2"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr",
                    borderBottom: "1px solid var(--ray-tp-07)",
                  }}
                >
                  {["Token", "Balance", "Value"].map((h, i) => (
                    <span
                      key={h}
                      className={`text-[10px] font-semibold uppercase tracking-widest ${i > 0 ? "text-right" : ""}`}
                      style={{ color: "var(--ray-text-muted)" }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* XLM row */}
                {[
                  { symbol: "XLM" as const, amount: xlmAmt, priceLabel: price > 0 ? `$${price.toFixed(4)}` : "—", usdValue: xlmUsd },
                  { symbol: "USDC" as const, amount: usdcAmt, priceLabel: "$1.00", usdValue: usdcAmt },
                ].map(({ symbol, amount, priceLabel, usdValue }) => (
                  <div
                    key={symbol}
                    className="grid items-center px-5 py-4 hover:bg-white/[0.015] transition"
                    style={{
                      gridTemplateColumns: "1fr 1fr 1fr",
                      borderBottom: "1px solid var(--ray-tp-07)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={symbol} size={36} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--ray-text-primary)" }}>{symbol}</p>
                        <p className="text-[11px]" style={{ color: "var(--ray-text-muted)" }}>{priceLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-right" style={{ color: "var(--ray-text-primary)" }}>
                      {reservesLoading ? "—" : num(amount, 2)}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-right" style={{ color: "var(--ray-text-primary)" }}>
                      {reservesLoading ? "—" : usd(usdValue)}
                    </p>
                  </div>
                ))}

                {/* Total row */}
                <div
                  className="grid px-5 py-3"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                >
                  <span className="text-xs font-semibold" style={{ color: "var(--ray-text-muted)" }}>Total</span>
                  <span />
                  <span
                    className="text-sm font-bold tabular-nums text-right"
                    style={{ color: "var(--ray-text-primary)" }}
                  >
                    {reservesLoading ? "—" : usd(walletUsd)}
                  </span>
                </div>
              </motion.div>
            )}

            {/* LP Position */}
            {connected && hasPosition && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
              >
                <div
                  className="px-5 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--ray-tp-12)" }}
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--ray-text-secondary)" }}>
                    Pool Position
                  </p>
                  <Link
                    href="/liquidity"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition hover:opacity-80"
                    style={{
                      background: "var(--ray-tp-07)",
                      color: "var(--ray-primary)",
                      border: "1px solid var(--ray-tp-12)",
                    }}
                  >
                    Manage <ExternalLink size={10} />
                  </Link>
                </div>

                <div className="p-5 space-y-5">
                  {/* Pool pair header */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <TokenIcon symbol="XLM" size={32} />
                      <div style={{ marginLeft: -10, zIndex: 1, position: "relative" }}>
                        <TokenIcon symbol="USDC" size={32} />
                      </div>
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: "var(--ray-text-primary)" }}>
                        XLM / USDC
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--ray-text-muted)" }}>0.3% fee · Soroban AMM</p>
                    </div>
                    <div
                      className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-semibold"
                      style={{
                        background: "rgba(76,220,193,0.1)",
                        color: "var(--ray-positive)",
                        border: "1px solid rgba(76,220,193,0.2)",
                      }}
                    >
                      Active
                    </div>
                  </div>

                  {/* Token breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { symbol: "XLM" as const, amount: posXlm, usdVal: posXlm * price },
                      { symbol: "USDC" as const, amount: posUsdc, usdVal: posUsdc },
                    ]).map(({ symbol, amount, usdVal }) => (
                      <div
                        key={symbol}
                        className="rounded-xl p-3.5"
                        style={{ background: "var(--ray-tp-07)", border: "1px solid rgba(171,196,255,0.06)" }}
                      >
                        <div className="flex items-center gap-2 mb-2.5">
                          <TokenIcon symbol={symbol} size={20} />
                          <span className="text-xs font-semibold" style={{ color: "var(--ray-text-muted)" }}>
                            {symbol}
                          </span>
                        </div>
                        <p className="text-base font-bold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                          {num(amount, 2)}
                        </p>
                        <p className="text-[11px] tabular-nums mt-0.5" style={{ color: "var(--ray-text-muted)" }}>
                          {usd(usdVal)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Share + value */}
                  <div
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: "1px solid var(--ray-tp-12)" }}
                  >
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                        style={{ color: "var(--ray-text-muted)" }}
                      >
                        Pool Share
                      </p>
                      <p className="text-xl font-bold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                        {sharePct < 0.01 ? "<0.01%" : `${sharePct.toFixed(2)}%`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                        style={{ color: "var(--ray-text-muted)" }}
                      >
                        Position Value
                      </p>
                      <p className="text-xl font-bold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                        {usd(posUsd)}
                      </p>
                    </div>
                  </div>

                  {/* LP token detail */}
                  <div
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs"
                    style={{ background: "var(--ray-tp-07)", border: "1px solid rgba(171,196,255,0.06)" }}
                  >
                    <span style={{ color: "var(--ray-text-muted)" }}>LP Tokens (SDLP)</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                      {num(lpAmt, 4)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* No position CTA */}
            {connected && !hasPosition && !reservesLoading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl p-5 flex items-center justify-between gap-4"
                style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--ray-tp-07)", border: "1px solid var(--ray-tp-12)" }}
                  >
                    <Layers size={17} style={{ color: "var(--ray-primary)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--ray-text-primary)" }}>
                      No active pool position
                    </p>
                    <p className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
                      Provide liquidity to earn 0.3% on every swap
                    </p>
                  </div>
                </div>
                <Link
                  href="/liquidity"
                  className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition hover:opacity-80"
                  style={{ background: "var(--ray-btn-gradient)", color: "var(--ray-btn-text)" }}
                >
                  Add Liquidity
                </Link>
              </motion.div>
            )}

            {/* Pool Overview */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: connected ? 0.15 : 0.05 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
            >
              <div
                className="px-5 py-3.5"
                style={{ borderBottom: "1px solid var(--ray-tp-12)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--ray-text-secondary)" }}>
                  Pool Overview · XLM / USDC
                </p>
              </div>
              <div
                className="grid grid-cols-2 sm:grid-cols-4"
                style={{ gap: 1, background: "var(--ray-tp-07)" }}
              >
                {[
                  { icon: <TrendingUp size={13} />,   label: "TVL",          value: tvl > 0 ? usd(tvl) : "—" },
                  { icon: <Droplets size={13} />,     label: "XLM Price",    value: price > 0 ? `$${price.toFixed(4)}` : "—" },
                  { icon: <Droplets size={13} />,     label: "XLM Reserve",  value: resXlmAmt > 0 ? `${num(resXlmAmt, 0)} XLM` : "—" },
                  { icon: <ArrowLeftRight size={13} />,label: "USDC Reserve", value: resUsdcAmt > 0 ? `${num(resUsdcAmt, 0)} USDC` : "—" },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="p-4" style={{ background: "var(--ray-bg-light)" }}>
                    <div
                      className="flex items-center gap-1.5 mb-2"
                      style={{ color: "var(--ray-text-muted)" }}
                    >
                      {icon}
                      <span className="text-[10px] uppercase tracking-widest font-semibold">{label}</span>
                    </div>
                    <p
                      className={`text-sm font-bold tabular-nums ${reservesLoading ? "opacity-30" : ""}`}
                      style={{ color: "var(--ray-text-primary)" }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Right column: Activity feed ── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden sticky top-20"
            style={{ background: "var(--ray-bg-light)", border: "1px solid var(--ray-tp-12)" }}
          >
            <div
              className="px-5 py-3.5 flex items-center gap-2"
              style={{ borderBottom: "1px solid var(--ray-tp-12)" }}
            >
              <Activity size={14} style={{ color: "var(--ray-text-secondary)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--ray-text-secondary)" }}>
                Pool Activity
              </p>
              {evLoading && (
                <RefreshCw
                  size={11}
                  className="animate-spin ml-auto"
                  style={{ color: "var(--ray-text-muted)" }}
                />
              )}
            </div>

            {events.length === 0 && !evLoading ? (
              <div className="px-5 py-12 flex flex-col items-center text-center">
                <Activity
                  size={28}
                  className="mb-3"
                  style={{ color: "var(--ray-text-muted)", opacity: 0.25 }}
                />
                <p className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
                  No transactions yet
                </p>
              </div>
            ) : (
              <div>
                {events.map((ev) => (
                  <a
                    key={ev.id}
                    href={`https://stellar.expert/explorer/testnet/tx/${ev.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.025] transition group"
                    style={{ borderBottom: "1px solid var(--ray-tp-07)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: EV_BG[ev.type], color: EV_COLOR[ev.type] }}
                      >
                        {EV_SYMBOL[ev.type]}
                      </div>
                      <div>
                        <p
                          className="text-xs font-semibold"
                          style={{ color: EV_COLOR[ev.type] }}
                        >
                          {ev.type}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--ray-text-muted)" }}>
                          Ledger #{ev.ledger.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <ExternalLink
                      size={11}
                      className="opacity-0 group-hover:opacity-50 transition"
                      style={{ color: "var(--ray-text-muted)" }}
                    />
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
