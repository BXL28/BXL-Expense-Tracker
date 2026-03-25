import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bxl: {
          forest: "#14532d",
          "forest-dark": "#052e16",
          moss: "#166534",
          lime: "#d9f99d",
          accent: "#84cc16",
        },
      },
    },
  },
  plugins: [],
};

export default config;
