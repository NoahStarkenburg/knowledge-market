/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo"', '"Arial Narrow"', "system-ui", "sans-serif"],
        sans:    ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        // "mono" is repurposed as the label face: the same clean grotesk, set in
        // caps with wide tracking. (No monospace — it read as templated.)
        mono:    ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#121212",
          soft:    "#3a3a3a",
          mute:    "#6b6b66",
        },
        paper: {
          DEFAULT: "#f4f3ee",
          dim:     "#e7e5dd",
        },
        chalk:  "#ffffff",
        cobalt: {
          DEFAULT: "#1d24e8",
          deep:    "#141a9e",
        },
        signal: "#ffd60a",
        danger: "#c81e1e",
        // alias for any markup not yet converted
        accent: { DEFAULT: "#1d24e8", hover: "#141a9e" },
      },
      letterSpacing: {
        tightest: "-0.04em",
        eyebrow:  "0.16em",
      },
      borderRadius: {
        DEFAULT: "0px",
      },
      boxShadow: {
        hard:        "5px 5px 0 0 #121212",
        "hard-sm":   "3px 3px 0 0 #121212",
        "hard-cobalt": "6px 6px 0 0 #1d24e8",
        "hard-signal": "5px 5px 0 0 #ffd60a",
      },
      keyframes: {
        rise: {
          "0%":   { transform: "translateY(110%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grid-pan": {
          "0%":   { backgroundPosition: "0px 0px" },
          "100%": { backgroundPosition: "64px 64px" },
        },
        float: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%":     { transform: "translateY(-24px) rotate(6deg)" },
        },
        "float-rev": {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%":     { transform: "translateY(20px) rotate(-8deg)" },
        },
        "spin-slow": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "fade-up 0.5s ease-out both",
        "grid-pan": "grid-pan 6s linear infinite",
        float: "float 9s ease-in-out infinite",
        "float-rev": "float-rev 11s ease-in-out infinite",
        "spin-slow": "spin-slow 48s linear infinite",
      },
    },
  },
  plugins: [],
};
