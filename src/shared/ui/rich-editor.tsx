'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2,
  List, ListOrdered, Code, Link as LinkIcon, ImageIcon, Undo, Redo, Quote,
  X, Check, Unlink,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

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

function Btn({ active, onClick, children, title, className: cls }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'grid h-7 w-7 place-items-center rounded text-sm transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-dim hover:bg-panel-2 hover:text-text',
        cls,
      )}
    >
      {children}
    </button>
  );
}

function LinkPopover({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = () => {
    if (!url.trim()) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); }
    else { editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run(); }
    setOpen(false);
    setUrl('');
  };

  const openPopover = () => {
    const prev = editor.getAttributes('link').href ?? '';
    setUrl(prev);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') setOpen(false); }}
          placeholder="https://..."
          className="h-7 w-44 rounded border border-border bg-bg-subtle px-2 text-xs outline-none focus:border-primary"
        />
        <Btn onClick={apply} title="Apply"><Check className="h-3.5 w-3.5 text-success" /></Btn>
        {editor.isActive('link') && (
          <Btn onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setOpen(false); }} title="Remove link">
            <Unlink className="h-3.5 w-3.5 text-danger" />
          </Btn>
        )}
        <Btn onClick={() => setOpen(false)} title="Cancel"><X className="h-3 w-3" /></Btn>
      </div>
    );
  }

  return <Btn active={editor.isActive('link')} onClick={openPopover} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Btn>;
}

function ImagePopover({ editor, onImagePaste }: { editor: Editor; onImagePaste?: (file: File) => Promise<string> }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const insertUrl = () => {
    if (url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
    setOpen(false);
    setUrl('');
  };

  const handleFile = async (file: File) => {
    if (onImagePaste) {
      const src = await onImagePaste(file);
      editor.chain().focus().setImage({ src }).run();
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result }).run();
      };
      reader.readAsDataURL(file);
    }
    setOpen(false);
  };

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertUrl(); } if (e.key === 'Escape') setOpen(false); }}
          placeholder="URL da imagem..."
          className="h-7 w-40 rounded border border-border bg-bg-subtle px-2 text-xs outline-none focus:border-primary"
        />
        <Btn onClick={insertUrl} title="Insert"><Check className="h-3.5 w-3.5 text-success" /></Btn>
        <Btn onClick={() => fileRef.current?.click()} title="Upload" className="text-primary">
          <ImageIcon className="h-3.5 w-3.5" />
        </Btn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <Btn onClick={() => setOpen(false)} title="Cancel"><X className="h-3 w-3" /></Btn>
      </div>
    );
  }

  return (
    <Btn onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }} title="Image">
      <ImageIcon className="h-3.5 w-3.5" />
    </Btn>
  );
}

function Toolbar({ editor, onImagePaste, compact }: { editor: Editor; onImagePaste?: (file: File) => Promise<string>; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-panel-2/30 px-2 py-1.5">
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)"><UnderlineIcon className="h-3.5 w-3.5" /></Btn>
      {!compact && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></Btn>
          <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></Btn>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-3.5 w-3.5" /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></Btn>
      {!compact && (
        <>
          <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="h-3.5 w-3.5" /></Btn>
          <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block"><Code className="h-3.5 w-3.5" /></Btn>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <LinkPopover editor={editor} />
      <ImagePopover editor={editor} onImagePaste={onImagePaste} />
      <div className="ml-auto flex items-center gap-0.5">
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)"><Undo className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)"><Redo className="h-3.5 w-3.5" /></Btn>
      </div>
    </div>
  );
}

export function RichEditor({ value, onChange, placeholder, onImagePaste, readOnly, className, minHeight = '140px', compact }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
      ImageExt.configure({ inline: true, HTMLAttributes: { class: 'max-w-full rounded-md my-2' } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: 'outline-none min-h-full' },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!files?.length) return false;
        const img = Array.from(files).find(f => f.type.startsWith('image/'));
        if (!img) return false;
        event.preventDefault();
        if (onImagePaste) {
          onImagePaste(img).then(url => { editor?.chain().focus().setImage({ src: url }).run(); });
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') editor?.chain().focus().setImage({ src: reader.result }).run();
          };
          reader.readAsDataURL(img);
        }
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const img = Array.from(files).find(f => f.type.startsWith('image/'));
        if (!img) return false;
        event.preventDefault();
        if (onImagePaste) {
          onImagePaste(img).then(url => { editor?.chain().focus().setImage({ src: url }).run(); });
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') editor?.chain().focus().setImage({ src: reader.result }).run();
          };
          reader.readAsDataURL(img);
        }
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value);
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
    <div className={cn('overflow-hidden rounded-lg border border-border bg-bg-subtle transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', className)}>
      <Toolbar editor={editor} onImagePaste={onImagePaste} compact={compact} />
      <div className="px-3 py-2" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function RichContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn('rich-editor-content prose-sm text-sm leading-relaxed text-text', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
