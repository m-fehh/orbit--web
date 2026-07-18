import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Remove marcação HTML de um texto para exibição em contextos de UMA linha /
 * truncados (title, line-clamp), onde renderizar HTML rico não faz sentido.
 * Para exibição completa, use `MarkdownContent` (que trata texto puro e HTML).
 */
export function stripHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:[a-zA-Z]+|#\d+);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
