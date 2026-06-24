'use client';

import dynamic from 'next/dynamic';
import { useRef, useState, useCallback } from 'react';
import {
  Bold, Code, Eye, Hash, ImageIcon, Italic,
  Link as LinkIcon, List, AtSign, Pencil, Quote, X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false });

// ─── Chip de imagem: aparece no lugar da imagem nos comentários ───────────────
function ImageChip({ src, alt }: { src?: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  const label = alt || src.split('/').pop()?.split('?')[0] || 'Imagem';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-xs text-text hover:bg-panel-2 transition-colors mx-0.5 my-0.5"
      >
        <ImageIcon className="h-3 w-3 shrink-0 text-primary" />
        <span className="max-w-[180px] truncate">{label}</span>
      </button>
      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute -top-3 -right-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-border bg-panel shadow-md text-dim hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt || 'Imagem'}
                className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

// Componentes para substituir imagens por chips no preview de comentários
const IMAGE_AS_CHIP_COMPONENTS = {
  img: ({ src, alt }: { src?: string; alt?: string }) => <ImageChip src={src} alt={alt} />,
};

// ─── Modal de link ────────────────────────────────────────────────────────────
function LinkModal({ onInsert, onClose }: { onInsert: (text: string, url: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-80 rounded-xl border border-border bg-panel shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text">Inserir link</h3>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-dim">
            Texto exibido
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Texto do link"
              className="h-8 rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-dim">
            URL
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onInsert(text, url); } if (e.key === 'Escape') onClose(); }}
              className="h-8 rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-dim hover:text-text">Cancelar</button>
          <button type="button" onClick={() => onInsert(text, url)} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90">Inserir</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dropdown de sugestões @menção / #ticket ──────────────────────────────────
interface MentionSuggestion { id: number | string; label: string; kind: 'user' | 'ticket'; }

function SuggestionsDropdown({ items, onSelect }: { items: MentionSuggestion[]; onSelect: (s: MentionSuggestion) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 z-[9999] mb-1 max-h-48 w-56 overflow-auto rounded-xl border border-border bg-panel shadow-xl">
      {items.map(s => (
        <button
          key={`${s.kind}-${s.id}`}
          type="button"
          onMouseDown={e => { e.preventDefault(); onSelect(s); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-panel-2 transition-colors"
        >
          <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
            s.kind === 'user' ? 'bg-primary/15 text-primary' : 'bg-info/15 text-info')}>
            {s.kind === 'user' ? <AtSign className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
          </span>
          <span className="truncate">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Preview interno do editor (reutilizado no modo live e preview) ───────────
function EditorPreview({ value, minHeight }: { value: string; minHeight: string }) {
  const isHtml = value.trim() && /<[a-zA-Z][^>]*>/.test(value);
  if (!value.trim()) {
    return <p className="text-dim text-sm italic px-3 py-2.5">Pré-visualização aparecerá aqui…</p>;
  }
  if (isHtml) {
    return (
      <div
        className="rich-editor-content px-3 py-2.5 text-sm leading-relaxed text-text overflow-auto"
        style={{ minHeight }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }
  return (
    <div className="rich-editor-content px-3 py-2.5 overflow-auto" style={{ minHeight }}>
      <MarkdownPreview
        source={value}
        style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }}
        wrapperElement={{ 'data-color-mode': 'auto' } as React.HTMLAttributes<HTMLDivElement>}
      />
    </div>
  );
}

// ─── Editor principal ─────────────────────────────────────────────────────────
type EditorMode = 'write' | 'live' | 'preview';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onImagePaste?: (file: File) => Promise<string>;
  onMentionSearch?: (query: string) => Promise<MentionSuggestion[]>;
  onTicketSearch?: (query: string) => Promise<MentionSuggestion[]>;
  minHeight?: string;
  className?: string;
  /** Modo compacto: esconde o botão "Dividido" e usa write por padrão */
  compact?: boolean;
}

export function MarkdownEditor({
  value, onChange, placeholder, onImagePaste,
  onMentionSearch, onTicketSearch,
  minHeight = '120px', className, compact = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>(compact ? 'write' : 'live');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionTrigger, setMentionTrigger] = useState<'@' | '#' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mentionQueryRef = useRef('');

  const insert = useCallback((before: string, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }, [value, onChange]);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    const pos = e.target.selectionStart;
    const textBefore = newVal.slice(0, pos);
    const atMatch = textBefore.match(/(?:^|[\s\n])@([\w]*)$/);
    const hashMatch = textBefore.match(/(?:^|[\s\n])#([\w]*)$/);
    if (atMatch && onMentionSearch) {
      mentionQueryRef.current = atMatch[1];
      setMentionTrigger('@');
      setSuggestions(await onMentionSearch(atMatch[1]));
    } else if (hashMatch && onTicketSearch) {
      mentionQueryRef.current = hashMatch[1];
      setMentionTrigger('#');
      setSuggestions(await onTicketSearch(hashMatch[1]));
    } else {
      setMentionTrigger(null);
      setSuggestions([]);
    }
  }, [onChange, onMentionSearch, onTicketSearch]);

  const selectSuggestion = useCallback((s: MentionSuggestion) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const trigger = mentionTrigger ?? '@';
    const replaced = value.slice(0, pos).replace(
      new RegExp(`(${trigger}${mentionQueryRef.current})$`),
      s.kind === 'user' ? `@${s.label} ` : `#${s.id} `,
    );
    onChange(replaced + value.slice(pos));
    setSuggestions([]);
    setMentionTrigger(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(replaced.length, replaced.length); });
  }, [value, onChange, mentionTrigger]);

  const insertLink = useCallback((text: string, url: string) => {
    if (!url.trim()) { setShowLinkModal(false); return; }
    insert(text.trim() ? `[${text.trim()}](${url.trim()})` : `[${url.trim()}](${url.trim()})`);
    setShowLinkModal(false);
  }, [insert]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onImagePaste) return;
    const img = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (!img) return;
    e.preventDefault();
    const file = img.getAsFile();
    if (!file) return;
    const url = await onImagePaste(file);
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    onChange(value.slice(0, start) + `![imagem](${url})` + value.slice(start));
  }, [onImagePaste, value, onChange]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (!onImagePaste) return;
    const img = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!img) return;
    e.preventDefault();
    onChange(value + `\n![imagem](${await onImagePaste(img)})\n`);
  }, [onImagePaste, value, onChange]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImagePaste || !e.target.files?.[0]) return;
    onChange(value + `\n![imagem](${await onImagePaste(e.target.files[0])})\n`);
    e.target.value = '';
  }, [onImagePaste, value, onChange]);

  const toolBtns = [
    { icon: Bold, title: 'Negrito (Ctrl+B)', before: '**', after: '**' },
    { icon: Italic, title: 'Itálico (Ctrl+I)', before: '_', after: '_' },
    { icon: Code, title: 'Código', before: '`', after: '`' },
    null,
    { icon: List, title: 'Lista', before: '\n- ', after: '' },
    { icon: Quote, title: 'Citação', before: '\n> ', after: '' },
    null,
    { icon: LinkIcon, title: 'Link', before: null as null, after: null as null, action: () => setShowLinkModal(true) },
    { icon: ImageIcon, title: 'Inserir imagem', before: null as null, after: null as null, action: () => fileRef.current?.click() },
  ] as const;

  const textarea = (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onKeyDown={e => { if (suggestions.length > 0 && e.key === 'Escape') { setSuggestions([]); setMentionTrigger(null); } }}
        placeholder={placeholder ?? 'Escreva seu texto… use a barra de ferramentas para formatar'}
        className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text placeholder:text-dim outline-none font-mono leading-relaxed"
        style={{ minHeight }}
      />
      {mentionTrigger && <SuggestionsDropdown items={suggestions} onSelect={selectSuggestion} />}
    </div>
  );

  return (
    <>
      <div className={cn('overflow-visible rounded-lg border border-border bg-bg-subtle transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', className)}>
        {/* Barra de ferramentas */}
        <div className="flex items-center justify-between border-b border-border bg-panel-2/50 px-2 py-1 gap-1 flex-wrap">
          <div className="flex items-center gap-0.5">
            {toolBtns.map((btn, i) => {
              if (btn === null) return <div key={i} className="mx-0.5 h-4 w-px bg-border/70" />;
              const Icon = btn.icon;
              return (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  onMouseDown={e => {
                    e.preventDefault();
                    if ('action' in btn && btn.action) btn.action();
                    else if (btn.before !== null) insert(btn.before, btn.after ?? '');
                  }}
                  className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-panel-2 hover:text-text transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
            {onMentionSearch && (
              <>
                <div className="mx-0.5 h-4 w-px bg-border/70" />
                <button type="button" title="Mencionar usuário (@)"
                  onMouseDown={e => { e.preventDefault(); insert('@'); }}
                  className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-panel-2 hover:text-text transition-colors">
                  <AtSign className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {onTicketSearch && (
              <button type="button" title="Referenciar ticket (#)"
                onMouseDown={e => { e.preventDefault(); insert('#'); }}
                className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-panel-2 hover:text-text transition-colors">
                <Hash className="h-3.5 w-3.5" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Seletor de modo */}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-[11px] font-medium shrink-0">
            <button type="button" onClick={() => setMode('write')}
              className={cn('flex items-center gap-1 px-2 py-1 transition-colors', mode === 'write' ? 'bg-primary text-primary-fg' : 'text-dim hover:text-text')}>
              <Pencil className="h-3 w-3" />Editar
            </button>
            {!compact && (
              <button type="button" onClick={() => setMode('live')}
                className={cn('flex items-center gap-1 px-2 py-1 transition-colors border-l border-r border-border/50', mode === 'live' ? 'bg-primary text-primary-fg' : 'text-dim hover:text-text')}>
                Dividido
              </button>
            )}
            <button type="button" onClick={() => setMode('preview')}
              className={cn('flex items-center gap-1 px-2 py-1 transition-colors', mode === 'preview' ? 'bg-primary text-primary-fg' : 'text-dim hover:text-text')}>
              <Eye className="h-3 w-3" />Ver
            </button>
          </div>
        </div>

        {/* Área de conteúdo */}
        {mode === 'write' && textarea}

        {mode === 'live' && (
          <div className="flex min-h-0 divide-x divide-border">
            {textarea}
            <EditorPreview value={value} minHeight={minHeight} />
          </div>
        )}

        {mode === 'preview' && <EditorPreview value={value} minHeight={minHeight} />}
      </div>

      {showLinkModal && <LinkModal onInsert={insertLink} onClose={() => setShowLinkModal(false)} />}
    </>
  );
}

// ─── Exibição de conteúdo (leitura) ──────────────────────────────────────────
interface MarkdownContentProps {
  content: string;
  className?: string;
  /**
   * Quando true, imagens são exibidas como chips clicáveis em vez de inline.
   * Use isso em comentários/conversas para não "explodir" o layout.
   */
  imageAsChip?: boolean;
}

export function MarkdownContent({ content, className, imageAsChip = false }: MarkdownContentProps) {
  if (!content?.trim()) return null;
  const isHtml = /<[a-zA-Z][^>]*>/.test(content);

  if (isHtml) {
    return (
      <div
        className={cn('rich-editor-content prose-sm text-sm leading-relaxed text-text', className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div className={cn('text-sm leading-relaxed text-text', !imageAsChip && 'rich-editor-content', className)}>
      <MarkdownPreview
        source={content}
        style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }}
        wrapperElement={{ 'data-color-mode': 'auto' } as React.HTMLAttributes<HTMLDivElement>}
        components={imageAsChip ? IMAGE_AS_CHIP_COMPONENTS : undefined}
      />
    </div>
  );
}
