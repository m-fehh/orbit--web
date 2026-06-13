import { create } from 'zustand';
import type { TenantBranding } from '@/shared/api/types';

/**
 * Branding do tenant corrente, carregado da API (GET /branding) com base no
 * subdomínio. Alimenta o tema (cor primária) e o componente de logo (whitelabel
 * → logo do cliente; senão → logo Orbit).
 */
interface BrandingState {
  branding: TenantBranding | null;
  loaded: boolean;
  setBranding: (branding: TenantBranding) => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  setBranding: (branding) => set({ branding, loaded: true }),
}));
