/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oat:    '#F7F5F2',
        canvas: '#EFEDE9',
        coral:  '#FF6B35',
        sky:    '#38BDF8',
        mint:   '#34D399',
        violet: '#A78BFA',
        amber:  '#FBBF24',
        rose:   '#FB7185',
        ink:    '#1E1B4B',
        muted:  '#6B7280',
        accent: '#FF6B35',
        bg:     '#F7F5F2',
        card:   '#FFFFFF',
        surface:'#EFEDE9',
        textSoft:'#6B7280',
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
        sora:    ['Sora', 'sans-serif'],
      },
      boxShadow: {
        'xs':   '0 1px 3px rgba(0,0,0,0.06)',
        'card': '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'card2':'0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'glow': '0 0 0 2px rgba(255,107,53,0.2), 0 4px 16px rgba(255,107,53,0.12)',
        'inner':'inset 0 1px 3px rgba(0,0,0,0.06)',
        'none': 'none',
      },
      borderRadius: {
        'lg': '10px', 'xl': '14px', '2xl': '18px', '3xl': '24px', '4xl': '32px',
      },
      fontSize: { '2xs': ['10px', { lineHeight: '14px' }] },
      animation: {
        'fade-in':  'fadeIn 300ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slideUp 380ms cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft':'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity:'0', transform:'translateY(6px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        slideUp:   { '0%': { opacity:'0', transform:'translateY(18px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity:'1' }, '50%': { opacity:'0.4' } },
      },
    },
  },
  plugins: [],
};
