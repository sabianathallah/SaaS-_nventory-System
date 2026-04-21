/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // ── Preface Red (dari logo) ──────────────────────────
        brand: {
          DEFAULT: '#C8102E',
          light:   '#D93248',
          dark:    '#A00D26',
          50:      '#FFF1F3',
          100:     '#FFD0D6',
        },
        // ── Broken white (pengganti hitam/charcoal) ──────────
        offwhite: {
          DEFAULT: '#F5F3EF',   // broken white utama — sidebar, panel
          dark:    '#EAE7E2',   // border / divider di atas broken white
          deeper:  '#DDD9D3',   // elemen lebih dalam
        },
        // ── Canvas & surface ─────────────────────────────────
        canvas:  '#FAF9F7',     // halaman background (slightly warm)
        surface: '#FFFFFF',     // card, input, modal
        // ── Neutral ──────────────────────────────────────────
        slate: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // ── Status ───────────────────────────────────────────
        success: { DEFAULT: '#16A34A', light: '#DCFCE7', border: '#BBF7D0' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', border: '#FDE68A' },
        danger:  { DEFAULT: '#DC2626', light: '#FEE2E2', border: '#FECACA' },
        info:    { DEFAULT: '#2563EB', light: '#DBEAFE', border: '#BFDBFE' },
      },
      boxShadow: {
        card:      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        modal:     '0 20px 60px rgba(0,0,0,0.12)',
        sidebar:   '2px 0 8px rgba(0,0,0,0.06)',
      },
      animation: {
        'fade-in':  'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'scale-in': 'scaleIn 0.18s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },                              to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.97)' },     to: { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}
