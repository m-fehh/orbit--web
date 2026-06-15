import { create } from 'zustand';
import { tokenStore } from '@/shared/api/token-store';
import type { AuthResponse, UserResponse } from '@/shared/api/types';
import { permissionsFromToken } from './permissions';

/**
 * Estado de autenticação para a UI (React). Os tokens vivem no tokenStore;
 * aqui guardamos o usuário, as permissões (PBAC) e o estágio da sessão.
 *
 * `mfa_pending`: a API valida o código MFA já autenticado (não há "requiresMfa"
 * no login). Então, ao logar, se o usuário tem 2FA ativo, marcamos a sessão como
 * pendente e bloqueamos a área logada até `POST /auth/mfa/validate`.
 *
 * `permissions`: extraídas das claims `permission` do JWT (Administrator = `*`).
 */
type Status = 'unknown' | 'unauthenticated' | 'mfa_pending' | 'authenticated';

interface AuthState {
  user: UserResponse | null;
  status: Status;
  permissions: string[];
  setSessionFromLogin: (auth: AuthResponse) => void;
  setUser: (user: UserResponse | null) => void;
  syncPermissionsFromToken: () => void;
  markMfaVerified: () => void;
  setStatus: (status: Status) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',
  permissions: [],

  setSessionFromLogin: (auth) => {
    tokenStore.setTokens(auth.accessToken, auth.refreshToken);
    set({
      user: auth.user,
      permissions: permissionsFromToken(auth.accessToken),
      status: auth.user.twoFactorEnabled ? 'mfa_pending' : 'authenticated',
    });
  },

  setUser: (user) => set({ user }),

  // Re-lê as permissões do access token corrente (após refresh/bootstrap).
  syncPermissionsFromToken: () => set({ permissions: permissionsFromToken(tokenStore.getAccessToken()) }),

  markMfaVerified: () => set({ status: 'authenticated' }),
  setStatus: (status) => set({ status }),

  reset: () => {
    tokenStore.clear();
    set({ user: null, permissions: [], status: 'unauthenticated' });
  },
}));
