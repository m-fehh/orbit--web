import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--orbit-color-bg)',
        'bg-subtle': 'var(--orbit-color-bg-subtle)',
        panel: 'var(--orbit-color-panel)',
        'panel-2': 'var(--orbit-color-panel-2)',
        border: 'var(--orbit-color-border)',
        'border-strong': 'var(--orbit-color-border-strong)',
        text: 'var(--orbit-color-text)',
        muted: 'var(--orbit-color-muted)',
        dim: 'var(--orbit-color-dim)',
        primary: {
          DEFAULT: 'var(--orbit-color-primary)',
          fg: 'var(--orbit-color-primary-fg)',
          soft: 'var(--orbit-color-primary-soft)',
        },
        success: 'var(--orbit-color-success)',
        warning: 'var(--orbit-color-warning)',
        danger: 'var(--orbit-color-danger)',
        info: 'var(--orbit-color-info)',
      },
      fontFamily: {
        sans: 'var(--orbit-font-sans)',
        mono: 'var(--orbit-font-mono)',
      },
      fontSize: {
        xs: 'var(--orbit-text-xs)',
        sm: 'var(--orbit-text-sm)',
        base: 'var(--orbit-text-base)',
        lg: 'var(--orbit-text-lg)',
        xl: 'var(--orbit-text-xl)',
        '2xl': 'var(--orbit-text-2xl)',
      },
      spacing: {
        xs: 'var(--orbit-space-xs)',
        sm: 'var(--orbit-space-sm)',
        md: 'var(--orbit-space-md)',
        lg: 'var(--orbit-space-lg)',
        xl: 'var(--orbit-space-xl)',
        '2xl': 'var(--orbit-space-2xl)',
      },
      borderRadius: {
        sm: 'var(--orbit-radius-sm)',
        DEFAULT: 'var(--orbit-radius)',
        md: 'var(--orbit-radius-md)',
        lg: 'var(--orbit-radius-lg)',
        full: 'var(--orbit-radius-full)',
      },
      borderWidth: {
        DEFAULT: 'var(--orbit-border-width)',
        thick: 'var(--orbit-border-width-thick)',
      },
      boxShadow: {
        sm: 'var(--orbit-shadow-sm)',
        DEFAULT: 'var(--orbit-shadow)',
        lg: 'var(--orbit-shadow-lg)',
      },
      borderColor: {
        DEFAULT: 'var(--orbit-color-border)',
      },
      ringColor: {
        DEFAULT: 'var(--orbit-color-primary)',
      },
      divideColor: {
        DEFAULT: 'var(--orbit-color-border)',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        blink: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'var(--orbit-color-primary)' },
        },
        scanline: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        particleFloat: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-80px) scale(0)', opacity: '0' },
        },
        neonPulse: {
          '0%, 100%': {
            boxShadow:
              '0 0 15px var(--orbit-color-primary)/0.3, inset 0 0 15px var(--orbit-color-primary)/0.05',
          },
          '50%': {
            boxShadow:
              '0 0 25px var(--orbit-color-primary)/0.5, inset 0 0 25px var(--orbit-color-primary)/0.1',
          },
        },
        iconBounce: {
          '0%': { transform: 'scale(1) rotate(0deg)' },
          '25%': { transform: 'scale(1.3) rotate(-5deg)' },
          '50%': { transform: 'scale(1.1) rotate(5deg)' },
          '75%': { transform: 'scale(1.2) rotate(-3deg)' },
          '100%': { transform: 'scale(1.1) rotate(0deg)' },
        },
        pulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        gradientShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'var(--orbit-color-primary)' },
          '50%': { borderColor: 'var(--orbit-color-primary-soft)' },
        },
        rotateGradient: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-out forwards',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        shimmer: 'shimmer 2s ease-in-out infinite',
        shake: 'shake 0.5s ease-in-out',
        blink: 'blink 1s step-end infinite',
        scanline: 'scanline 3s linear infinite',
        particleFloat: 'particleFloat 2s ease-out forwards',
        neonPulse: 'neonPulse 3s ease-in-out infinite',
        iconBounce: 'iconBounce 0.5s ease-out forwards',
        pulse: 'pulse 1.5s ease-in-out infinite',
        gradientShift: 'gradientShift 3s ease infinite',
        borderGlow: 'borderGlow 2s ease-in-out infinite',
        rotateGradient: 'rotateGradient 8s linear infinite',
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-sm': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce-lg': 'cubic-bezier(0.25, 1.75, 0.75, 1.25)',
      },
    },
  },
  plugins: [],
};

export default config;