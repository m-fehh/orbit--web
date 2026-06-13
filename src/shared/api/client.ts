/**
 * Cliente HTTP / interceptor único para TODOS os endpoints da Orbit.Api.
 *
 * Responsabilidades:
 *   1. Prefixa a base da API e serializa JSON.
 *   2. Anexa em toda requisição: Authorization Bearer, X-Tenant-Id (subdomínio),
 *      Accept-Language (cultura) e X-Timezone.
 *   3. Em 401, tenta UM refresh; usa uma fila para que múltiplas requisições
 *      concorrentes aguardem o mesmo refresh e sejam re-executadas.
 *   4. Se o refresh falhar, limpa a sessão e redireciona para /login.
 *   5. Desempacota o envelope ApiResponse<T> e lança ApiError em falha.
 */
import { tokenStore } from './token-store';
import { requestContext } from './request-context';
import { ApiError, type ApiResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:5001/api/v1';

/** Rotas que NÃO devem disparar refresh nem exigir token. */
const AUTH_FREE = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Corpo que será serializado em JSON (a menos que seja FormData). */
  body?: unknown;
  /** Query string como objeto. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Não tentar refresh automático (uso interno do próprio refresh). */
  skipAuthRefresh?: boolean;
  /** Não anexar Authorization (rotas públicas). */
  anonymous?: boolean;
}

/* ── Fila de refresh: garante um único refresh concorrente ─────────────────── */
let refreshing: Promise<boolean> | null = null;

async function runRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await rawFetch('/auth/refresh', {
      method: 'POST',
      body: { accessToken: tokenStore.getAccessToken() ?? '', refreshToken },
      skipAuthRefresh: true,
      anonymous: true,
    });
    if (!res.ok) return false;
    const envelope = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (!envelope.success || !envelope.data) return false;
    tokenStore.setTokens(envelope.data.accessToken, envelope.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/** Coalescência: chamadas simultâneas compartilham a mesma promessa de refresh. */
function ensureRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = runRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/* ── fetch cru (monta URL + headers), sem desempacotar o envelope ──────────── */
function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const headers = new Headers(opts.headers);
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (opts.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Tenant, cultura e timezone — em TODA requisição.
  headers.set('X-Tenant-Id', requestContext.getTenant());
  headers.set('Accept-Language', requestContext.getLocale());
  headers.set('X-Timezone', requestContext.getTimeZone());

  if (!opts.anonymous) {
    const token = tokenStore.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(buildUrl(path, opts.params), {
    ...opts,
    headers,
    credentials: 'include',
    body: isFormData
      ? (opts.body as FormData)
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
  });
}

/* ── API pública: request<T> desempacota o envelope e trata 401 ────────────── */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, opts);

  // 401 → tenta refresh uma vez e re-executa (exceto em rotas de auth).
  const isAuthFree = AUTH_FREE.some((p) => path.startsWith(p));
  if (res.status === 401 && !opts.skipAuthRefresh && !isAuthFree) {
    const ok = await ensureRefresh();
    if (ok) {
      res = await rawFetch(path, opts);
    } else {
      tokenStore.clear();
      redirectToLogin();
      throw new ApiError(401, 'Sessão expirada.');
    }
  }

  // 204 / corpo vazio.
  if (res.status === 204) return undefined as T;

  let envelope: ApiResponse<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      envelope = JSON.parse(text) as ApiResponse<T>;
    } catch {
      envelope = null;
    }
  }

  if (!res.ok || (envelope && envelope.success === false)) {
    const message = envelope?.message || `Erro ${res.status}`;
    throw new ApiError(res.status, message, envelope);
  }

  return (envelope ? envelope.data : undefined) as T;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'DELETE' }),
  /** Acesso cru para casos especiais (download, etc.). */
  raw: rawFetch,
};
