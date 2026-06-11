/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // dark mode only — the <html> element is always `.dark`
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.4)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'hint-pulse': {
          '0%, 100%': { opacity: '0.10', transform: 'scale(0.98)' },
          '50%': { opacity: '0.28', transform: 'scale(1.02)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        ripple: 'ripple 0.6s ease-out forwards',
        'hint-pulse': 'hint-pulse 1.6s ease-in-out infinite',
        'fade-in': 'fade-in 0.25s ease-out both',
        'pop-in': 'pop-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
