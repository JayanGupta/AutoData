/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        night: {
          950: "#04050d",
          900: "#080a17",
          850: "#0b0e21",
          800: "#10132b",
          700: "#181c3a",
          600: "#232850",
          500: "#313763",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-sora)", "Sora", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "glow-violet": "0 0 60px -12px rgba(139, 92, 246, 0.55)",
        "glow-cyan": "0 0 60px -12px rgba(34, 211, 238, 0.45)",
        "glow-pink": "0 0 60px -12px rgba(236, 72, 153, 0.45)",
        "glow-emerald": "0 0 60px -12px rgba(16, 185, 129, 0.45)",
        "glow-white": "0 0 40px -8px rgba(255, 255, 255, 0.35)",
        "inner-light": "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "card-3d": "0 24px 70px -20px rgba(2, 4, 16, 0.7)",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-24px) translateX(10px)" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(60px, -50px) scale(1.15)" },
          "66%": { transform: "translate(-40px, 40px) scale(0.9)" },
        },
        "blob-alt": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "40%": { transform: "translate(-70px, 40px) scale(1.2)" },
          "70%": { transform: "translate(50px, -30px) scale(0.85)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        aurora: {
          "0%, 100%": { transform: "translateX(-8%) rotate(-6deg)" },
          "50%": { transform: "translateX(8%) rotate(6deg)" },
        },
        "border-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "bar-rise": {
          from: { transform: "scaleY(0)" },
          to: { transform: "scaleY(1)" },
        },
      },
      animation: {
        marquee: "marquee 45s linear infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        blob: "blob 16s ease-in-out infinite",
        "blob-alt": "blob-alt 19s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        shimmer: "shimmer 3s linear infinite",
        "pulse-glow": "pulse-glow 3.5s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        "ping-soft": "ping-soft 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
        aurora: "aurora 14s ease-in-out infinite",
        "border-spin": "border-spin 6s linear infinite",
      },
    },
  },
  plugins: [],
};
