"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useDexStore } from "@/lib/store";
import { fromStroops, XLM_DECIMALS, USDC_DECIMALS, LP_DECIMALS } from "@/lib/stellar";
import { spotPrice } from "@/lib/math";
import { Plus, ArrowRight } from "lucide-react";

export default function PoolSection() {
  const { reserveXlm, reserveUsdc, lpTotalSupply, refreshReserves, reservesLoading } = useDexStore();

  useEffect(() => {
    refreshReserves();
  }, []);

  const price = spotPrice(reserveXlm, reserveUsdc);
  const xlmAmt = fromStroops(reserveXlm, XLM_DECIMALS);
  const usdcAmt = fromStroops(reserveUsdc, USDC_DECIMALS);
  const tvl = xlmAmt * price + usdcAmt;

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      {/* Top divider */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="space-y-6"
          >
            <p className="text-sm font-medium text-cyan-400 tracking-widest uppercase">
              Liquidity Pools
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Earn fees by{" "}
              <span className="gradient-text">providing liquidity</span>
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Deposit XLM &amp; USDC into the pool to receive LP tokens and earn
              0.3% of every swap proportional to your share.
            </p>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[
                { label: "Swap Fee", value: "0.3%" },
                { label: "Pool Pair", value: "XLM/USDC" },
                { label: "Protocol", value: "AMM v1" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                  <p className="text-white font-semibold">{value}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <Link
              href="/liquidity"
              className="btn-glow inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white"
            >
              <Plus size={17} />
              Add Liquidity
              <ArrowRight size={15} />
            </Link>
          </motion.div>

          {/* Right — pool card */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.1 }}
          >
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-6 shadow-card overflow-hidden">
              {/* Decorative gradient */}
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)" }}
              />

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {/* Token pair icons */}
                  <div className="flex -space-x-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 border-2 border-[#080d1f] flex items-center justify-center text-xs font-bold text-white z-10">
                      ✦
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-[#080d1f] flex items-center justify-center text-xs font-bold text-white">
                      $
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-semibold">XLM / USDC</p>
                    <p className="text-gray-500 text-xs">0.3% fee tier</p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Active
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                {[
                  {
                    label: "Total Value Locked",
                    value: tvl > 0
                      ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : "—",
                  },
                  {
                    label: "XLM Reserve",
                    value: xlmAmt > 0
                      ? `${xlmAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
                      : "—",
                  },
                  {
                    label: "USDC Reserve",
                    value: usdcAmt > 0
                      ? `${usdcAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                      : "—",
                  },
                  {
                    label: "LP Token Supply",
                    value: lpTotalSupply > 0n
                      ? `${fromStroops(lpTotalSupply, LP_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 })} SDLP`
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                    <span className="text-gray-500 text-sm">{label}</span>
                    <span className={`text-white font-medium text-sm tabular-nums ${reservesLoading ? "opacity-40" : ""}`}>
                      {reservesLoading ? "…" : value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
