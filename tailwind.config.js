/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false, // disable Tailwind's reset
  },
  darkMode: ["class", '[data-theme="dark"]'], // hooks into docusaurus' dark mode settigns
  theme: {
    fontFamily: {
      display: "Barlow",
    },
    extend: {
      colors: {
        "brand-slate": "var(--color-brand-slate)",
        "brand-slate-light": "var(--color-brand-slate-light)",
        "brand-purple": "var(--color-brand-purple)",
        "brand-purple-light": "var(--color-brand-purple-light)",
        "brand-coral": "var(--color-brand-coral)",
        "brand-coral-light": "var(--color-brand-coral-light)",
        "brand-yellow": "var(--color-brand-yellow)",
        "brand-yellow-light": "var(--color-brand-yellow-light)",
      },
    },
  },
  safelist: [
    "bg-brand-purple-light",
    "bg-brand-coral-light",
    "bg-brand-yellow-light",
  ],
  plugins: [],
};
