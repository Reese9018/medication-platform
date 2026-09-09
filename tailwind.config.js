/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm cream base
        cream: {
          50: '#FBF8F3',
          100: '#F6F1E8',
          200: '#EDE4D3',
        },
        // Primary — soft sage/teal (medical trust)
        sage: {
          50: '#F0F7F4',
          100: '#DCEBE3',
          200: '#B9D6C7',
          300: '#8FBCA4',
          400: '#679E80',
          500: '#4A8265',
          600: '#386A51',
          700: '#2D5542',
          800: '#244336',
          900: '#1C352B',
        },
        // Secondary — soft sky blue
        sky: {
          50: '#EFF7FB',
          100: '#D7EBF4',
          200: '#B0D7E9',
          300: '#82BDD8',
          400: '#569FC0',
          500: '#3A85A8',
          600: '#2D6A89',
          700: '#265570',
          800: '#1F4257',
          900: '#163242',
        },
        // Accent — warm coral for reminders
        coral: {
          50: '#FDF2EF',
          100: '#FAE3DC',
          200: '#F4C7B8',
          300: '#ECA591',
          400: '#E07F66',
          500: '#D2624A',
          600: '#B54E3A',
          700: '#923E30',
          800: '#733227',
          900: '#5A2820',
        },
        // Warm amber for warnings
        amber: {
          50: '#FDF8EC',
          100: '#FAEFC9',
          200: '#F4DE92',
          300: '#EEC95A',
          400: '#E8B234',
          500: '#D49A1E',
          600: '#AE7B17',
          700: '#875F15',
          800: '#6B4A16',
          900: '#553A15',
        },
        // Risk colors
        risk: {
          high: '#D2624A',
          mid: '#D49A1E',
          low: '#4A8265',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif SC"', '"PingFang SC"', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(45, 85, 66, 0.08)',
        card: '0 4px 24px -6px rgba(45, 85, 66, 0.10)',
        pop: '0 8px 32px -8px rgba(45, 85, 66, 0.16)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'spin-slow': 'spin 1.4s linear infinite',
        'progress': 'progress 1.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        progress: {
          '0%': { width: '0%' },
        },
      },
    },
  },
  plugins: [],
};
