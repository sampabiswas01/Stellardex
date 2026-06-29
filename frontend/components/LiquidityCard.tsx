"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signTransaction, getNetworkDetails } from "@stellar/freighter-api";
import { useDexStore } from "@/lib/store";
import { calcShares, minAmountOut } from "@/lib/math";
import { buildDepositTx, buildWithdrawTx } from "@/lib/contracts";
import {
  toStroops,
  fromStroops,
  XLM_DECIMALS,
  USDC_DECIMALS,
  LP_DECIMALS,
  NETWORK_PASSPHRASE,
  ensureFunded,
  submitTx,
} from "@/lib/stellar";
import { Info, ExternalLink, ChevronDown } from "lucide-react";

type Tab = "add" | "remove";

function TokenInput({
  label,
  value,
  onChange,
  symbol,
  isFirst,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  isFirst?: boolean;
}) {
  const isXLM = symbol === "XLM";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] hover:border-white/[0.12] transition-colors p-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min="0"
          placeholder="0.0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-0 flex-1 bg-transparent text-[26px] font-semibold text-white placeholder-gray-700 focus:outline-none"
        />
        <div className="flex items-center gap-2 shrink-0 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
              isXLM
                ? "bg-gradient-to-br from-blue-400 to-indigo-600"
                : "bg-gradient-to-br from-blue-500 to-blue-700"
            }`}
          >
            {isXLM ? "✦" : "$"}
          </div>
          <span className="font-semibold text-white text-sm">{symbol}</span>
        </div>
      </div>
    </div>
  );
}

export default function LiquidityCard() {
  const {
    walletAddress,
    reserveXlm,
    reserveUsdc,
    lpBalance,
    lpTotalSupply,
    usdcBalance,
    txStatus,
    txError,
    setTxStatus,
    refreshReserves,
    addTx,
  } = useDexStore();

  const [tab, setTab] = useState<Tab>("add");
  const [xlmAmt, setXlmAmt] = useState("");
  const [usdcAmt, setUsdcAmt] = useState("");
  const [removePercent, setRemovePercent] = useState(50);

  useEffect(() => {
    if (txStatus === "success") {
      const t = setTimeout(() => setTxStatus("idle"), 3500);
      return () => clearTimeout(t);
    }
  }, [txStatus]);

  const poolEmpty = reserveXlm === 0n || reserveUsdc === 0n;
  const xlmIn = toStroops(parseFloat(xlmAmt) || 0, XLM_DECIMALS);
  const usdcIn = toStroops(parseFloat(usdcAmt) || 0, USDC_DECIMALS);
  const lpToMint = calcShares(xlmIn, usdcIn, reserveXlm, reserveUsdc, lpTotalSupply);

  function handleXlmChange(val: string) {
    setXlmAmt(val);
    if (!poolEmpty) {
      const xlmRaw = toStroops(parseFloat(val) || 0, XLM_DECIMALS);
      const usdcRaw = (xlmRaw * reserveUsdc) / reserveXlm;
      setUsdcAmt(fromStroops(usdcRaw, USDC_DECIMALS).toFixed(6));
    }
  }
  function handleUsdcChange(val: string) {
    setUsdcAmt(val);
    if (!poolEmpty) {
      const usdcRaw = toStroops(parseFloat(val) || 0, USDC_DECIMALS);
      const xlmRaw = (usdcRaw * reserveXlm) / reserveUsdc;
      setXlmAmt(fromStroops(xlmRaw, XLM_DECIMALS).toFixed(6));
    }
  }

  const lpSharesToBurn = (lpBalance * BigInt(removePercent)) / 100n;
  const xlmOut = lpTotalSupply > 0n ? (lpSharesToBurn * reserveXlm) / lpTotalSupply : 0n;
  const usdcOut = lpTotalSupply > 0n ? (lpSharesToBurn * reserveUsdc) / lpTotalSupply : 0n;
  const poolSharePct =
    lpTotalSupply > 0n ? (Number(lpBalance) / Number(lpTotalSupply)) * 100 : 0;

  const inProgress =
    txStatus === "funding" ||
    txStatus === "building" ||
    txStatus === "signing" ||
    txStatus === "submitting";

  const canDeposit = !!walletAddress && xlmIn > 0n && usdcIn > 0n && !inProgress;
  const canWithdraw =
    !!walletAddress && lpBalance > 0n && lpSharesToBurn > 0n && !inProgress;

  function buttonLabel(action: "deposit" | "withdraw") {
    if (!walletAddress) return "Connect Wallet";
    if (txStatus === "funding") return "Funding wallet…";
    if (txStatus === "building") return "Building…";
    if (txStatus === "signing") return "Awaiting signature…";
    if (txStatus === "submitting") return "Submitting…";
    if (txStatus === "success")
      return action === "deposit" ? "✓ Deposit Successful" : "✓ Withdrawal Successful";
    if (txStatus === "error") return "Try Again";
    return action === "deposit" ? "Add Liquidity" : "Remove Liquidity";
  }

  async function handleDeposit() {
    if (!walletAddress || !canDeposit) return;
    setTxStatus("building");
    try {
      const net = await getNetworkDetails();
      if (net.networkPassphrase !== NETWORK_PASSPHRASE)
        throw new Error(`Freighter is on "${net.network}" — switch to Testnet.`);
      const wasFunded = await ensureFunded(walletAddress);
      if (wasFunded) setTxStatus("funding");
      setTxStatus("building");
      const txXdr = await buildDepositTx(walletAddress, xlmIn, usdcIn, 0n, 0n);
      setTxStatus("signing");
      const signedXdr = await signTransaction(txXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        accountToSign: walletAddress,
      });
      setTxStatus("submitting");
      const result = await submitTx(signedXdr);
      if (result.status === "SUCCESS") {
        setTxStatus("success", result.hash);
        addTx({ hash: result.hash, type: "deposit", timestamp: Date.now() });
        setXlmAmt(""); setUsdcAmt("");
        await refreshReserves();
      } else {
        setTxStatus("error", undefined, result.error ?? "Deposit failed on-chain");
      }
    } catch (err: any) {
      setTxStatus("error", undefined, err?.message ?? "Unknown error");
    }
  }

  async function handleWithdraw() {
    if (!walletAddress || !canWithdraw) return;
    setTxStatus("building");
    try {
      const net = await getNetworkDetails();
      if (net.networkPassphrase !== NETWORK_PASSPHRASE)
        throw new Error(`Freighter is on "${net.network}" — switch to Testnet.`);
      const wasFunded = await ensureFunded(walletAddress);
      if (wasFunded) setTxStatus("funding");
      setTxStatus("building");
      const minXlm = minAmountOut(xlmOut, 50);
      const minUsdc = minAmountOut(usdcOut, 50);
      const txXdr = await buildWithdrawTx(walletAddress, lpSharesToBurn, minXlm, minUsdc);
      setTxStatus("signing");
      const signedXdr = await signTransaction(txXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        accountToSign: walletAddress,
      });
      setTxStatus("submitting");
      const result = await submitTx(signedXdr);
      if (result.status === "SUCCESS") {
        setTxStatus("success", result.hash);
        addTx({ hash: result.hash, type: "withdraw", timestamp: Date.now() });
        await refreshReserves();
      } else {
        setTxStatus("error", undefined, result.error ?? "Withdraw failed on-chain");
      }
    } catch (err: any) {
      setTxStatus("error", undefined, err?.message ?? "Unknown error");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative glass-md rounded-2xl p-5 shadow-card space-y-4">
        {/* ── Tab switcher ── */}
        <div className="flex bg-white/[0.04] rounded-xl p-1 gap-1">
          {(["add", "remove"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setTxStatus("idle"); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t
                  ? "bg-gradient-to-r from-purple-600/80 to-cyan-600/60 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "add" ? "Add Liquidity" : "Remove Liquidity"}
            </button>
          ))}
        </div>

        {/* ── Your position ── */}
        {walletAddress && lpBalance > 0n && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Position</p>
            {[
              { label: "LP Tokens", value: `${fromStroops(lpBalance, LP_DECIMALS).toFixed(4)} SDLP` },
              { label: "Pool Share", value: `${poolSharePct.toFixed(3)}%` },
              {
                label: "XLM Value",
                value: `${fromStroops((lpBalance * reserveXlm) / (lpTotalSupply || 1n), XLM_DECIMALS).toFixed(4)} XLM`,
              },
              {
                label: "USDC Value",
                value: `${fromStroops((lpBalance * reserveUsdc) / (lpTotalSupply || 1n), USDC_DECIMALS).toFixed(4)} USDC`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-white font-medium tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Add tab ── */}
        {tab === "add" && (
          <>
            {poolEmpty && walletAddress && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-500/[0.08] border border-purple-500/20">
                <Info size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-300 text-xs font-semibold mb-0.5">First deposit — you set the price</p>
                  <p className="text-purple-400/80 text-xs">
                    Enter any XLM + USDC ratio. That ratio becomes the starting price.
                  </p>
                </div>
              </div>
            )}

            {walletAddress && usdcBalance === 0n && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
                <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs">Your wallet has 0 USDC. You need Circle USDC to add liquidity.</p>
              </div>
            )}

            {walletAddress && (
              <p className="text-xs text-gray-600 px-1">
                USDC balance:{" "}
                <span className="text-gray-500 tabular-nums">
                  {fromStroops(usdcBalance, USDC_DECIMALS).toFixed(4)}
                </span>
              </p>
            )}

            <TokenInput label="XLM amount" value={xlmAmt} onChange={handleXlmChange} symbol="XLM" />
            <div className="text-center text-gray-600 text-lg font-light select-none">+</div>
            <TokenInput
              label="USDC amount"
              value={usdcAmt}
              onChange={handleUsdcChange}
              symbol="USDC"
            />

            {lpToMint > 0n && (
              <div className="flex justify-between text-xs px-1">
                <span className="text-gray-500">LP tokens to receive</span>
                <span className="text-white font-medium tabular-nums">
                  {fromStroops(lpToMint, LP_DECIMALS).toFixed(4)} SDLP
                </span>
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={!canDeposit || txStatus === "success"}
              className={`w-full py-4 rounded-xl font-semibold text-[15px] transition-all ${
                canDeposit && txStatus !== "success"
                  ? txStatus === "error"
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "btn-glow text-white"
                  : "bg-white/[0.04] border border-white/[0.06] text-gray-600 cursor-not-allowed"
              }`}
            >
              {buttonLabel("deposit")}
            </button>

            {txStatus === "error" && txError && (
              <p className="text-red-400 text-xs text-center break-words px-2">{txError}</p>
            )}
          </>
        )}

        {/* ── Remove tab ── */}
        {tab === "remove" && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Amount to remove</span>
                <span className="text-white font-bold text-lg tabular-nums">{removePercent}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={removePercent}
                onChange={(e) => setRemovePercent(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => setRemovePercent(p)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                      removePercent === p
                        ? "bg-purple-500/25 text-purple-200 border border-purple-500/30"
                        : "bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:bg-white/[0.08] hover:text-gray-300"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {lpSharesToBurn > 0n && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">You will receive (est.)</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">XLM</span>
                  <span className="text-white font-medium tabular-nums">
                    {fromStroops(xlmOut, XLM_DECIMALS).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">USDC</span>
                  <span className="text-white font-medium tabular-nums">
                    {fromStroops(usdcOut, USDC_DECIMALS).toFixed(4)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={!canWithdraw || txStatus === "success"}
              className={`w-full py-4 rounded-xl font-semibold text-[15px] transition-all ${
                canWithdraw && txStatus !== "success"
                  ? txStatus === "error"
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                  : "bg-white/[0.04] border border-white/[0.06] text-gray-600 cursor-not-allowed"
              }`}
            >
              {!walletAddress
                ? "Connect Wallet"
                : lpBalance <= 0n && txStatus === "idle"
                ? "No liquidity to remove"
                : buttonLabel("withdraw")}
            </button>

            {txStatus === "error" && txError && (
              <p className="text-red-400 text-xs text-center break-words px-2">{txError}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
