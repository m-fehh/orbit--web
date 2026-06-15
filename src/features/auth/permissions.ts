/**
 * PBAC no front: as permissões do usuário vêm das claims `permission` do JWT
 * (derivadas do ProfileGroup → AccessRules no backend). Um profile Administrator
 * emite a permissão coringa `*`.
 *
 * As chaves seguem o catálogo da API (ex.: `ticket.create`, `ticket.view`,
 * `admin.users.view`, `role.view`). Ver Orbit.Api/Security/Permissions.cs.
 */

/** Decodifica o payload de um JWT (sem validar assinatura — só leitura de claims). */
export function decodeJwt(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const ROLE_KEYS = ['role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

/** Extrai a lista de permissões do payload (claim `permission`: string ou string[]). */
export function extractPermissions(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const raw = payload['permission'] ?? payload['permissions'];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return [raw];
  return [];
}

/** Extrai a role (chave) do payload, tolerando o claim com URI completa. */
export function extractRole(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  for (const k of ROLE_KEYS) {
    const v = payload[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

/** Cria um verificador de permissão a partir da lista concedida. */
export function makeChecker(permissions: string[]) {
  const set = new Set(permissions);
  const isAdmin = set.has('*');
  const can = (key: string): boolean => {
    if (isAdmin || set.has(key)) return true;
    // suporta coringa por módulo (ex.: "ticket.*" cobre "ticket.create")
    const module = key.split('.')[0];
    return set.has(`${module}.*`);
  };
  return {
    isAdmin,
    can,
    canAny: (keys: string[]) => keys.some(can),
    canAll: (keys: string[]) => keys.every(can),
  };
}

/** Lê permissões diretamente de um access token. */
export function permissionsFromToken(token: string | null): string[] {
  return extractPermissions(decodeJwt(token));
}
