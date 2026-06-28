import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gcal: {
          blue: "#1a73e8",
          "blue-hover": "#1557b0",
          red: "#d93025",
          green: "#0f9d58",
          yellow: "#f4b400",
          "sidebar-bg": "#f6f8fc",
          "border": "#dadce0",
          "text-primary": "#202124",
          "text-secondary": "#70757a",
        },
      },
      fontFamily: {
        sans: [
          "Google Sans",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;