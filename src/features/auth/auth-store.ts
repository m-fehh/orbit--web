import { create } from 'zustand';
import { tokenStore } from '@/shared/api/token-store';
import type { AuthResponse, UserResponse } from '@/shared/api/types';

/**
 * Estado de autenticação para a UI (React). Os tokens vivem no tokenStore;
 * aqui guardamos o usuário e o estágio da sessão.
 *
 * `mfaPending`: a API valida o código MFA já autenticado (não há "requiresMfa"
 * no login). Então, ao logar, se o usuário tem 2FA ativo, marcamos a sessão como
 * pendente e bloqueamos a área logada até `POST /auth/mfa/validate` .
 */
type Status = 'unknown' | 'unauthenticated' | 'mfa_pending' | 'authenticated';

interface AuthState {
  user: UserResponse | null;
  status: Status;
  setSessionFromLogin: (auth: AuthResponse) => void;
  setUser: (user: UserResponse | null) => void;
  markMfaVerified: () => void;
  setStatus: (status: Status) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',

  setSessionFromLogin: (auth) => {
    tokenStore.setTokens(auth.accessToken, auth.refreshToken);
    set({
      user: auth.user,
      status: auth.user.twoFactorEnabled ? 'mfa_pending' : 'authenticated',
    });
  },

  setUser: (user) => set({ user }),
  markMfaVerified: () => set({ status: 'authenticated' }),
  setStatus: (status) => set({ status }),

  reset: () => {
    tokenStore.clear();
    set({ user: null, status: 'unauthenticated' });
  },
}));
