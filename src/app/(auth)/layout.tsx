import { LanguageSwitcher } from '@/features/shell/language-switcher';
import { ThemeToggle } from '@/features/shell/theme-toggle';

/** Layout de autenticação: cena orbital animada + card de vidro centralizado. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-md"
    >
      {/* Fundo: apenas um glow suave da cor primária (sem anéis). */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
          style={{ background: 'var(--orbit-color-primary-soft)' }}
        />
      </div>

      <div className="absolute right-md top-md flex items-center gap-sm">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[420px] animate-rise">{children}</div>
    </main>
  );
}
