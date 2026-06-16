'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, FileText, Image as ImageIcon, Paperclip, UploadCloud, X } from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type TicketAttachmentResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/states';
import { Portal } from '@/shared/ui/portal';
import { tokenStore } from '@/shared/api/token-store';
import { cn } from '@/shared/lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB — guarda razoável; API valida o limite real.

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function isPdf(contentType: string): boolean {
  return contentType === 'application/pdf';
}

function canPreview(contentType: string): boolean {
  return isImage(contentType) || isPdf(contentType);
}

/** Busca o anexo autenticado e devolve um object URL (revogar depois). */
async function fetchBlobUrl(id: number): Promise<string> {
  const res = await fetch(ticketsApi.downloadAttachmentUrl(id), {
    headers: tokenStore.getAccessToken() ? { Authorization: `Bearer ${tokenStore.getAccessToken()}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Aba completa de Anexos: drag&drop, upload múltiplo, listagem, preview, download. */
export function AttachmentsTab({ ticketId, userName }: { ticketId: number; userName: (uid: number | null) => string }) {
  const t = useTranslations('attachments');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number }[]>([]);
  const [preview, setPreview] = useState<{ att: TicketAttachmentResponse; url: string } | null>(null);

  async function openPreview(a: TicketAttachmentResponse) {
    if (!canPreview(a.contentType)) {
      void downloadOne(a);
      return;
    }
    try {
      const url = await fetchBlobUrl(a.id);
      setPreview({ att: a, url });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('downloadError')));
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'attachments', ticketId],
    queryFn: () => ticketsApi.listAttachments(ticketId),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        throw new Error(t('tooLarge', { files: oversized.map((f) => f.name).join(', ') }));
      }
      setUploading(files.map((f) => ({ name: f.name, pct: 0 })));
      // Upload sequencial para evitar saturar o servidor e dar feedback claro.
      for (const f of files) {
        await ticketsApi.uploadAttachment(ticketId, f);
        setUploading((prev) => prev.map((u) => (u.name === f.name ? { ...u, pct: 100 } : u)));
      }
    },
    onSuccess: () => {
      toast.success(t('uploadOk'));
      qc.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      setUploading([]);
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, t('uploadError')));
      setUploading([]);
    },
  });

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (arr.length === 0) return;
      upload.mutate(arr);
    },
    [upload],
  );

  /** Download autenticado: o link público não passa pelo header Authorization, então usamos fetch. */
  const downloadOne = async (a: TicketAttachmentResponse) => {
    try {
      const url = ticketsApi.downloadAttachmentUrl(a.id);
      const accessToken = tokenStore.getAccessToken();
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = a.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('downloadError')));
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      <Can permission="ticket.attach.add">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-lg text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-panel/40',
          )}
        >
          <UploadCloud className={cn('h-7 w-7', dragOver ? 'text-primary' : 'text-dim')} aria-hidden />
          <p className="text-sm font-medium">{t('dropHere')}</p>
          <p className="text-xs text-dim">{t('orBrowse')}</p>
          <Button size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            <Paperclip className="h-4 w-4" /> {t('chooseFiles')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          {uploading.length > 0 && (
            <ul className="mt-2 w-full max-w-md text-left text-xs text-muted">
              {uploading.map((u) => (
                <li key={u.name} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{u.name}</span>
                  <span>{u.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Can>

      {isLoading ? (
        <LoadingState label={t('loading')} />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-dim">{t('empty')}</p>
      ) : (
        <ul className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {data.map((a) => (
            <li key={a.id} className="card-surface flex items-start gap-sm p-md">
              <button
                type="button"
                onClick={() => openPreview(a)}
                className="flex min-w-0 flex-1 items-start gap-sm text-left"
                title={canPreview(a.contentType) ? t('preview') : a.fileName}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-panel-2 text-muted">
                  {isImage(a.contentType) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium hover:text-primary" title={a.fileName}>{a.fileName}</span>
                  <span className="block text-xs text-dim">{fmtSize(a.fileSize)} · {userName(a.uploadedById)}</span>
                  {a.createdAt && (
                    <span className="block text-xs text-dim">{formatDateTime(a.createdAt, { locale, timeZone })}</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => downloadOne(a)}
                className="shrink-0 rounded p-1.5 text-muted hover:bg-panel-2 hover:text-text"
                aria-label={t('download')}
                title={t('download')}
              >
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de preview (imagem / PDF) */}
      {preview && (
        <Portal>
          <div className="fixed inset-0 z-[120] flex flex-col bg-black/70 backdrop-blur-sm" onClick={closePreview}>
            <div className="flex items-center gap-sm border-b border-white/10 px-md py-2 text-sm text-white">
              <span className="flex-1 truncate">{preview.att.fileName}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); downloadOne(preview.att); }} className="rounded p-1.5 hover:bg-white/10" title={t('download')}>
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={closePreview} className="rounded p-1.5 hover:bg-white/10" aria-label={t('close')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-md" onClick={(e) => e.stopPropagation()}>
              {isImage(preview.att.contentType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.att.fileName} className="max-h-full max-w-full rounded object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.att.fileName} className="h-full w-full rounded bg-white" />
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
