/** @type {import('tailwindcss').Config} */
module.exports = {
  // Ensure Tailwind scans all your project files for class names
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // Crucial for app directory
    // If you have other specific directories where you use Tailwind classes, add them here.
    // Example: "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Extend Tailwind's default theme here if needed
      // For example, custom colors, fonts, spacing etc.
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Assuming 'Inter' font is desired
      },
      colors: {
        sky: {
          300: '#7dd3fc',
          400: '#38b2ac',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        zinc: {
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        lime: {
          100: '#f7fee7',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
        },
        yellow: {
          500: '#eab308',
        },
        rose: {
          300: '#fda4af',
          500: '#f43f5e',
          600: '#e11d48',
          800: '#9f1239',
        },
        indigo: {
          500: '#6366f1',
        },
        purple: {
          500: '#a855f7',
        },
        // Ensure all custom colors used in the React component are defined here
      }
    },
  },
  plugins: [],
};
