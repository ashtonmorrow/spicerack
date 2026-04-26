import type { Config } from "tailwindcss";

// Notion-inspired palette: near-monochrome, with green reserved for the
// Flavor Pear logo. Category tags use Notion's tag color system.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        ink: "#37352F",
        muted: "#787774",
        border: "#E9E9E7",
        hover: "#F7F6F3",
        selected: "#F1F0EE",
        pear: "#1A7F37",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
