"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import SwapCard from "@/components/SwapCard";
import { useDexStore } from "@/lib/store";
import Link from "next/link";
import { Info } from "lucide-react";

/* ── Page ── */
export default function SwapPage() {
  const { reserveXlm, reserveUsdc, reservesLoading, refreshReserves } = useDexStore();
  const poolEmpty = !reservesLoading && reserveXlm === 0n && reserveUsdc === 0n;

  useEffect(() => {
    refreshReserves();
    const id = setInterval(refreshReserves, 10_000);
    return () => clearInterval(id);
  }, []);

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

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-8">
        {/* Empty-pool banner */}
        {poolEmpty && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl px-5 py-3 flex items-center justify-between gap-4"
            style={{
              background: "rgba(254,211,58,0.07)",
              border: "1px solid rgba(254,211,58,0.22)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <Info size={15} style={{ color: "var(--ray-warning)", flexShrink: 0 }} />
              <p className="text-sm font-medium" style={{ color: "var(--ray-warning)" }}>
                Pool has no liquidity — add XLM &amp; USDC before swapping
              </p>
            </div>
            <Link
              href="/liquidity"
              className="shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80"
              style={{
                background: "rgba(254,211,58,0.15)",
                border: "1px solid rgba(254,211,58,0.3)",
                color: "var(--ray-warning)",
              }}
            >
              Add Liquidity →
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <SwapCard />
        </motion.div>
      </div>
    </div>
  );
}
