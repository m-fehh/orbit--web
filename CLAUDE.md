# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Overview

**orbit--web** is the Next.js 14 (App Router) frontend for **Orbit — Resolution Intelligence Platform**. It consumes the `Orbit.Api` (.NET 10) backend and implements a multi-tenant, feature-based SPA with i18n, role-based UI, and real-time notifications via SignalR.

**Key architectural decisions are recorded in memory files** at `C:\Users\FelipeMartins\.claude\projects\...\memory\`:
- `orbit-api-contracts.md` — Non-obvious API contract details (envelope shape, MFA flow, tenant header, search result shape, etc.)
- `orbit-web-decisoes.md` — Front-end architectural decisions (tokens, interceptor strategy, branding provider, i18n, multi-tab workspace, admin structure, etc.)

When working with this codebase, **read those memories first** to understand prior design decisions and avoid regressions.

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production build locally
pnpm start

# Type check (no emit)
pnpm typecheck
```

**Prerequisites:**
- Node 18+ (pnpm or npm)
- API running on `https://localhost:44360/api/v1` (see `.env.local`)
- Optional: simulate subdomains via `/etc/hosts` (e.g., `127.0.0.1 empresaa.orbit.local`)

---

## High-Level Architecture

### Folder Structure & Layers

```
src/
├── app/                    # Next.js App Router (minimal, routing only)
│   ├── (auth)/             # unauthenticated: /login, /mfa-verify
│   ├── (app)/              # authenticated: /workspace, /dashboard, /settings, /admin, etc.
│   └── layout.tsx / page.tsx
│
├── features/               # Feature-based domain modules (NOT src/components or src/stores at root)
│   ├── auth/               # Login, MFA, token/permission stores, auth bootstrap
│   ├── shell/              # Header, sidebar, theme toggle, language switcher, user menu
│   ├── workspace/          # Multi-tab workspace (tab-store, tab-bar, view-registry)
│   ├── windows/            # Floating window system (modal/drawer, window-store, host)
│   ├── tickets/            # Ticket detail, central list, forms, timeline, SLA panel, attachments
│   ├── investigations/     # Investigation center UI (evidence, hypotheses, findings)
│   ├── admin/              # User/role/profile/team management, audit log viewer
│   ├── dashboard/          # Operational dashboard with widgets
│   ├── search/             # Global search (Ctrl+K)
│   └── notifications/      # Notification center, SignalR hook
│
├── shared/                 # Truly reusable, domain-agnostic utilities
│   ├── api/                # HTTP client (interceptor), endpoints.ts, types.ts, token-store
│   ├── ui/                 # Base UI components (Modal, Button, Input, Badge, Portal, etc.)
│   ├── lib/                # Helpers (datetime, utils)
│   ├── i18n/               # next-intl config + request handler
│   └── theme/              # tokens.css (CSS variables), tenant branding applier
│
├── providers/              # Root-level providers (AppProviders, AuthBootstrap)
├── config/                 # Tenant settings provider (abstract + local impl)
├── hooks/                  # Cross-domain hooks (useSignalR, etc.)
└── messages/               # i18n JSON (pt-BR, en-US, es-ES)
```

### Key Architectural Patterns

#### 1. **HTTP Interceptor (Single Point of Control)**
- **File:** `src/shared/api/client.ts`
- **Pattern:** Every API call goes through one `fetch` wrapper that:
  - Injects `Authorization: Bearer {token}`, `X-Tenant-Id`, `Accept-Language`, `X-Timezone`
  - Catches `401` → triggers **coalesced refresh** (multiple concurrent 401s hit refresh once) → retries
  - On refresh failure → clears session, redirects to `/login`
  - Unpacks the envelope `{ success, statusCode, message, data }` and throws `ApiError` on failure
- **Why:** Single point to audit, modify, or test. No scattered fetch calls with ad-hoc headers.

#### 2. **Token Strategy**
- **Access token:** In-memory (Zustand store). Lost on page reload; recovered via refresh token.
- **Refresh token:** localStorage (survives reload).
- **Recovery on boot:** `AuthBootstrap.tsx` calls `GET /auth/me` → auto-refresh if stale.
- **Why:** Access token in memory = secure (not serialized). Refresh in localStorage = smooth UX (no forced login after refresh).

#### 3. **Multi-Tab Workspace**
- **File:** `src/features/workspace/tab-store.ts`
- **Pattern:** Each ticket/entity opens in a **tabbed interface** (like VS Code or browser tabs). Each tab has:
  - Unique key + component type (registered in `view-registry.tsx`)
  - Back/forward history + pin + favorite
  - Drag-reorder + right-click context menu
  - Persistent in localStorage
- **Why:** Professional UX for power users; easier to work with multiple tickets simultaneously.

#### 4. **Floating Window System**
- **File:** `src/features/windows/` (window-store.ts, floating-window.tsx, window-host.tsx)
- **Pattern:** Modals/drawers are draggable, resizable, minimizable windows. New Ticket opens as a modal window.
- **Why:** Multi-window editing; non-modal forms don't block the main workspace.

#### 5. **CSS-Variable Theming**
- **File:** `src/shared/theme/tokens.css`
- **Pattern:** ALL colors, typography, spacing, shadows are CSS variables. Tenant branding overrides them at runtime via `apply-tenant-theme.ts`.
- **Gotcha:** Tailwind's `borderColor.DEFAULT`, `ringColor.DEFAULT`, `divideColor.DEFAULT` must point to a CSS variable, not gray-200, or dark mode has "white" borders.
- **Why:** True multi-tenancy branding without CSS-in-JS; instant theme switches (dark/light/tenant-specific).

#### 6. **Feature-Isolated i18n**
- **Files:** `src/messages/{locale}.json`, `src/shared/i18n/config.ts`
- **Pattern:** `useTranslations('namespace')` from next-intl. Locale in cookie `orbit-locale`, not URL path.
- **Status:** Ticket & admin screens have full i18n; older screens may have pt-BR hardcoded (known debt).
- **Why:** No URL rewrites; cookie-based locale is SaaS-friendly.

#### 7. **Multi-Tenancy by Subdomain**
- **Pattern:** Tenant slug extracted from hostname (`empresaa.orbit.com` → `empresaa`). In localhost, use `NEXT_PUBLIC_DEFAULT_TENANT`.
- **Branding:** `GET /branding` (anon endpoint) fetches tenant logo, colors, etc. Stored in Zustand.
- **Why:** Transparent; one domain per tenant = secure, easy to brand.

---

## Critical Behavioral Rules (From Memory)

**Do NOT regress these:**

1. **Overlays (modals, drawers) in header must use `<Portal>`** — header has `backdrop-filter: glass` which creates a containing block. Any `position:fixed` anchors to it. Use `createPortal(content, document.body)` in `src/shared/ui/portal.tsx`.

2. **Tailwind border colors — set defaults** — without `borderColor.DEFAULT = CSS variable`, dark mode shows white borders. This is already configured; do not remove.

3. **Sidebar collapse button floats outside** — not sticky/fixed inside; it floats on the border. State in `ui-store` (mobile-nav-open, sidebar expanded/collapsed).

4. **Window/modal cascade centering** — windows are centered via `window-store` calculating center by `innerWidth/Height`. No per-window manual positioning; use window-store.

5. **Access rule tree is hierarchical** — roles are profiles; profiles have access rules linked by `ParentId`. The tree allows cascading permissions. Combobox searches by ID (client-side) from `/internal/profilegroups`.

---

## API Contracts (Critical Sync Points)

**Envelope shape:**
```typescript
// Every API response
{
  "success": boolean,
  "statusCode": number,
  "message": string | null,
  "data": T | null
}
```

**Key endpoints (see `src/shared/api/endpoints.ts` for full list):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | `{ email, password }` → `{ accessToken, refreshToken, expiresIn }` |
| `/auth/refresh` | POST | `{ accessToken, refreshToken }` → new tokens |
| `/auth/me` | GET | Current user + permissions (used on boot) |
| `/auth/mfa/setup` | POST | Returns QR URI + shared key |
| `/auth/mfa/enable` | POST | Verify code + enable MFA |
| `/auth/mfa/validate` | POST | Validate 6-digit code during login |
| `/tickets` | GET/POST | List (paged, filterable) or create |
| `/tickets/{id}` | GET/PATCH | Detail or update |
| `/tickets/{id}/comments` | GET/POST | Comments (internal/public flag) |
| `/tickets/{id}/attachments` | GET/POST | Upload or list |
| `/tickets/{id}/worklogs` | GET/POST | Time tracking |
| `/investigations/{id}` | GET/POST | Investigation CRUD |
| `/investigations/{id}/evidences` | GET/POST | Evidence list + add |
| `/investigations/{id}/hypotheses` | GET/POST | Hypothesis CRUD |
| `/rootcauses` | GET/POST | Root cause catalog |
| `/knowledge-assets` | GET/POST | Knowledge base |
| `/notifications` | GET | Paged list of notifications |
| `/branding` | GET | Tenant branding (anon) |
| `/internal/profilegroups` | GET | Admin: list profile groups (for comboboxes) |

**Non-obvious contract details (see `orbit-api-contracts.md` memory):**
- MFA: no `requiresMfa` flag on login; instead, `user.twoFactorEnabled` indicates 2FA active.
- Search: result type is lowercase (`"ticket"` not `"Ticket"`); `reference` not `score`.
- Tickets: enum values are **strings in responses** (e.g., `"Medium"`, `"New"`), but **numbers in requests** (e.g., priority: 2).

---

## Common Dev Tasks

### Adding a New Feature (Domain)

1. Create folder in `src/features/{domain}/`.
2. Add feature-local components, hooks, services as `.tsx` / `.ts` in that folder.
3. If the feature needs a store (UI state), create `{domain}-store.ts` (Zustand).
4. Register any new page routes in `src/app/(app)/` or `src/app/(auth)/`.
5. If the feature opens a modal/window, use `window-store` (not inline `<dialog>`).
6. Add i18n keys to all three `messages/{locale}.json` files.

### Adding a New API Endpoint

1. Declare the contract (request/response types) in `src/shared/api/types.ts`.
2. Add the endpoint function in `src/shared/api/endpoints.ts` (prefer `apiClient.get/post/patch/delete` which auto-unpacks the envelope).
3. Use that endpoint from the feature via TanStack Query: `useMutation(myEndpoint)` or `useQuery({ queryKey: [...], queryFn: myEndpoint })`.

### Testing the Workspace Tabs

1. Open ticket A (opens in tab 1).
2. Open ticket B (opens in tab 2).
3. Click back/forward in the tab history.
4. Right-click tab, select "Pin" or "Add to Favorites".
5. Reload page — tabs persist in localStorage.
6. Drag tabs to reorder.

### Simulating a Different Tenant

1. Add to `/etc/hosts` (or `C:\Windows\System32\drivers\etc\hosts` on Windows):
   ```
   127.0.0.1 empresaa.orbit.local
   127.0.0.1 empresab.orbit.local
   ```
2. Visit `http://empresaa.orbit.local:3000` (adjust `NEXT_PUBLIC_DEFAULT_TENANT` for fallback, or rely on the subdomain).
3. API sees `X-Tenant-Id: empresaa` header.

---

## Type Safety & Validation

- **Form validation:** react-hook-form + Zod (schema-driven).
- **API response validation:** The envelope is validated by the interceptor; beyond that, trust the backend. No per-response Zod schema (over-engineering).
- **TypeScript:** Strict mode on; use `unknown` for untrusted data, `as const` for union discriminators.

---

## Performance & Caching

- **TanStack Query:** Used for all server state. Default stale time is 1m. Adjust per feature (e.g., dashboard refreshes every 30s).
- **localStorage:** Keep it light. Workspace tabs, language preference, and sidebar state are persisted.
- **Debounce search:** 200ms (global search) to avoid hammering `/search` endpoint.

---

## Debugging

- **Missing API headers?** Check `src/shared/api/client.ts` interceptor.
- **Token not refreshing?** Check token-store and refresh logic in client.ts.
- **403 after role change?** Frontend caches permissions in JWT; logout/login to refresh.
- **Dark mode issues?** Check `src/shared/theme/tokens.css` and that Tailwind config has custom `borderColor.DEFAULT`.
- **Modal behind header?** Ensure it uses `<Portal>` and is in the root `window-host` (not nested).
- **Language not changing?** Ensure cookie `orbit-locale` is set and page is revalidated.

---

## Known Debt & Next Steps

1. **i18n coverage:** Admin screens (users, teams, profiles, audit log) and ticket detail screens still have pt-BR hardcoded. Next round should add keys to messages JSON.
2. **Access rule tree UI:** Component exists; needs refinement (visual hierarchy, expand-all toggle, better nesting display).
3. **Data grids:** No generic DataGrid component yet. Ticket list uses custom table. Recommend TanStack Table (React Table) for future.
4. **Dashboard:** Exists but widgets are not interactive (no drill-down to tickets from SLA gauge, etc.).
5. **Engineering work items:** Listed but not fully wired to investigations.

---

## Synchronization with Orbit.Api

**The frontend MUST stay in sync with these API guarantees:**

1. **Envelope shape:** Always `{ success, statusCode, message, data }`.
2. **Enum serialization:** Numbers in requests, strings in responses (not settable by frontend).
3. **Tenant header:** `X-Tenant-Id` required on all requests (especially pre-login routes like `/branding`).
4. **JWT claims:** Interceptor expects `userId`, `tenant`, `permissions[]` inside the JWT.
5. **Permission keys:** Backend defines the permission keys (e.g., `ticket.create`, `admin.users.view`). Frontend reads them from the JWT and conditionally renders UI.

If the API changes a response shape or permission key, **update endpoints.ts and types.ts immediately**, or the frontend will break.

---

## IDE & Editor Setup

- **ESLint:** Included via Next.js defaults. Run via `pnpm lint` if configured (not currently in package.json; consider adding).
- **Prettier:** Optional; no config provided. The codebase is hand-formatted.
- **VS Code extensions (optional):**
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (not needed, but good for Vue projects; skip for Next.js)
  - ES7+ React/Redux/React-Native snippets

---

## Further Reading

- **Next.js docs:** https://nextjs.org/docs (App Router, middleware, API routes)
- **Tailwind CSS:** https://tailwindcss.com/docs
- **TanStack Query:** https://tanstack.com/query/latest
- **Zustand:** https://github.com/pmndrs/zustand
- **next-intl:** https://next-intl-docs.vercel.app/
- **react-hook-form:** https://react-hook-form.com/

---
