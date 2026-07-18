'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bold, Code, ImageIcon, Italic,
  Link as LinkIcon, List, X, Loader2,
  Heading2, Strikethrough, ListOrdered, Underline as UnderlineIcon, Quote,
} from 'lucide-react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';
import { tokenStore } from '@/shared/api/token-store';
import { ticketsApi } from '@/shared/api/endpoints';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false });

/**
 * Referência de anexo embutida no conteúdo. Em vez de gravar o base64 inteiro
 * (que polui o editor e trava a tela), gravamos apenas `attachment:{id}`. A imagem
 * real é buscada com o token de autenticação na hora de exibir.
 */
const ATTACHMENT_REF = /^attachment:(\d+)$/;

export function attachmentRef(id: number): string {
  return `attachment:${id}`;
}

async function fetchAttachmentBlob(id: number): Promise<string> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(ticketsApi.downloadAttachmentUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Hook: resolve um src de imagem para uma URL exibível (com auth se for anexo). */
function useResolvedImageSrc(src: string | undefined, enabled = true): { url: string | null; loading: boolean; failed: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src || !enabled) return;
    const m = src.match(ATTACHMENT_REF);
    if (!m) { setUrl(src); return; }
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    fetchAttachmentBlob(Number(m[1]))
      .then((u) => { if (active) { objectUrl = u; setUrl(u); } })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, enabled]);

  return { url, loading, failed };
}

// ─── Imagem inline (resolve anexos com auth) ─────────────────────────────────
function AuthedImage({ src, alt }: { src?: string; alt?: string }) {
  const t = useTranslations('editor');
  const { url, failed } = useResolvedImageSrc(src);
  if (!src) return null;
  if (failed) {
    return (
      <span className="my-1 inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/5 px-2.5 py-1 text-xs text-danger">
        <ImageIcon className="h-3 w-3" /> {t('imageUnavailable')}
      </span>
    );
  }
  if (!url) {
    return (
      <span className="my-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-xs text-dim">
        <Loader2 className="h-3 w-3 animate-spin" /> {t('loadingImage')}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt || t('imageWord')} className="my-2 max-w-full rounded-lg border border-border" />;
}

// ─── Chip de imagem: aparece no lugar da imagem nos comentários ───────────────
function ImageChip({ src, alt }: { src?: string; alt?: string }) {
  const t = useTranslations('editor');
  const [open, setOpen] = useState(false);
  const { url, loading, failed } = useResolvedImageSrc(src, open);
  if (!src) return null;
  const isAttachment = ATTACHMENT_REF.test(src);
  const label = alt || (isAttachment ? t('imageWord') : src.split('/').pop()?.split('?')[0]) || t('imageWord');
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-0.5 my-0.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-xs text-text transition-colors hover:bg-panel-2"
      >
        <ImageIcon className="h-3 w-3 shrink-0 text-primary" />
        <span className="max-w-[180px] truncate">{label}</span>
      </button>
      {open && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute -right-3 -top-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-border bg-panel text-dim shadow-md hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
              {failed ? (
                <div className="rounded-xl bg-panel px-6 py-8 text-sm text-danger">{t('imageUnavailable')}</div>
              ) : !url || loading ? (
                <div className="flex items-center gap-2 rounded-xl bg-panel px-6 py-8 text-sm text-dim">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url} alt={alt || t('imageWord')} className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl" />
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

// Imagens resolvidas com auth (modo leitura/preview padrão)
const IMAGE_COMPONENTS = {
  img: ({ src, alt }: { src?: string; alt?: string }) => <AuthedImage src={src} alt={alt} />,
};

// Imagens como chips clicáveis (comentários/conversas)
const IMAGE_AS_CHIP_COMPONENTS = {
  img: ({ src, alt }: { src?: string; alt?: string }) => <ImageChip src={src} alt={alt} />,
};

// ─── Modal de link ────────────────────────────────────────────────────────────
function LinkModal({ onInsert, onClose }: { onInsert: (text: string, url: string) => void; onClose: () => void }) {
  const t = useTranslations('editor');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-80 rounded-xl border border-border bg-panel shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text">{t('linkModalTitle')}</h3>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-dim">
              {t('linkText')}
              <input value={text} onChange={e => setText(e.target.value)} placeholder={t('linkTextPlaceholder')}
                className="h-8 rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-dim">
              {t('linkUrl')}
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onInsert(text, url); } if (e.key === 'Escape') onClose(); }}
                className="h-8 rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary" />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-dim hover:text-text">{t('cancel')}</button>
            <button type="button" onClick={() => onInsert(text, url)} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90">{t('insert')}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// Tipo mantido por compatibilidade de API (usos antigos passavam callbacks de busca).
export interface MentionSuggestion { id: number | string; label: string; kind: 'user' | 'ticket'; }

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onImagePaste?: (file: File) => Promise<string>;
  /** @deprecated mantidos por compatibilidade — não usados no editor TipTap. */
  onMentionSearch?: (query: string) => Promise<MentionSuggestion[]>;
  onTicketSearch?: (query: string) => Promise<MentionSuggestion[]>;
  minHeight?: string;
  className?: string;
  compact?: boolean;
  onBlur?: () => void;
}

// ─── Editor rico (TipTap / WYSIWYG → HTML) ────────────────────────────────────

function ToolButton({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn('grid h-7 w-7 place-items-center rounded transition-colors hover:bg-panel-2 hover:text-text', active ? 'bg-primary/10 text-primary' : 'text-dim')}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  value, onChange, placeholder, onImagePaste,
  minHeight = '120px', className, onBlur,
}: MarkdownEditorProps) {
  const t = useTranslations('editor');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);
  const editorRef = useRef<Editor | null>(null);

  const uploadAndInsert = useCallback(async (file: File, ed: Editor) => {
    if (!onImagePaste) return;
    setUploading(true);
    try {
      const src = await onImagePaste(file);
      ed.chain().focus().setImage({ src }).run();
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }, [onImagePaste]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      ImageExt,
      Placeholder.configure({ placeholder: placeholder ?? t('textareaPlaceholder') }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rich-editor-content tiptap-content overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-text outline-none',
        style: `min-height:${minHeight}`,
      },
      handlePaste: (_view, event) => {
        if (!onImagePaste || !editorRef.current) return false;
        const img = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
        const file = img?.getAsFile();
        if (!file) return false;
        void uploadAndInsert(file, editorRef.current);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!onImagePaste || !editorRef.current) return false;
        const file = Array.from((event as DragEvent).dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        void uploadAndInsert(file, editorRef.current);
        return true;
      },
    },
    onUpdate: ({ editor }) => { const html = editor.getHTML(); lastEmitted.current = html; onChange(html); },
    onBlur: () => onBlur?.(),
  });

  editorRef.current = editor;

  // Sincroniza mudança externa de value (ex.: limpar após enviar) sem loop.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
      lastEmitted.current = value;
    }
  }, [value, editor]);

  const insertLink = useCallback((text: string, url: string) => {
    setShowLinkModal(false);
    const href = url.trim();
    if (!href || !editor) return;
    const label = text.trim() || href;
    editor.chain().focus().insertContent(`<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>&nbsp;`).run();
  }, [editor]);

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && editor) await uploadAndInsert(f, editor);
    if (fileRef.current) fileRef.current.value = '';
  }, [editor, uploadAndInsert]);

  return (
    <>
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-panel transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', className)}>
        {/* Barra de ferramentas WYSIWYG */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-panel-2/50 px-2 py-1">
          <ToolButton title={t('heading')} active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('bold')} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('italic')} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('underline')} active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('strikethrough')} active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('code')} active={editor?.isActive('code')} onClick={() => editor?.chain().focus().toggleCode().run()}><Code className="h-3.5 w-3.5" /></ToolButton>
          <div className="mx-0.5 h-4 w-px bg-border/70" />
          <ToolButton title={t('list')} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('numberedList')} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolButton>
          <ToolButton title={t('quote')} active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolButton>
          <div className="mx-0.5 h-4 w-px bg-border/70" />
          <ToolButton title={t('link')} active={editor?.isActive('link')} onClick={() => setShowLinkModal(true)}><LinkIcon className="h-3.5 w-3.5" /></ToolButton>
          {onImagePaste && <ToolButton title={t('image')} onClick={() => fileRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></ToolButton>}
          {uploading && (
            <span className="ml-1 flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('uploadingImage')}
            </span>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>

        <EditorContent editor={editor} />
      </div>

      {showLinkModal && <LinkModal onInsert={insertLink} onClose={() => setShowLinkModal(false)} />}
    </>
  );
}

// ─── Exibição de conteúdo (leitura) ──────────────────────────────────────────

/** Renderiza HTML e resolve imagens `attachment:{id}` com autenticação. */
function AuthedHtml({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const created: string[] = [];
    let active = true;
    root.querySelectorAll('img').forEach((img) => {
      const m = (img.getAttribute('src') ?? '').match(ATTACHMENT_REF);
      if (!m) return;
      fetchAttachmentBlob(Number(m[1]))
        .then((u) => { if (active) { created.push(u); img.setAttribute('src', u); } })
        .catch(() => { /* ignore */ });
    });
    return () => { active = false; created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [html]);
  return (
    <div
      ref={ref}
      className={cn('rich-editor-content text-sm leading-relaxed text-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Quando true, imagens são exibidas como chips clicáveis (comentários/conversas). */
  imageAsChip?: boolean;
}

export function MarkdownContent({ content, className, imageAsChip = false }: MarkdownContentProps) {
  if (!content?.trim()) return null;
  const isHtml = /<[a-zA-Z][^>]*>/.test(content);

  if (isHtml) {
    return <AuthedHtml html={content} className={className} />;
  }

  return (
    <div className={cn('text-sm leading-relaxed text-text', !imageAsChip && 'rich-editor-content', className)}>
      <MarkdownPreview
        source={content}
        style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }}
        wrapperElement={{ 'data-color-mode': 'auto' } as React.HTMLAttributes<HTMLDivElement>}
        components={imageAsChip ? IMAGE_AS_CHIP_COMPONENTS : IMAGE_COMPONENTS}
      />
    </div>
  );
}
