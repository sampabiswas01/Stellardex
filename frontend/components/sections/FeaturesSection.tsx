"use client";
import { motion } from "framer-motion";
import { Zap, Shield, Coins, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Stellar's 5-second block time means your swaps settle near-instantly. No waiting, no uncertainty.",
    gradient: "from-amber-500/20 to-orange-600/10",
    iconGradient: "from-amber-400 to-orange-500",
    borderColor: "border-amber-500/15",
  },
  {
    icon: Coins,
    title: "Ultra-Low Fees",
    description:
      "0.3% swap fee + fractions of a cent for Stellar network fees. More money in your pocket.",
    gradient: "from-emerald-500/20 to-green-600/10",
    iconGradient: "from-emerald-400 to-green-500",
    borderColor: "border-emerald-500/15",
  },
  {
    icon: Shield,
    title: "Soroban Smart Contracts",
    description:
      "Powered by audited Soroban contracts. Constant-product AMM with trustless execution.",
    gradient: "from-purple-500/20 to-violet-600/10",
    iconGradient: "from-purple-400 to-violet-500",
    borderColor: "border-purple-500/15",
  },
  {
    icon: BarChart3,
    title: "Deep Liquidity",
    description:
      "Earn 0.3% of every swap by providing XLM/USDC liquidity and receiving LP tokens.",
    gradient: "from-cyan-500/20 to-blue-600/10",
    iconGradient: "from-cyan-400 to-blue-500",
    borderColor: "border-cyan-500/15",
  },
];

export default function FeaturesSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-purple-400 tracking-widest uppercase mb-4">
            Why StellarDEX
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Built for Speed &amp;{" "}
            <span className="gradient-text">Efficiency</span>
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            Every design decision optimizes for the best trading experience on Stellar.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map(({ icon: Icon, title, description, gradient, iconGradient, borderColor }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`relative rounded-2xl p-6 border ${borderColor} bg-gradient-to-br ${gradient} backdrop-blur-sm group cursor-default overflow-hidden`}
            >
              {/* Corner glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)` }}
              />

              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconGradient} flex items-center justify-center mb-5 shadow-lg`}>
                <Icon size={22} className="text-white" />
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
