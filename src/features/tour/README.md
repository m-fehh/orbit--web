# Tours de tela — padrão obrigatório

**Toda tela nova do Orbit DEVE ter um tour.** O engine é próprio (spotlight + popover + teclado), sem dependência externa. Passos cujo alvo não existe são pulados automaticamente, então o tour nunca quebra.

## Como adicionar o tour de uma tela nova

1. **Registrar os passos** em `src/features/tour/tours.ts`, no `SCREEN_TOURS`, com a chave do `ViewKind` da tela:

   ```ts
   minhaTela: [
     { key: 'sc.minhaTela.intro' },                                   // passo centralizado (contexto)
     { key: 'sc.minhaTela.acao', target: '[data-tour="algo"]' },      // passo que destaca um elemento
   ],
   ```

2. **Traduzir** cada passo nos 3 idiomas (`pt-BR`, `en-US`, `es-ES`) em `src/messages/*.json`, sob `tour.sc.minhaTela.<passo>`:

   ```json
   "tour": { "sc": { "minhaTela": {
     "intro": { "title": "…", "body": "…" },
     "acao":  { "title": "…", "body": "…" }
   } } }
   ```
   Nunca hardcode texto de tour no componente — sempre i18n.

3. **Marcar os alvos** no JSX com `data-tour="algo"` (o mesmo nome do seletor no passo). Se um elemento é um componente que não repassa `data-*`, envolva num `<span data-tour="algo">…</span>`.

## Regras

- Sem entrada no `SCREEN_TOURS`, a tela cai no `sc.generic.intro` (fallback) — isso é sinal de que **falta o tour**; não deixe assim.
- 2 a 4 passos por tela. Comece com um `intro` centralizado + os pontos de ação principais.
- O botão **"Tour da tela"** já aparece sozinho no breadcrumb de toda tela; não precisa adicionar botão por tela.
- Textos curtos e diretos (o que é + como usar).

## Onde o tour é disparado

- Botão no breadcrumb (`workspace/breadcrumb.tsx`) → `startTour(tourFor(kind))`.
- Tour global do app (chrome) → `APP_TOUR`, auto-inicia no 1º acesso e reinvocável pelo menu do usuário.
