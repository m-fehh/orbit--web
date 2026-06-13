/**
 * Armazenamento de tokens — decisão de arquitetura:
 *   - accessToken: em MEMÓRIA (não sobrevive a reload; é recuperado via refresh)
 *   - refreshToken: em localStorage (sobrevive a reload, permite re-hidratar a sessão)
 *
 * Mantido fora do Zustand de propósito: o interceptor (módulo não-React) precisa
 * ler/escrever os tokens sincronamente, sem depender do ciclo de render.
 */
const REFRESH_KEY = 'orbit.refreshToken';

let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token;
  },

  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken: (token: string | null) => {
    if (typeof window === 'undefined') return;
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  },

  /** Define o par de tokens (após login/refresh). */
  setTokens: (access: string, refresh: string) => {
    accessToken = access;
    tokenStore.setRefreshToken(refresh);
  },

  /** Limpa tudo (logout / refresh falho). */
  clear: () => {
    accessToken = null;
    tokenStore.setRefreshToken(null);
  },

  hasSession: () => !!tokenStore.getRefreshToken(),
};
