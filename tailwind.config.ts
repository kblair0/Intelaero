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
        },
        '.map-legend': {
          '@apply absolute bottom-4 right-4 mb-2 p-3 rounded-lg shadow-lg w-44 md:w-auto z-10 bg-lightGray/80 border border-gray-300 text-textPrimary text-xs font-medium opacity-90 backdrop-blur-sm': {},
        },
        '.popup-container': {
          '@apply relative rounded-lg w-44 md:w-auto z-10 text-textPrimary text-xs font-medium opacity-90': {}, 
        },
        '.mapboxgl-popup-content': {
          '@apply bg-transparent shadow-none p-0 border-none !important': {}
        },
        '.toggle-switch': {
          '@apply relative inline-block w-8 h-4': {},
        },
        '.toggle-switch input': {
          '@apply opacity-0 w-0 h-0': {},
        },
        '.toggle-slider': {
          '@apply absolute cursor-pointer inset-0 bg-gray-300 transition-all duration-300 rounded-full': {},
        },
        '.toggle-slider:before': {
          '@apply content-[""] absolute h-3 w-3 left-0.5 bottom-0.5 bg-white transition-all duration-300 rounded-full': {},
        },
        '.toggle-switch input:checked + .toggle-slider': {
          '@apply bg-blue-600': {},
        },
        '.toggle-switch input:checked + .toggle-slider:before': {
          '@apply translate-x-4': {},
        },
      })
    }
  ],
}