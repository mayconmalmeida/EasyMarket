/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0057D9',
          dark: '#003B8E',
          light: '#EAF3FF',
        },
        text: {
          DEFAULT: '#1F2937',
        },
        status: {
          paid: '#16A34A',
          pending: '#F59E0B',
          low: '#DC2626',
        },
      },
    },
  },
  plugins: [],
}
