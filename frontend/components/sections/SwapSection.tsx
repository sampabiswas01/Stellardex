"use client";
import { motion } from "framer-motion";
import SwapCard from "@/components/SwapCard";

export default function SwapSection() {
  return (
    <section id="swap" className="relative py-24 px-4 sm:px-6 overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.35), rgba(6,182,212,0.25), transparent)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)" }}
        />
      </div>

      <div className="max-w-xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-sm font-medium text-purple-400 tracking-widest uppercase mb-4">
            Instant Swap
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Trade in seconds
          </h2>
        </motion.div>

        {/* Swap card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.1 }}
        >
          <SwapCard />
        </motion.div>
      </div>
    </section>
  );
}
