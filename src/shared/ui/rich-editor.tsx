'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, ImageIcon, Undo, Redo, Code, Quote,
  X, Unlink, Type,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImagePaste?: (file: File) => Promise<string>;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  compact?: boolean;
}

const EditorImage = ImageExt.configure({
  inline: false,
  HTMLAttributes: { class: 'rounded-lg border border-border shadow-sm my-3 max-w-full block' },
});

function ToolBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'grid h-7 w-7 place-items-center rounded transition-colors text-sm',
        active ? 'bg-primary/15 text-primary' : 'text-dim hover:bg-panel-2 hover:text-text',
      )}
    >
      {children}
    </button>
  );
}

function LinkModal({ editor, onClose }: { editor: ReturnType<typeof useEditor>; onClose: () => void }) {
  if (!editor) return null;
  const isEditing = editor.isActive('link');
  const prevHref = editor.getAttributes('link').href ?? '';
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, ' ');
  const [displayText, setDisplayText] = useState(selectedText || '');
  const [url, setUrl] = useState(prevHref);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => urlRef.current?.focus(), 50); }, []);

  const apply = () => {
    if (!url.trim()) {
      if (isEditing) editor.chain().focus().extendMarkRange('link').unsetLink().run();
      onClose();
      return;
    }
    const href = url.trim();
    if (displayText.trim() && displayText !== selectedText) {
      editor.chain().focus().deleteSelection()
        .insertContent(`<a href="${href}" target="_blank">${displayText.trim()}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
    }
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-[400px] rounded-xl border border-border bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text">{isEditing ? 'Editar link' : 'Inserir link'}</h3>
            <button type="button" onClick={onClose} className="grid h-6 w-6 place-items-center rounded text-dim hover:text-text hover:bg-panel-2"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-dim"><Type className="h-3 w-3" />Texto exibido</span>
              <input value={displayText} onChange={(e) => setDisplayText(e.target.value)} placeholder="Texto do link" className="h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-dim"><LinkIcon className="h-3 w-3" />URL</span>
              <input ref={urlRef} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') onClose(); }} placeholder="https://..." className="h-9 w-full rounded-lg border border-border bg-bg-subtle px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div>
              {isEditing && (
                <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 transition-colors">
                  <Unlink className="h-3.5 w-3.5" />Remover link
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-dim hover:text-text transition-colors">Cancelar</button>
              <button type="button" onClick={apply} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors">{isEditing ? 'Atualizar' : 'Inserir'}</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export function RichEditor({ value, onChange, placeholder, onImagePaste, readOnly, className, minHeight = '140px', compact }: RichEditorProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const internalUpdate = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer', target: '_blank', rel: 'noopener noreferrer' },
      }),
      EditorImage,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      internalUpdate.current = true;
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: { class: 'outline-none min-h-full' },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length) return false;
        const img = Array.from(files).find(f => f.type.startsWith('image/'));
        if (!img) return false;
        event.preventDefault();
        insertImageFile(img);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const img = Array.from(files).find(f => f.type.startsWith('image/'));
        if (!img) return false;
        event.preventDefault();
        insertImageFile(img);
        return true;
      },
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const insertImageFile = useCallback(async (file: File) => {
    if (!editor) return;
    let src: string;
    if (onImagePaste) {
      src = await onImagePaste(file);
    } else {
      src = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }
    editor.chain().focus().setImage({ src }).run();
  }, [editor, onImagePaste]);

  useEffect(() => {
    if (!editor) return;
    if (internalUpdate.current) { internalUpdate.current = false; return; }
    if (!editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value ?? '');
    }
  }, [value, editor]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div className={cn('rich-editor-content prose-sm text-sm leading-relaxed text-text', className)}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <>
      <div className={cn('overflow-hidden rounded-lg border border-border bg-bg-subtle transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', className)}>
        {/* Toolbar minimalista */}
        <div className="flex items-center gap-0.5 border-b border-border bg-panel-2/50 px-2 py-1 flex-wrap">
          <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado"><UnderlineIcon className="h-3.5 w-3.5" /></ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-border/70 shrink-0" />
          <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
          {!compact && (
            <>
              <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code className="h-3.5 w-3.5" /></ToolBtn>
            </>
          )}
          <div className="mx-0.5 h-4 w-px bg-border/70 shrink-0" />
          <ToolBtn active={editor.isActive('link')} onClick={() => setShowLinkModal(true)} title="Link"><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => fileRef.current?.click()} title="Inserir imagem"><ImageIcon className="h-3.5 w-3.5" /></ToolBtn>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { insertImageFile(f); e.target.value = ''; } }} />
          <div className="ml-auto flex items-center gap-0.5">
            <div className="mx-0.5 h-4 w-px bg-border/70 shrink-0" />
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)"><Undo className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)"><Redo className="h-3.5 w-3.5" /></ToolBtn>
          </div>
        </div>

        <div className="rich-editor-content px-3 py-2.5" style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {showLinkModal && <LinkModal editor={editor} onClose={() => setShowLinkModal(false)} />}
    </>
  );
}

export function RichContent({ html, className }: { html: string; className?: string }) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor?.href) { e.preventDefault(); window.open(anchor.href, '_blank', 'noopener,noreferrer'); }
  }, []);

  return (
    <div
      className={cn('rich-editor-content prose-sm text-sm leading-relaxed text-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
