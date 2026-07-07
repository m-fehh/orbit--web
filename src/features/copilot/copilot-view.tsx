'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sparkles, CheckCircle2, GitBranch, Zap, Star, Send, Loader2, User, BookOpen, ArrowUpRight,
} from 'lucide-react';
import { intelligenceApi } from '@/shared/api/endpoints';
import {
  apiErrorMessage,
  type PlaybookConfidence, type PlaybookStepKind, type PlaybookStepView, type PlaybookSuggestion,
  type ResolutionSuggestion, type CopilotGuide,
} from '@/shared/api/types';
import { openTicketTab } from '@/features/tickets/ticket-actions';
import { ProgressBar, healthColor, healthTextClass, formatPct } from '@/shared/ui/charts';
import { cn } from '@/shared/lib/utils';

const CONFIDENCE_STYLE: Record<PlaybookConfidence, string> = {
  High: 'bg-success/15 text-success',
  Medium: 'bg-warning/15 text-warning',
  Low: 'bg-panel-2 text-dim',
};

function StepKindIcon({ kind, className }: { kind: PlaybookStepKind; className?: string }) {
  if (kind === 'Check') return <CheckCircle2 className={className} />;
  if (kind === 'Decision') return <GitBranch className={className} />;
  return <Zap className={className} />;
}

/** Card de uma solução sugerida (reaproveita o visual da Base de Soluções). */
export function SuggestionCard({
  suggestion,
  highlight = false,
}: {
  suggestion: PlaybookSuggestion;
  highlight?: boolean;
}) {
  const t = useTranslations('copilot');
  const previewSteps = suggestion.steps.slice().sort((a, b) => a.order - b.order).slice(0, 4);

  return (
    <div
      className={cn(
        'card-surface flex flex-col gap-3 p-4 transition-colors',
        highlight ? 'border-primary/40 ring-1 ring-primary/20' : 'hover:border-primary/30',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {highlight && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Star className="h-2.5 w-2.5" /> {t('bestAnswer')}
              </span>
            )}
            <p className="text-sm font-semibold text-text">{suggestion.title}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', CONFIDENCE_STYLE[suggestion.confidence])}>
              {t(`confidence.${suggestion.confidence}` as 'confidence.High')}
            </span>
          </div>
          {suggestion.summary && <p className="mt-1 text-xs text-muted line-clamp-2">{suggestion.summary}</p>}
        </div>
      </div>

      {suggestion.matchedSymptoms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.matchedSymptoms.slice(0, 5).map((s) => (
            <span key={s} className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{s}</span>
          ))}
          {suggestion.matchedSymptoms.length > 5 && (
            <span className="text-[10px] text-dim">+{suggestion.matchedSymptoms.length - 5}</span>
          )}
        </div>
      )}

      {previewSteps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {previewSteps.map((s: PlaybookStepView) => (
            <li key={s.order} className="flex items-center gap-2 text-xs text-muted">
              <StepKindIcon kind={s.kind} className="h-3.5 w-3.5 shrink-0 text-dim" />
              <span className="min-w-0 flex-1 truncate">{s.instruction}</span>
            </li>
          ))}
          {suggestion.steps.length > previewSteps.length && (
            <li className="text-[10px] text-dim">+{suggestion.steps.length - previewSteps.length} {t('steps').toLowerCase()}</li>
          )}
        </ul>
      )}

      {suggestion.resolutionTemplate && highlight && (
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs text-muted">
          {suggestion.resolutionTemplate}
        </pre>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle/40 p-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-dim">{t('successRate')}</span>
          <ProgressBar value={suggestion.successRate} color={healthColor(suggestion.successRate)} className="flex-1" />
          <span className={cn('w-10 text-right text-xs font-semibold tabular-nums', healthTextClass(suggestion.successRate))}>
            {formatPct(suggestion.successRate)}
          </span>
        </div>
        <span className="text-[11px] text-muted">{t('appliedTimes', { count: suggestion.appliedCount })}</span>
      </div>
    </div>
  );
}

/** Card de uma resolução recuperada de um ticket já resolvido — navegável para o ticket. */
function ResolutionCard({ r }: { r: ResolutionSuggestion }) {
  const t = useTranslations('copilot');
  const code = r.ticketNumber && r.ticketNumber.length > 0 ? r.ticketNumber : `#${r.ticketId}`;
  return (
    <div className="card-surface flex flex-col gap-1.5 p-3.5">
      <p className="text-sm text-text">{r.summary}</p>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-dim">
        <button
          type="button"
          onClick={() => openTicketTab({ id: r.ticketId, number: r.ticketNumber ?? String(r.ticketId) })}
          className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
          title={t('openTicket')}
        >
          {t('sourceTicket')} {code} <ArrowUpRight className="h-3 w-3" />
        </button>
        {r.reusedCount > 0 && (
          <span className="flex items-center gap-1">
            {t('reuseCount', { count: r.reusedCount })} ·
            <span className={cn('font-semibold', healthTextClass(r.successRate))}>{formatPct(r.successRate)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Card de um guia do próprio Orbit (autoconhecimento) que embasou a resposta. */
function GuideCard({ g }: { g: CopilotGuide }) {
  return (
    <div className="card-surface flex items-start gap-2.5 p-3.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <BookOpen className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{g.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{g.content}</p>
      </div>
    </div>
  );
}

const EXAMPLE_KEYS = ['ex1', 'ex2', 'ex3', 'ex4'] as const;

/** Uma mensagem na conversa (usuário ou assistente). */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Texto da mensagem (pergunta do usuário, ou `answer`/mensagem do assistente). */
  text: string;
  /** Soluções comprovadas (playbooks) anexas à resposta do assistente. */
  solutions?: PlaybookSuggestion[];
  /** Resoluções de tickets resolvidos anexas à resposta. */
  resolutions?: ResolutionSuggestion[];
  /** Guias do próprio Orbit (autoconhecimento) anexos à resposta. */
  guides?: CopilotGuide[];
  /** Marca uma resposta que falhou (erro de rede/API). */
  isError?: boolean;
}

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

export function CopilotView() {
  const t = useTranslations('copilot');
  const tc = useTranslations('common');

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Mantém o scroll no fim a cada nova mensagem / mudança de estado.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;

    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: q }]);
    setPending(true);

    try {
      const res = await intelligenceApi.ask(q);
      const hasAnswer = !!res.answer?.trim();
      const solutions = res.solutions ?? [];
      const resolutions = res.resolutions ?? [];
      const guides = res.guides ?? [];
      const hasSources = solutions.length > 0 || resolutions.length > 0 || guides.length > 0;
      const text = hasAnswer
        ? res.answer.trim()
        : hasSources
          ? t('sourcesLead')
          : t('emptyAnswer');
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text, solutions, resolutions, guides },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: apiErrorMessage(err, tc('errorBody')),
          isError: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
      </div>

      {/* Histórico da conversa */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6" aria-live="polite">
        {isEmpty ? (
          /* Estado inicial: saudação + exemplos clicáveis */
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-text">{t('greetingTitle')}</p>
              <p className="mt-1 text-sm text-muted">{t('greetingBody')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_KEYS.map((k) => {
                const ex = t(`examples.${k}` as 'examples.ex1');
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void send(ex)}
                    className="rounded-full border border-border bg-bg-subtle px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary/40 hover:text-text"
                  >
                    {ex}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex items-start justify-end gap-2">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-fg shadow-sm">
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-2 text-muted">
                    <User className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 max-w-[85%] flex-col gap-3">
                    <div
                      className={cn(
                        'rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm shadow-sm',
                        m.isError
                          ? 'bg-danger/10 text-danger'
                          : 'bg-bg-subtle text-text',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                    {m.solutions && m.solutions.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                          {t('sources')}
                        </p>
                        {m.solutions.map((s, i) => (
                          <SuggestionCard key={s.playbookId} suggestion={s} highlight={i === 0 && !m.text} />
                        ))}
                      </div>
                    )}
                    {m.resolutions && m.resolutions.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                          {t('fromResolved')}
                        </p>
                        {m.resolutions.map((r) => (
                          <ResolutionCard key={r.resolutionId} r={r} />
                        ))}
                      </div>
                    )}
                    {m.guides && m.guides.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
                          {t('fromGuides')}
                        </p>
                        {m.guides.map((g) => (
                          <GuideCard key={g.screen} g={g} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {pending && (
              <div className="flex items-start gap-2">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-bg-subtle px-4 py-2.5 text-sm text-muted shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('consulting')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input fixo embaixo */}
      <div className="border-t border-border bg-bg px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            data-tour="copilot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('inputPlaceholder')}
            rows={1}
            aria-label={t('inputPlaceholder')}
            autoFocus
            className="max-h-40 min-h-[46px] flex-1 resize-none rounded-xl border border-border bg-bg-subtle px-4 py-3 text-sm text-text outline-none placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={pending || input.trim().length === 0}
            aria-label={t('send')}
            className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-primary text-primary-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
