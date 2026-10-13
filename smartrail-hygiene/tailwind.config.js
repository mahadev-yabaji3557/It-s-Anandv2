/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        railway: {
          dark: '#0a192f',
          navy: '#0f2744',
          slate: '#1e3a5f',
          light: '#f1f5f9',
          border: '#e2e8f0',
          accent: '#0284c7',
        }
      }
    },
  },
  plugins: [],
}
