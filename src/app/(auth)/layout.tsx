import { LanguageSwitcher } from '@/features/shell/language-switcher';
import { ThemeToggle } from '@/features/shell/theme-toggle';

/**
 * Layout de autenticação: fornece o backdrop e os controles globais.
 * Cada página decide o próprio enquadramento (login usa split-screen full-bleed;
 * demais telas centralizam um card).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="relative min-h-screen w-full overflow-hidden bg-bg">
      {/* Backdrop sutil (fica atrás do lado do formulário) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute -right-32 -top-40 h-[440px] w-[440px] rounded-full blur-[150px] opacity-60"
          style={{ background: 'var(--orbit-color-primary-soft)' }}
        />
        <div
          className="absolute -bottom-48 right-1/4 h-[420px] w-[420px] rounded-full blur-[160px] opacity-40"
          style={{ background: 'var(--orbit-color-primary-soft)' }}
        />
      </div>

      <div className="absolute right-md top-md z-20 flex items-center gap-sm">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {children}
    </main>
  );
}
