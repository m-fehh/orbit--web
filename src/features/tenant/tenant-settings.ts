/**
 * Resolução de tenant 100% pela URL — não há catálogo local.
 *
 * Na nuvem, cada cliente é publicado em seu próprio subdomínio
 * (ex.: `clienteA.minhaempresa.com`). O subdomínio É o identificador do tenant
 * (o "tenantId" que a API procura em [Admin].[Tenants]). O front extrai esse slug
 * do host e o envia em `X-Tenant-Id` em toda requisição; o branding (whitelabel,
 * logo, cor, cultura) vem da API via GET /api/v1/branding.
 */

/** Extrai o slug do tenant a partir do host (ex.: "clienteA.minhaempresa.com" → "clientea"). */
export function tenantSlugFromHost(host: string): string {
  const clean = (host || '').split(':')[0].toLowerCase().trim();
  const parts = clean.split('.');
  const ignored = new Set(['www', 'api', 'app']);

  // sub.dominio.tld → 3+ labels. "localhost" e "minhaempresa.com" não têm subdomínio.
  if (parts.length >= 3 && !ignored.has(parts[0])) {
    return parts[0];
  }

  // Sem subdomínio (dev/localhost): usa o tenant de desenvolvimento configurado.
  return (process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'orbit').toLowerCase();
}
