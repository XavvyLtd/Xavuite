/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        xs: {
          bg:          '#020617',
          surface:     '#0B1120',
          elevated:    '#111827',
          card:        '#0F172A',
          border:      '#1E293B',
          borderBright:'#334155',
          accent:      '#6366F1',
          accentHover: '#818CF8',
          teal:        '#14B8A6',
          green:       '#10B981',
          amber:       '#F59E0B',
          red:         '#EF4444',
          purple:      '#A855F7',
          sky:         '#38BDF8',
          text:        '#F1F5F9',
          muted:       '#94A3B8',
          dim:         '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.4)',
        elevated:'0 8px 30px rgba(0,0,0,0.5)',
      },
      animation: {
        fadeIn:  'fadeIn 0.2s ease-out',
        slideIn: 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
