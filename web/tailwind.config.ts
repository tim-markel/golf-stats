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
          DEFAULT: "#1f7a3d",
          dark: "#155c2c",
          light: "#e8f5ec",
        },
      },
    },
  },
  plugins: [],
};

export default config;
