import { LanguageSwitcher } from '@/features/shell/language-switcher';
import { ThemeToggle } from '@/features/shell/theme-toggle';

/** Layout de autenticação: cena tecnológica imersiva + card central. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-md"
    >
      {/* ── Cena de fundo tecnológica ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* Grade em perspectiva */}
        <div
          className="absolute inset-x-0 bottom-0 h-[60vh] opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(var(--orbit-color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--orbit-color-primary) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            transform: 'perspective(520px) rotateX(62deg)',
            transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, black, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to top, black, transparent 80%)',
          }}
        />

        {/* Glows orbitais */}
        <div
          className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] animate-pulse-slow"
          style={{ background: 'var(--orbit-color-primary-soft)' }}
        />
        <div
          className="absolute right-[12%] top-[18%] h-[260px] w-[260px] rounded-full blur-[120px] opacity-60"
          style={{ background: 'var(--orbit-color-primary-soft)' }}
        />

        {/* Anéis orbitais sutis */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {[420, 640, 880].map((size, i) => (
            <div
              key={size}
              className="absolute rounded-full border border-primary/10"
              style={{
                width: size,
                height: size,
                left: -size / 2,
                top: -size / 2,
                animation: `orbit-spin ${36 + i * 14}s linear infinite${i % 2 ? ' reverse' : ''}`,
              }}
            >
              <span
                className="absolute h-1.5 w-1.5 rounded-full bg-primary/60 shadow-[0_0_12px_2px_var(--orbit-color-primary)]"
                style={{ top: -3, left: size / 2 - 3 }}
              />
            </div>
          ))}
        </div>

        {/* Vinheta */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, var(--orbit-color-bg) 100%)' }}
        />
      </div>

      <div className="absolute right-md top-md z-10 flex items-center gap-sm">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[440px] animate-rise">{children}</div>

      <style>{`
        @keyframes orbit-spin { to { transform: rotate(360deg); } }
        @keyframes pulse-slow { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
        .animate-pulse-slow { animation: pulse-slow 7s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
