/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#25D366',
          teal: '#128C7E',
          light: '#DCF8C6',
          dark: '#075E54',
        },
        surface: {
          800: '#27272a',
          850: '#1f1f23',
          900: '#18181b',
          950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-dot': 'pulseDot 2s infinite',
        'scan-line': 'scanLine 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        scanLine: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(400%)' } },
      },
    },
  },
  plugins: [],
};
