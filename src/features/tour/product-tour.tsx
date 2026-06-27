'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check, X, Sparkles } from 'lucide-react';
import { useTourStore, tourCompleted } from './tour-store';
import { cn } from '@/shared/lib/utils';

/** Um passo do tour. `target` é um seletor CSS; ausente = card centralizado. */
interface TourStep {
  key: string;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Passos do walkthrough. Os textos vêm do namespace i18n `tour` (todas as línguas).
 * Passos cujo alvo não existe na tela atual são pulados automaticamente.
 */
const STEPS: TourStep[] = [
  { key: 'welcome', placement: 'center' },
  { key: 'nav', target: '[data-tour="nav"]', placement: 'right' },
  { key: 'search', target: '[data-tour="search"]', placement: 'bottom' },
  { key: 'notifications', target: '[data-tour="notifications"]', placement: 'bottom' },
  { key: 'language', target: '[data-tour="language"]', placement: 'bottom' },
  { key: 'user', target: '[data-tour="user"]', placement: 'bottom' },
  { key: 'done', placement: 'center' },
];

const PAD = 8;
const CARD_W = 340;

function rectOf(selector?: string): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

/** Encontra o índice do próximo passo cujo alvo existe (ou sem alvo). */
function resolveStep(from: number, dir: 1 | -1): number {
  let i = from;
  while (i >= 0 && i < STEPS.length) {
    const s = STEPS[i];
    if (!s.target || rectOf(s.target)) return i;
    i += dir;
  }
  return -1;
}

export function ProductTour() {
  const t = useTranslations('tour');
  const active = useTourStore((s) => s.active);
  const step = useTourStore((s) => s.step);
  const setStep = useTourStore((s) => s.setStep);
  const start = useTourStore((s) => s.start);
  const stop = useTourStore((s) => s.stop);

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Auto-início no primeiro acesso (após o shell montar os elementos).
  useEffect(() => {
    if (tourCompleted()) return;
    const id = setTimeout(() => start(), 700);
    return () => clearTimeout(id);
  }, [start]);

  const current = STEPS[step];

  const recompute = useCallback(() => {
    setRect(current?.target ? rectOf(current.target) : null);
  }, [current]);

  useLayoutEffect(() => {
    if (!active) return;
    // Garante que estamos num passo válido (alvo presente).
    if (current?.target && !rectOf(current.target)) {
      const next = resolveStep(step + 1, 1);
      if (next === -1) { stop(); return; }
      setStep(next);
      return;
    }
    recompute();
  }, [active, step, current, recompute, setStep, stop]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => recompute();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [active, recompute]);

  // Navegação por teclado.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  if (!mounted || !active || !current) return null;

  const visibleIndexes = STEPS.map((s, i) => i).filter((i) => !STEPS[i].target || rectOf(STEPS[i].target));
  const positionInVisible = visibleIndexes.indexOf(step);
  const isLast = positionInVisible === visibleIndexes.length - 1;
  const isFirst = positionInVisible <= 0;

  function goNext() {
    const next = resolveStep(step + 1, 1);
    if (next === -1) stop();
    else setStep(next);
  }
  function goPrev() {
    const prev = resolveStep(step - 1, -1);
    if (prev !== -1) setStep(prev);
  }

  // Posição do card (apenas quando há alvo; centralizado usa flex).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties | undefined;
  if (rect) {
    const below = rect.bottom + 12;
    const placeBelow = below + 180 < vh;
    const top = placeBelow ? below : Math.max(12, rect.top - 12 - 180);
    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.max(12, Math.min(left, vw - CARD_W - 12));
    cardStyle = { left, top, width: CARD_W };
  }

  const cardBody = (
    <>
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" /> {t('badge')}
          </span>
          <button
            type="button"
            onClick={() => stop()}
            className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-text"
            aria-label={t('skip')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-text">{t(`${current.key}.title`)}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`${current.key}.body`)}</p>

        {/* Progresso */}
        <div className="mt-4 flex items-center gap-1.5">
          {visibleIndexes.map((idx, i) => (
            <span
              key={idx}
              className={cn('h-1.5 rounded-full transition-all', i === positionInVisible ? 'w-5 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => stop()}
            className="text-xs font-medium text-dim hover:text-text"
          >
            {t('skip')}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={goPrev}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-panel px-3 text-sm font-medium text-text hover:bg-panel-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t('back')}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium"
            >
              {isLast ? (<><Check className="h-4 w-4" /> {t('finish')}</>) : (<>{t('next')} <ArrowRight className="h-3.5 w-3.5" /></>)}
            </button>
          </div>
        </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true" aria-label={t('aria')}>
      {/* Spotlight: recorte via box-shadow quando há alvo, senão backdrop simples */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.66)',
            outline: '2px solid var(--orbit-color-primary)',
            outlineOffset: '2px',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(2,6,23,0.66)]" />
      )}

      {/* Camada clicável para fechar ao clicar fora */}
      <button type="button" className="absolute inset-0 cursor-default" aria-hidden tabIndex={-1} onClick={() => stop()} />

      {rect ? (
        <div
          className="absolute z-10 w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-rise"
          style={cardStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {cardBody}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div
            className="pointer-events-auto w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            {cardBody}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
