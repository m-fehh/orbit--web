'use client';

import { useBrandingStore } from '@/features/tenant/branding-store';
import { cn } from '@/shared/lib/utils';

/** Marca Orbit (default) — anel orbital com núcleo, em SVG, herdando a cor primária. */
function OrbitMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden role="img">
      <defs>
        <radialGradient id="orbit-core" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="var(--orbit-color-primary-soft-solid, #c4b5fd)" />
          <stop offset="100%" stopColor="var(--orbit-color-primary)" />
        </radialGradient>
      </defs>
      <ellipse
        cx="16" cy="16" rx="14" ry="6.2"
        stroke="var(--orbit-color-primary)" strokeOpacity="0.55" strokeWidth="1.5"
        transform="rotate(-28 16 16)"
      />
      <ellipse
        cx="16" cy="16" rx="14" ry="6.2"
        stroke="var(--orbit-color-primary)" strokeOpacity="0.25" strokeWidth="1.5"
        transform="rotate(32 16 16)"
      />
      <circle cx="16" cy="16" r="5" fill="url(#orbit-core)" />
      <circle cx="27" cy="11" r="1.7" fill="var(--orbit-color-primary)" />
    </svg>
  );
}

/**
 * Logo da aplicação:
 *  - tenant whitelabel com logoUrl → exibe o logo do cliente;
 *  - caso contrário → marca Orbit.
 */
export function Logo({
  className,
  showWordmark = true,
  size = 26,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  const branding = useBrandingStore((s) => s.branding);
  const whitelabel = !!branding?.hasWhitelabel && !!branding.logoUrl;

  if (whitelabel) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding!.logoUrl!}
        alt={branding!.name}
        style={{ height: size + 2 }}
        className={cn('w-auto object-contain', className)}
      />
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <span className="drop-shadow-[0_0_10px_var(--orbit-color-primary-soft)]">
        <OrbitMark size={size} />
      </span>
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight">
          Orbit
        </span>
      )}
    </span>
  );
}
