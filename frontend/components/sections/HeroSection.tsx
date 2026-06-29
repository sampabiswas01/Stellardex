"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* ── Background layers ── */}
      <div className="absolute inset-0 line-grid opacity-60" />

      {/* Animated purple orb */}
      <motion.div
        className="absolute left-[10%] top-[20%] w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Animated cyan orb */}
      <motion.div
        className="absolute right-[8%] bottom-[20%] w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Top line accent */}
      <div className="absolute inset-x-0 top-16 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-purple-500/25 bg-purple-500/10 text-sm text-purple-300"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 live-dot" />
          Live on Stellar Testnet
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
          className="text-[clamp(2.6rem,7vw,5rem)] font-bold tracking-tight leading-[1.06] mb-6"
        >
          <span className="text-white">Swap XLM &amp; USDC</span>
          <br />
          <span className="gradient-text">Instantly on Stellar</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.16, ease: "easeOut" }}
          className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          The fastest, cheapest AMM DEX built on Soroban smart contracts.
          Trade with minimal fees and ~5 second finality.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.24, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/swap"
            className="btn-glow flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white text-[15px]"
          >
            Launch App
            <ArrowRight size={17} />
          </Link>
          <Link
            href="/liquidity"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white text-[15px] border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all"
          >
            <Sparkles size={15} className="text-cyan-400" />
            Add Liquidity
          </Link>
        </motion.div>

        {/* Quick info strip */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.36, ease: "easeOut" }}
          className="mt-20 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
        >
          {[
            { label: "Blockchain", value: "Stellar" },
            { label: "Protocol", value: "Soroban AMM" },
            { label: "Swap Fee", value: "0.3%" },
            { label: "Finality", value: "~5 sec" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-white font-semibold text-lg">{value}</div>
              <div className="text-gray-600 text-xs mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#050816] to-transparent pointer-events-none" />
    </section>
  );
}
