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
        heading: ['Sora', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'xs':       '0 1px 2px rgba(0,0,0,0.4)',
        'card':     '0 2px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        'card2':    '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        'card3':    '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
        'glow':     '0 0 0 1px rgba(182,255,46,0.2), 0 4px 24px rgba(182,255,46,0.15)',
        'glow-sm':  '0 0 0 1px rgba(182,255,46,0.15), 0 2px 12px rgba(182,255,46,0.12)',
        'inner':    'inset 0 1px 3px rgba(0,0,0,0.4)',
        'none':     'none',
      },
      borderRadius: {
        'lg':  '10px',
        'xl':  '14px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      animation: {
        'fade-in':    'fadeIn 300ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up':   'slideUp 380ms cubic-bezier(0.16,1,0.3,1)',
        'scale-in':   'scaleIn 220ms cubic-bezier(0.16,1,0.3,1)',
        'float':      'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-7px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
