"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useDexStore } from "@/lib/store";
import { fromStroops, XLM_DECIMALS, USDC_DECIMALS } from "@/lib/stellar";
import { spotPrice } from "@/lib/math";
import { TrendingUp, Droplets, ArrowLeftRight, DollarSign } from "lucide-react";

export default function StatsSection() {
  const { reserveXlm, reserveUsdc, refreshReserves, reservesLoading } = useDexStore();

  useEffect(() => {
    refreshReserves();
    const id = setInterval(refreshReserves, 12_000);
    return () => clearInterval(id);
  }, []);

  const price = spotPrice(reserveXlm, reserveUsdc);
  const xlmAmt = fromStroops(reserveXlm, XLM_DECIMALS);
  const usdcAmt = fromStroops(reserveUsdc, USDC_DECIMALS);
  const tvl = xlmAmt * price + usdcAmt;

  const stats = [
    {
      icon: DollarSign,
      label: "Total Value Locked",
      value: tvl > 0 ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—",
      color: "from-purple-500/20 to-purple-600/10",
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/20",
    },
    {
      icon: Droplets,
      label: "XLM Reserve",
      value: xlmAmt > 0 ? `${xlmAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM` : "—",
      color: "from-cyan-500/15 to-cyan-600/5",
      iconColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
    },
    {
      icon: TrendingUp,
      label: "USDC Reserve",
      value: usdcAmt > 0 ? `${usdcAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC` : "—",
      color: "from-blue-500/15 to-blue-600/5",
      iconColor: "text-blue-400",
      borderColor: "border-blue-500/20",
    },
    {
      icon: ArrowLeftRight,
      label: "XLM Price",
      value: price > 0 ? `$${price.toFixed(4)}` : "—",
      color: "from-emerald-500/15 to-emerald-600/5",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
    },
  ];

  return (
    <section className="relative py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-gray-500 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
            Live Pool Data
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Pool Statistics
          </h2>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ icon: Icon, label, value, color, iconColor, borderColor }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className={`relative rounded-2xl p-5 border ${borderColor} bg-gradient-to-br ${color} backdrop-blur-sm overflow-hidden group hover:shadow-card-hover transition-all duration-300`}
            >
              {/* Subtle glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03), transparent 70%)" }}
              />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.05] border border-white/[0.08] mb-4 ${iconColor}`}>
                <Icon size={20} />
              </div>
              <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide font-medium">{label}</p>
              <p className={`text-2xl font-bold text-white tabular-nums ${reservesLoading ? "opacity-40" : ""}`}>
                {reservesLoading ? "…" : value}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
