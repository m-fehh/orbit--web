import type { Locale } from '@/shared/i18n/config';
import { cn } from '@/shared/lib/utils';

/** Código ISO do país por cultura (para a imagem da bandeira). */
const CODE: Record<Locale, string> = {
  'pt-BR': 'br',
  'en-US': 'us',
  'es-ES': 'es',
};

/**
 * Bandeira como imagem real (flagcdn) — visual profissional e nítido, sem o
 * problema do emoji de bandeira que não renderiza no Windows.
 */
export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  const code = CODE[locale];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={locale}
      width={22}
      height={16}
      loading="lazy"
      className={cn('inline-block h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-border/60', className)}
    />
  );
}
