# Orbit Web

Frontend Next.js (App Router) da **Orbit — Resolution Intelligence Platform**.
Consome a `Orbit.Api` (.NET 10) e implementa, nesta entrega, a **Frontend Shell**
(F8.1/F8.2) e as features de autenticação **F2.7 / F2.8 / F2.9**, além de i18n,
tema variável por tenant, busca global e o Notification Center (F10.5).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS com tema 100% em variáveis CSS (`src/theme/tokens.css`)
- TanStack Query (dados) + Zustand (estado de UI/auth)
- next-intl (i18n sem roteamento por path; cultura via cookie)
- react-hook-form + zod (formulários)
- @microsoft/signalr (notificações em tempo real)
- qrcode.react (setup de MFA)

## Rodando

```bash
npm install
cp .env.local.example .env.local   # ajuste a URL da API se necessário
npm run dev                          # http://localhost:3000
```

A API precisa estar de pé (`dotnet run --project Orbit.Api`, em `https://localhost:5001`)
e o `http://localhost:3000` já está liberado no CORS da API.

## Multi-tenancy

Tenants são separados por **subdomínio**: `empresaA.orbit.com → empresaa`.
O slug é extraído do host (`src/config/tenant-settings.ts`) e enviado no header
`X-Tenant-Id` em **todas** as requisições (necessário nas rotas pré-login; após o
login o claim do JWT tem prioridade no backend).

Para desenvolver em `localhost` (sem subdomínio), defina o tenant em
`NEXT_PUBLIC_DEFAULT_TENANT`. Para simular subdomínios, use o arquivo `hosts`
(`127.0.0.1 empresaa.orbit.local`) e acesse `http://empresaa.orbit.local:3000`.

## Settings por tenant (Azure/AWS-ready)

`src/config/tenant-settings.ts` define a interface `TenantSettingsProvider`.
A implementação atual é **local** (`tenant-settings.local.ts`, catálogo estático).
Para produção, basta criar um `AzureTenantSettingsProvider` / `AwsTenantSettingsProvider`
e trocar o `tenantSettingsProvider` exportado — nenhum outro código muda.

Cada tenant define: `displayName`, `defaultCulture`, `supportedCultures`,
`defaultTimezone` e `theme` (branding).

## Cultura, timezone e tema

- **Cultura** (pt-BR / en-US / es-ES): default vem do tenant, o usuário troca em
  tela (`LanguageSwitcher`); persistido no cookie `orbit-locale` e enviado em
  `Accept-Language`.
- **Timezone**: default do tenant; enviado em `X-Timezone`. Datas vêm em UTC da
  API e são formatadas no fuso de exibição (`src/lib/datetime.ts`).
- **Tema**: todos os tokens (cores, fontes, espaçamentos, bordas, raios, sombras)
  são variáveis CSS em `src/theme/tokens.css`. O branding do tenant sobrescreve as
  variáveis em runtime (`apply-tenant-theme.ts`). Claro/escuro/sistema via
  `ThemeToggle`.

## Autenticação 

- **Login** — `src/app/(auth)/login/page.tsx`.
- ** Interceptor** — `src/lib/api/client.ts`: wrapper único de `fetch` para
  **todos os endpoints**. Anexa `Authorization`, `X-Tenant-Id`, `Accept-Language`
  e `X-Timezone`; em `401` faz **um** refresh com **fila** (refresh concorrente é
  coalescido) e re-executa; se falhar, limpa a sessão e vai para `/login`.
  Desempacota o envelope `ApiResponse<T>` e lança `ApiError` em falha.
- **F2.9 MFA** — verificação pós-login (`/mfa-verify`) e setup com QR + códigos de
  recuperação (`/settings/security`).

Tokens: **access token em memória** (some no reload, recuperado via refresh);
**refresh token em localStorage**. Ver `src/lib/api/token-store.ts`.

> Observação: a API valida o MFA já autenticado (não há `requiresMfa` no login).
> Por isso, ao logar com 2FA ativo, a sessão fica `mfa_pending` e a área logada só
> libera após `POST /auth/mfa/validate`.

## Busca global e Notificações 

- **Busca global**: `GlobalSearch` (Ctrl+K), chama `GET /search` com debounce e
  agrupa por tipo (`ticket`, `rootcause`, `knowledge`, `resolution`).
- **Notification Center**: sino + drawer (`GET /notifications`), badge de não
  lidas, marcar como lida / tudo lido, e tempo real via SignalR no hub
  `/hubs/orbit` (evento `ReceiveNotification`).

## Estrutura

```
src/
  app/                 # rotas (App Router): (auth) e (app)
  components/          # ui/, shell/, search/, notifications/, states/
  config/              # tenant settings (provider abstrato + local)
  hooks/               # useSignalR
  i18n/                # config + request (next-intl)
  lib/api/             # client (interceptor), endpoints, types, token-store
  messages/            # pt-BR / en-US / es-ES
  providers/           # AppProviders, AuthBootstrap
  stores/              # auth-store, ui-store
  theme/               # tokens.css + apply-tenant-theme
```
