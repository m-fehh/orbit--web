'use client';

/**
 * Editor rico do sistema — ponto único. Historicamente havia dois editores; agora
 * `RichEditor`/`RichContent` são apenas apelidos do editor canônico em
 * `markdown-editor.tsx` (TipTap), garantindo que TODA tela use o MESMO componente.
 */
export { MarkdownEditor as RichEditor, MarkdownContent as RichContent } from './markdown-editor';
