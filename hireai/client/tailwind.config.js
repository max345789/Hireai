/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'rgb(var(--bg-rgb) / <alpha-value>)',
        card:     'rgb(var(--card-rgb) / <alpha-value>)',
        surface:  'rgb(var(--surface-rgb) / <alpha-value>)',
        textSoft: 'rgb(var(--textSoft-rgb) / <alpha-value>)',
        accent:   'rgb(var(--accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        card:  '0 2px 16px rgba(0,0,0,0.07)',
        card2: '0 4px 24px rgba(0,0,0,0.10)',
        glow:  '0 2px 16px rgba(232,96,76,0.18)',
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        float:     'float 5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
