/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50, #f0fdf4)',
          100: 'var(--brand-100, #dcfce7)',
          200: 'var(--brand-200, #bbf7d0)',
          300: 'var(--brand-300, #86efac)',
          400: 'var(--brand-400, #4ade80)',
          500: 'var(--brand-500, #22c55e)',
          600: 'var(--brand-600, #16a34a)',
          700: 'var(--brand-700, #15803d)',
          800: 'var(--brand-800, #166534)',
          900: 'var(--brand-900, #14532d)',
          primary: 'var(--brand-primary, #126735)',
          accent: 'var(--brand-accent, #eab308)',
          accent2: 'var(--brand-accent2, #06b6d4)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'Space Grotesk', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
