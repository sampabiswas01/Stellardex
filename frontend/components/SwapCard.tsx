"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signTransaction, getNetworkDetails } from "@stellar/freighter-api";
import { Settings, ArrowDownUp, ChevronDown, ExternalLink, RefreshCw, Info } from "lucide-react";
import { useDexStore } from "@/lib/store";
import { getAmountOut, priceImpact, minAmountOut, spotPrice } from "@/lib/math";
import { buildSwapTx } from "@/lib/contracts";
import {
  toStroops,
  fromStroops,
  XLM_DECIMALS,
  USDC_DECIMALS,
  NETWORK_PASSPHRASE,
  ensureFunded,
  submitTx,
} from "@/lib/stellar";
import Link from "next/link";

type Direction = "xlm_to_usdc" | "usdc_to_xlm";
const SLIPPAGE_OPTIONS = [10, 50, 100]; // bps

/* ── Token selector pill ── */
function TokenPill({ symbol }: { symbol: string }) {
  const isXLM = symbol === "XLM";
  return (
    <div className="ray-token-pill flex items-center gap-2 px-3 py-2 cursor-default select-none shrink-0">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
          isXLM
            ? "bg-gradient-to-br from-blue-400 to-indigo-600"
            : "bg-gradient-to-br from-blue-500 to-blue-700"
        }`}
      >
        {isXLM ? "✦" : "$"}
      </div>
      <span className="font-semibold text-sm" style={{ color: "var(--ray-text-primary)" }}>
        {symbol}
      </span>
      <ChevronDown size={13} style={{ color: "var(--ray-primary)" }} />
    </div>
  );
}

/* ── Price impact badge ── */
function ImpactBadge({ impact }: { impact: number }) {
  const color =
    impact < 1 ? "var(--ray-positive)" : impact < 5 ? "var(--ray-warning)" : "var(--ray-negative)";
  return (
    <span style={{ color }} className="text-xs font-semibold tabular-nums">
      {impact < 0.01 ? "<0.01" : impact.toFixed(2)}%
    </span>
  );
}

/* ── Main component ── */
export default function SwapCard() {
  const {
    walletAddress,
    reserveXlm,
    reserveUsdc,
    xlmBalance,
    usdcBalance,
    txStatus,
    txHash,
    txError,
    setTxStatus,
    refreshReserves,
    addTx,
  } = useDexStore();

  const [direction, setDirection] = useState<Direction>("xlm_to_usdc");
  const [inputAmt, setInputAmt] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const inDecimals = direction === "xlm_to_usdc" ? XLM_DECIMALS : USDC_DECIMALS;
  const outDecimals = direction === "xlm_to_usdc" ? USDC_DECIMALS : XLM_DECIMALS;
  const inLabel = direction === "xlm_to_usdc" ? "XLM" : "USDC";
  const outLabel = direction === "xlm_to_usdc" ? "USDC" : "XLM";
  const inBalance = direction === "xlm_to_usdc" ? xlmBalance : usdcBalance;
  const outBalance = direction === "xlm_to_usdc" ? usdcBalance : xlmBalance;

  const parsedInput = parseFloat(inputAmt) || 0;
  const amountInRaw = toStroops(parsedInput, inDecimals);
  const [reserveIn, reserveOut] =
    direction === "xlm_to_usdc" ? [reserveXlm, reserveUsdc] : [reserveUsdc, reserveXlm];

  const amountOutRaw =
    reserveIn > 0n && reserveOut > 0n ? getAmountOut(amountInRaw, reserveIn, reserveOut) : 0n;
  const impact = parsedInput > 0 ? priceImpact(amountInRaw, reserveIn, reserveOut) : 0;
  const amountOutDisplay = fromStroops(amountOutRaw, outDecimals);
  const effectiveSlippage = customSlippage ? Math.round(parseFloat(customSlippage) * 100) : slippageBps;
  const minOut = minAmountOut(amountOutRaw, effectiveSlippage);

  const price = spotPrice(reserveIn, reserveOut);
  const priceLabel =
    price > 0 ? `1 ${inLabel} ≈ ${price.toFixed(4)} ${outLabel}` : "—";

  useEffect(() => {
    if (txStatus === "success") {
      const t = setTimeout(() => setTxStatus("idle"), 3500);
      return () => clearTimeout(t);
    }
  }, [txStatus]);

  const poolEmpty = reserveXlm === 0n || reserveUsdc === 0n;
  const canSwap =
    walletAddress &&
    parsedInput > 0 &&
    amountOutRaw > 0n &&
    !poolEmpty &&
    impact < 15 &&
    (txStatus === "idle" || txStatus === "error");
  const swapInProgress =
    txStatus === "funding" ||
    txStatus === "building" ||
    txStatus === "signing" ||
    txStatus === "submitting";

  function handleFlip() {
    setFlipped((f) => !f);
    setDirection((d) => (d === "xlm_to_usdc" ? "usdc_to_xlm" : "xlm_to_usdc"));
    setInputAmt("");
  }

  function setMax() {
    const bal = fromStroops(inBalance, inDecimals);
    if (bal > 0) setInputAmt(bal.toFixed(inDecimals === XLM_DECIMALS ? 4 : 6));
  }

  async function handleSwap() {
    if (!walletAddress || !canSwap || swapInProgress) return;
    setTxStatus("building");
    try {
      const net = await getNetworkDetails();
      if (net.networkPassphrase !== NETWORK_PASSPHRASE)
        throw new Error(`Freighter is on "${net.network}" — switch to Testnet.`);
      const wasFunded = await ensureFunded(walletAddress);
      if (wasFunded) setTxStatus("funding");
      const tokenIn = direction === "xlm_to_usdc" ? "xlm" : "usdc";
      setTxStatus("building");
      const txXdr = await buildSwapTx(walletAddress, tokenIn, amountInRaw, minOut);
      setTxStatus("signing");
      const signedXdr = await signTransaction(txXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        accountToSign: walletAddress,
      });
      setTxStatus("submitting");
      const result = await submitTx(signedXdr);
      if (result.status === "SUCCESS") {
        setTxStatus("success", result.hash);
        addTx({
          hash: result.hash,
          type: "swap",
          timestamp: Date.now(),
          amountIn: `${parsedInput} ${inLabel}`,
          amountOut: `~${amountOutDisplay.toFixed(4)} ${outLabel}`,
        });
        setInputAmt("");
        await refreshReserves();
      } else {
        setTxStatus("error", undefined, result.error ?? "Transaction failed on-chain");
      }
    } catch (err: any) {
      setTxStatus("error", undefined, err?.message ?? "Unknown error");
    }
  }

  const swapLabel = !walletAddress
    ? "Connect Wallet"
    : poolEmpty
    ? "Insufficient Liquidity"
    : txStatus === "funding" ? "Funding wallet…"
    : txStatus === "building" ? "Building transaction…"
    : txStatus === "signing" ? "Awaiting signature…"
    : txStatus === "submitting" ? "Submitting…"
    : txStatus === "success" ? "Swap Successful ✓"
    : txStatus === "error" ? "Try Again"
    : "Swap";

  const hasOutput = amountOutRaw > 0n;

  return (
    <div
      className="ray-card w-full p-5 space-y-3"
      style={{ fontFamily: "var(--font-space), var(--font-inter), system-ui, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-1">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--ray-text-primary)" }}
        >
          Swap
        </h2>
        <div className="flex items-center gap-2">
          {/* Current slippage badge */}
          <span
            className="text-xs px-2 py-1 rounded-lg"
            style={{
              background: "var(--ray-tp-12)",
              color: "var(--ray-text-secondary)",
            }}
          >
            {(effectiveSlippage / 100).toFixed(1)}% slippage
          </span>
          {/* Settings gear */}
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: showSettings ? "rgba(34,209,248,0.15)" : "var(--ray-tp-12)",
              color: showSettings ? "var(--ray-secondary)" : "var(--ray-primary)",
              border: `1px solid ${showSettings ? "rgba(34,209,248,0.3)" : "transparent"}`,
            }}
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
          {/* Refresh */}
          <button
            onClick={() => refreshReserves()}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: "var(--ray-tp-12)",
              color: "var(--ray-primary)",
            }}
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Slippage panel ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "var(--ray-tp-07)", border: "1px solid var(--ray-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--ray-text-secondary)" }}>
                  Slippage Tolerance
                </span>
              </div>
              <div className="flex items-center gap-2">
                {SLIPPAGE_OPTIONS.map((bps) => (
                  <button
                    key={bps}
                    onClick={() => { setSlippageBps(bps); setCustomSlippage(""); }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      slippageBps === bps && !customSlippage ? "ray-slip-opt-active" : "ray-slip-opt"
                    }`}
                  >
                    {bps / 100}%
                  </button>
                ))}
                <input
                  className="flex-1 px-2 py-2 text-xs rounded-lg focus:outline-none tabular-nums"
                  style={{
                    background: "var(--ray-tp-12)",
                    border: "1px solid var(--ray-border)",
                    color: "var(--ray-text-primary)",
                  }}
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomSlippage(v);
                    setSlippageBps(v ? 0 : 50);
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── From input ── */}
      <div className="ray-input-box p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>From</span>
          {walletAddress && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
                Balance:{" "}
                <span style={{ color: "var(--ray-text-secondary)" }} className="tabular-nums">
                  {fromStroops(inBalance, inDecimals).toFixed(inDecimals === XLM_DECIMALS ? 4 : 4)}
                </span>
              </span>
              <button
                onClick={setMax}
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-md transition"
                style={{
                  color: "var(--ray-secondary)",
                  background: "rgba(34,209,248,0.1)",
                }}
              >
                MAX
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            placeholder="0.0"
            value={inputAmt}
            onChange={(e) => setInputAmt(e.target.value)}
            className="w-0 flex-1 bg-transparent font-semibold focus:outline-none tabular-nums"
            style={{
              color: "var(--ray-text-primary)",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
            }}
          />
          <TokenPill symbol={inLabel} />
        </div>
      </div>

      {/* ── Swap arrow + rate ── */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-px" style={{ background: "var(--ray-tp-12)" }} />
        <motion.button
          onClick={handleFlip}
          animate={{ rotate: flipped ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="ray-arrow-btn w-9 h-9 flex items-center justify-center shrink-0"
          aria-label="Flip tokens"
        >
          <ArrowDownUp size={16} />
        </motion.button>
        <span
          className="text-xs truncate flex-1 text-right"
          style={{ color: "var(--ray-text-muted)" }}
        >
          {price > 0 ? `1 ${inLabel} ≈ ${price.toFixed(4)} ${outLabel}` : ""}
        </span>
      </div>

      {/* ── To input ── */}
      <div className="ray-input-box p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
            To <span style={{ color: "var(--ray-text-muted)" }} className="text-[11px]">(estimated)</span>
          </span>
          {walletAddress && (
            <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
              Balance:{" "}
              <span style={{ color: "var(--ray-text-secondary)" }} className="tabular-nums">
                {fromStroops(outBalance, outDecimals).toFixed(4)}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-0 flex-1 font-semibold tabular-nums"
            style={{
              color: hasOutput ? "var(--ray-text-primary)" : "rgba(171,196,255,0.25)",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
            }}
          >
            {hasOutput ? amountOutDisplay.toFixed(6) : "0.0"}
          </div>
          <TokenPill symbol={outLabel} />
        </div>
      </div>

      {/* ── Trade info ── */}
      <AnimatePresence>
        {hasOutput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Summary row (always shown) */}
            <div
              className="ray-info-row px-4 py-3 space-y-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
                    {priceLabel}
                  </span>
                  <ImpactBadge impact={impact} />
                </div>
                <button
                  onClick={() => setShowDetails((d) => !d)}
                  className="flex items-center gap-1 text-xs transition"
                  style={{ color: "var(--ray-secondary)" }}
                >
                  <span>{showDetails ? "Hide" : "Details"}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="mt-3 pt-3 space-y-2"
                      style={{ borderTop: "1px solid var(--ray-tp-12)" }}
                    >
                      {[
                        {
                          label: "Price Impact",
                          value: <ImpactBadge impact={impact} />,
                        },
                        {
                          label: "Min. Received",
                          value: (
                            <span className="text-xs tabular-nums" style={{ color: "var(--ray-text-primary)" }}>
                              {fromStroops(minOut, outDecimals).toFixed(6)} {outLabel}
                            </span>
                          ),
                        },
                        {
                          label: "Swap Fee",
                          value: (
                            <span className="text-xs" style={{ color: "var(--ray-text-primary)" }}>
                              0.3%
                            </span>
                          ),
                        },
                        {
                          label: "Slippage",
                          value: (
                            <span className="text-xs" style={{ color: "var(--ray-text-primary)" }}>
                              {(effectiveSlippage / 100).toFixed(1)}%
                            </span>
                          ),
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "var(--ray-text-muted)" }}>
                            {label}
                          </span>
                          {value}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── High impact warning ── */}
      {impact >= 15 && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{
            background: "rgba(255,66,114,0.08)",
            border: "1px solid rgba(255,66,114,0.2)",
          }}
        >
          <Info size={13} style={{ color: "var(--ray-negative)" }} className="shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: "var(--ray-negative)" }}>
            Price impact too high (&gt;15%). Reduce the swap amount.
          </p>
        </div>
      )}

      {/* ── Empty pool warning ── */}
      {poolEmpty && walletAddress && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{
            background: "rgba(254,211,58,0.08)",
            border: "1px solid rgba(254,211,58,0.2)",
          }}
        >
          <Info size={13} style={{ color: "var(--ray-warning)" }} className="shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: "var(--ray-warning)" }}>
            Pool has no liquidity.{" "}
            <Link href="/liquidity" className="font-semibold underline hover:opacity-80 transition">
              Add liquidity
            </Link>{" "}
            first.
          </p>
        </div>
      )}

      {/* ── Swap button ── */}
      <button
        onClick={handleSwap}
        disabled={!canSwap || swapInProgress}
        className="ray-btn w-full py-4 text-[15px]"
      >
        {swapLabel}
      </button>

      {/* ── Feedback rows ── */}
      {txStatus === "error" && txError && (
        <p className="text-xs text-center break-words px-2" style={{ color: "var(--ray-negative)" }}>
          {txError}
        </p>
      )}
      {txStatus === "success" && txHash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs transition hover:opacity-80"
          style={{ color: "var(--ray-secondary)" }}
        >
          <ExternalLink size={12} />
          View on Stellar Expert
        </a>
      )}
    </div>
  );
}
