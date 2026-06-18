import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fairway: {
          DEFAULT: "#15663f",
          dark: "#0b3d2e",
          600: "#1a7a4a",
          light: "#e8f1ea",
        },
        gold: "#c8a64b",
        ink: "#16201b",
        paper: {
          DEFAULT: "#f5eccf",
          line: "#d8c79a",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,32,24,.06), 0 8px 24px rgba(16,32,24,.05)",
      },
      borderRadius: {
        xl: "0.9rem",
      },
    },
  },
  plugins: [],
};

export default config;
