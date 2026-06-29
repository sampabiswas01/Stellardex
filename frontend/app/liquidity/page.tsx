"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import LiquidityCard from "@/components/LiquidityCard";
import TxHistory from "@/components/TxHistory";
import { useDexStore } from "@/lib/store";
import { fromStroops, XLM_DECIMALS, USDC_DECIMALS, LP_DECIMALS } from "@/lib/stellar";

export default function LiquidityPage() {
  const { reserveXlm, reserveUsdc, lpTotalSupply, refreshReserves, reservesLoading } =
    useDexStore();

  useEffect(() => {
    refreshReserves();
    const id = setInterval(refreshReserves, 10_000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    {
      label: "XLM Reserve",
      value: fromStroops(reserveXlm, XLM_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "XLM",
    },
    {
      label: "USDC Reserve",
      value: fromStroops(reserveUsdc, USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "USDC",
    },
    {
      label: "LP Supply",
      value: fromStroops(lpTotalSupply, LP_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "SDLP",
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      {/* Background accent */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(6,182,212,0.07) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-xl mx-auto space-y-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-1">Liquidity Pools</h1>
          <p className="text-gray-500 text-sm">
            Provide XLM &amp; USDC to earn 0.3% of every swap
          </p>
        </motion.div>

        {/* Pool stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="grid grid-cols-3 gap-3"
        >
          {stats.map(({ label, value, unit }) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-center"
            >
              <p className="text-gray-600 text-[11px] uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-white font-semibold text-sm tabular-nums ${reservesLoading ? "opacity-40" : ""}`}>
                {reservesLoading ? "…" : value || "—"}
              </p>
              <p className="text-gray-700 text-[10px] mt-0.5">{unit}</p>
            </div>
          ))}
        </motion.div>

        {/* Liquidity card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <LiquidityCard />
        </motion.div>

        {/* Tx history */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <TxHistory />
        </motion.div>
      </div>
    </div>
  );
}
