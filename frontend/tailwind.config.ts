import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7c3aed",
          "purple-light": "#a855f7",
          "purple-dark": "#5b21b6",
          cyan: "#06b6d4",
          "cyan-light": "#22d3ee",
          "cyan-dark": "#0891b2",
          navy: "#050816",
          "navy-800": "#080d1f",
          "navy-700": "#0d1428",
          "navy-600": "#111827",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "card-gradient":
          "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.04) 100%)",
        "button-gradient":
          "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite 1.5s",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-18px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400% center" },
          "100%": { backgroundPosition: "400% center" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "glow-purple":
          "0 0 30px rgba(124,58,237,0.45), 0 0 80px rgba(124,58,237,0.15)",
        "glow-cyan":
          "0 0 30px rgba(6,182,212,0.45), 0 0 80px rgba(6,182,212,0.15)",
        "glow-sm": "0 0 16px rgba(124,58,237,0.35)",
        card: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        "card-hover":
          "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
