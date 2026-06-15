import type { Config } from 'tailwindcss';

/**
 * Tailwind mapeado 100% em variáveis CSS (ver src/theme/tokens.css).
 * Nenhuma cor/fonte/espaçamento/borda é hard-coded aqui — tudo aponta para
 * `var(--orbit-*)`, de modo que o tema pode ser sobrescrito por tenant em runtime
 * (ver src/theme/apply-tenant-theme.ts) e por modo claro/escuro.
 */
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
      // Cor padrão de `border`/`ring`/`divide` SEM cor explícita → token do tema.
      // (Sem isto o Tailwind cai no gray-200, que parece branco no tema escuro.)
      borderColor: {
        DEFAULT: 'var(--orbit-color-border)',
      },
      ringColor: {
        DEFAULT: 'var(--orbit-color-primary)',
      },
      divideColor: {
        DEFAULT: 'var(--orbit-color-border)',
      },
    },
  },
  plugins: [],
};

export default config;
