// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        lightGray: "#ebeff5",
        textPrimary: "#000000",
        accentGold: "#d4af37",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.map-button': { 
          '@apply inline-block text-black text-xs bg-gray-200 border border-gray-300 rounded-md px-3 py-2 select-none hover:bg-gray-300 transition-colors font-medium shadow-sm hover:shadow-md cursor-pointer opacity-80': {},
        }
      })
    }
  ],
}