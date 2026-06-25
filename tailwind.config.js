/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 深色背景层级（与官网一致）
        'bg-deep': '#0a0a0f',
        'bg-card': '#12121a',
        'bg-elevated': '#1a1a24',
        'bg-hover': '#22222e',
        // 边框层级
        'border-subtle': '#27272f',
        'border-default': '#3a3a45',
        // MetaGO 品牌强调色（emerald/teal 系）
        'accent-emerald': '#10d985',
        'accent-teal': '#14b8a6',
        'accent-green': '#00ff88',
        'accent-amber': '#f59e0b',
        'accent-rose': '#f43f5e',
        'accent-blue': '#00d4ff',
      },
      fontFamily: {
        'sans': ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(16, 217, 133, 0.25)',
        'glow-hover': '0 0 30px rgba(16, 217, 133, 0.4)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16, 217, 133, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(16, 217, 133, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
