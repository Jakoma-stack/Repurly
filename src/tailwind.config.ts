import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(220 13% 91%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(220 14% 96%)",
        "muted-foreground": "hsl(220 9% 46%)",
        primary: {
          DEFAULT: "hsl(258 90% 66%)",
          foreground: "white",
        },
        secondary: {
          DEFAULT: "hsl(218 26% 13%)",
          foreground: "white",
        },
        accent: {
          DEFAULT: "hsl(190 95% 40%)",
          foreground: "white",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
