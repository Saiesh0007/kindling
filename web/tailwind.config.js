/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
        readable: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
      },
      colors: {
        night: { 950: '#07061a', 900: '#0d0b2b', 800: '#17134a' },
        ember: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
      },
      keyframes: {
        shimmer: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: { shimmer: 'shimmer 6s ease-in-out infinite', floaty: 'floaty 5s ease-in-out infinite' },
    },
  },
  plugins: [],
}
