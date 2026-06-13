import type { TenantBranding } from '@/shared/api/types';

/**
 * Aplica o branding do tenant sobrescrevendo as variáveis CSS na raiz do
 * documento. Como o tema é 100% variável (ver tokens.css), basta setar as
 * propriedades — nenhum componente precisa conhecer o tenant.
 *
 * Só aplica cor quando o tenant é whitelabel; caso contrário mantém o tema
 * padrão Orbit (e o logo Orbit é exibido pelo componente <Logo/>).
 */
export function applyTenantBranding(branding: TenantBranding | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (branding?.hasWhitelabel && branding.primaryColor) {
    setPrimary(root, branding.primaryColor);
  } else {
    // Garante o reset para o tema Orbit caso um branding anterior tenha sido aplicado.
    root.style.removeProperty('--orbit-color-primary');
    root.style.removeProperty('--orbit-color-primary-soft');
    root.style.removeProperty('--orbit-color-primary-strong');
  }
}

function setPrimary(root: HTMLElement, hex: string) {
  root.style.setProperty('--orbit-color-primary', hex);
  root.style.setProperty('--orbit-color-primary-soft', hexToRgba(hex, 0.14));
  root.style.setProperty('--orbit-color-primary-strong', shade(hex, -0.18));
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Escurece (factor<0) ou clareia (factor>0) uma cor hex. */
function shade(hex: string, factor: number): string {
  const { r, g, b } = parseHex(hex);
  if ([r, g, b].some(Number.isNaN)) return hex;
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (factor < 0 ? c : 255 - c) * factor)));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}
