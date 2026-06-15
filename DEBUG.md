# Debug — Orbit Web + Orbit API

Guia para subir e depurar os **dois projetos** juntos (front Next.js + API .NET) e
diagnosticar o erro de login. Comandos em **PowerShell** (Windows).

> Caminhos:
> - Front: `...\news_projects\orbit--web`
> - API:   `...\news_projects\Orbit-Tickets`

---

## 0. Pré-requisitos (uma vez)

```powershell
# Confiar no certificado HTTPS de desenvolvimento do .NET
# (sem isso, o fetch do browser para https://localhost:5001 falha com "Failed to fetch")
dotnet dev-certs https --trust

# SQL Server precisa estar acessível (a connection string está no appsettings da API).
```

---

## 1. Subir a API

```powershell
cd C:\Users\FelipeMartins\Documents\Felipe\stratos\git\news_projects\Orbit-Tickets
dotnet run --project Orbit.Api
```

- Swagger: <https://localhost:5001/swagger>
- No boot a API **semeia o tenant de dev** `orbit` em `[Admin].[Tenants]` (appsetting `SeedTenant`).
- Confira a porta real no output (`Now listening on: https://localhost:5001`). Se for outra, ajuste o `.env.local` do front.

### Testar a API isolada (sem o front)

```powershell
# Branding (anônimo) — precisa do header de tenant
curl.exe -k https://localhost:5001/api/v1/branding -H "X-Tenant-Id: orbit"

# Login — ajuste email/senha para um usuário semeado do tenant
curl.exe -k -X POST https://localhost:5001/api/v1/auth/login `
  -H "Content-Type: application/json" -H "X-Tenant-Id: orbit" `
  -d '{ "email": "admin@orbit.local", "password": "Orbit@123" }'
```

- `-k` ignora o cert self-signed no curl (no browser, use o `dev-certs --trust` acima).
- **200 + `{ success: true, data: { accessToken... } }`** → API ok, o problema (se houver) é no front.
- **401** → credenciais inválidas **ou** o usuário não existe nesse tenant. Veja os seeders/migrations da API para as credenciais reais.
- **Erro de conexão** → API não está no ar / porta errada / SQL fora.

---

## 2. Subir o Front

```powershell
cd C:\Users\FelipeMartins\Documents\Felipe\stratos\git\news_projects\orbit--web

# Confirme o apontamento da API (http vs https / porta)
type .env.local
# NEXT_PUBLIC_API_URL=https://localhost:5001/api/v1
# NEXT_PUBLIC_HUB_URL=https://localhost:5001/hubs/orbit
# NEXT_PUBLIC_DEFAULT_TENANT=orbit   (tenant usado em localhost, sem subdomínio)

npm run dev   # http://localhost:3000
```

---

## 3. Diagnosticar o login (no browser)

1. Abra <http://localhost:3000/login> com o **DevTools** aberto (F12).
2. Tente logar e olhe:
   - **Console**: o cliente HTTP agora loga falhas de rede com a causa provável
     (`[orbit-api] Falha de rede em POST /auth/login: ...`).
   - **Network → a requisição `login`**: veja o **Status** e a aba **Response**.

### Erros comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| `Failed to fetch` / erro de rede no console | Cert HTTPS não confiável, API fora, ou porta errada | `dotnet dev-certs https --trust`; confirme a porta no `.env.local` |
| Preflight `OPTIONS` falha / bloqueio CORS | Origin não liberada na API | A API libera `http://localhost:3000` (`AllowedOrigins`); rode o front nessa origem exata |
| **401** com `{ message: "..." }` | Credenciais inválidas ou tenant errado | Use credenciais semeadas; confirme `X-Tenant-Id: orbit` (o front envia automático) |
| **404** em `/branding` ou `/auth/login` | `NEXT_PUBLIC_API_URL` sem o sufixo `/api/v1` | Ajuste o `.env.local` e reinicie o `npm run dev` |
| Toast genérico sem detalhe | — | O toast agora mostra a `message` da API quando ela responde; sem resposta, cai no genérico traduzido |

> Dica: o toast exibe a **mensagem retornada pela API** (já localizada pela cultura).
> Só cai num texto genérico quando **não houve resposta** (falha de rede).

---

## 4. Debug no VS Code (front)

`.vscode/launch.json` já tem as configs:

- **Next.js: server-side (dev)** — sobe `npm run dev` com debugger no processo Node (breakpoints em Server Components, route handlers, `i18n/request.ts`).
- **Next.js: client-side (Chrome)** — abre o Chrome com breakpoints no código do browser (componentes `'use client'`, `client.ts`, stores).
- **Next.js: full stack** — compound que sobe os dois de uma vez.

Passo a passo:
1. Aba **Run and Debug** (Ctrl+Shift+D).
2. Selecione **Next.js: full stack** e ▶ (F5).
3. Ponha breakpoints em `src/shared/api/client.ts` (no `safeFetch`/`request`) e em
   `src/app/(auth)/login/page.tsx` (`onSubmit`) para inspecionar a chamada.

---

## 5. Debug da API (.NET)

```powershell
cd C:\Users\FelipeMartins\Documents\Felipe\stratos\git\news_projects\Orbit-Tickets
dotnet build Orbit.Api/Orbit.Api.csproj   # confirmar que compila
dotnet run --project Orbit.Api            # logs no console
```

- No VS/Rider/VS Code (C# Dev Kit): F5 em `Orbit.Api` e breakpoints em
  `AuthController.Login` / `AuthService.LoginAsync` para ver onde retorna 401.
- A cultura da resposta vem do header `Accept-Language` (o front manda a cultura atual).
