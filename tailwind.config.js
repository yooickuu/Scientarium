/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f7f2fd',
          100: '#eee5fa',
          200: '#dfcef6',
          300: '#c5a9ef',
          400: '#a379e4',
          500: '#834ed4',
          600: '#58149c', // Owl Purple
          700: '#4c1087',
          800: '#3e0e6e',
          900: '#330c5a',
          950: '#1e0537',
        },
        slateBlue: {
          50: '#f1f4fa',
          100: '#e3e8f5',
          200: '#cbd4ed',
          300: '#a6b7de',
          400: '#7a94cb',
          500: '#4860b0', // Owl Wing Blue
          600: '#3a4e96',
          700: '#2f3f7c',
          800: '#283464',
          900: '#232c52',
        },
        darkSurface: {
          base: '#0f111a',    // Background in dark mode
          card: '#171926',    // Cards in dark mode
          cardHover: '#202334',// Hover state in dark mode
          border: '#2a2d42',  // Borders in dark mode
          subtle: '#363a54',
        },
        lightSurface: {
          base: '#f8f9fd',    // Background in light mode
          card: '#ffffff',    // Cards in light mode
          cardHover: '#f4f6fb',
          border: '#e8ebf4',  // Borders in light mode
          subtle: '#d9deec',
        }
      },
    },
  },
  plugins: [],
};
