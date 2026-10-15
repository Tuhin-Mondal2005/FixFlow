/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcf9', 100: '#c8f6ee', 200: '#93ebdd', 300: '#55d6c8', 400: '#26bbb0',
          500: '#0f9b94', 600: '#0b7c78', 700: '#0d6260', 800: '#0f4e4d', 900: '#10413f',
        },
        accent: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        ink: { 900: '#0f172a', 700: '#334155', 500: '#64748b' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06)' },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(239,68,68,.5)' }, '100%': { boxShadow: '0 0 0 10px rgba(239,68,68,0)' } },
      },
      animation: { fadeIn: 'fadeIn .35s ease both', pulseRing: 'pulseRing 1.4s infinite' },
    },
  },
  plugins: [],
};
