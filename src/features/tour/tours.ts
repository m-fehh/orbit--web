import type { TourStep } from './tour-store';
import type { ViewKind } from '@/features/workspace/tab-store';

/**
 * Tour global do app (chrome): navegação, busca, notificações, idioma, usuário.
 * Auto-inicia no primeiro acesso e é reinvocável pelo menu do usuário.
 */
export const APP_TOUR: TourStep[] = [
  { key: 'welcome' },
  { key: 'nav', target: '[data-tour="nav"]' },
  { key: 'search', target: '[data-tour="search"]' },
  { key: 'notifications', target: '[data-tour="notifications"]' },
  { key: 'language', target: '[data-tour="language"]' },
  { key: 'user', target: '[data-tour="user"]' },
  { key: 'done' },
];

/**
 * Tours por tela. As chaves de passo mapeiam para i18n `tour.<key>.title|body`. Passos com
 * `target` destacam o elemento (data-tour); sem target = card centralizado (contexto). Passos
 * cujo alvo não existe na tela são pulados automaticamente pelo engine.
 */
const SCREEN_TOURS: Partial<Record<ViewKind, TourStep[]>> = {
  tickets: [
    { key: 'sc.tickets.intro' },
    { key: 'sc.tickets.new', target: '[data-tour="new-ticket"]' },
    { key: 'sc.tickets.filters' },
    { key: 'sc.tickets.list' },
  ],
  ticket: [
    { key: 'sc.ticket.intro' },
    { key: 'sc.ticket.tabs', target: '[data-tour="ticket-tabs"]' },
    { key: 'sc.ticket.assistant' },
    { key: 'sc.ticket.resolve' },
  ],
  dashboard: [{ key: 'sc.dashboard.intro' }, { key: 'sc.dashboard.metrics' }],
  analytics: [{ key: 'sc.analytics.intro' }, { key: 'sc.analytics.trends' }],
  intelligence: [
    { key: 'sc.intelligence.intro' },
    { key: 'sc.intelligence.aihealth', target: '[data-tour="ai-health"]' },
  ],
  playbooks: [
    { key: 'sc.playbooks.intro' },
    { key: 'sc.playbooks.review' },
    { key: 'sc.playbooks.publish' },
  ],
  problems: [
    { key: 'sc.problems.intro' },
    { key: 'sc.problems.anomalies', target: '[data-tour="anomalies"]' },
    { key: 'sc.problems.escalate' },
  ],
  reliability: [{ key: 'sc.reliability.intro' }],
  copilot: [
    { key: 'sc.copilot.intro' },
    { key: 'sc.copilot.input', target: '[data-tour="copilot-input"]' },
    { key: 'sc.copilot.sources' },
  ],
  sla: [
    { key: 'sc.sla.intro' },
    { key: 'sc.sla.targets', target: '[data-tour="sla-targets"]' },
    { key: 'sc.sla.hours' },
  ],
  users: [{ key: 'sc.users.intro' }, { key: 'sc.users.create' }],
  admin: [{ key: 'sc.admin.intro' }, { key: 'sc.admin.permissions' }],
  audit: [{ key: 'sc.audit.intro' }],
  iterations: [{ key: 'sc.iterations.intro' }],
  tags: [{ key: 'sc.tags.intro' }],
  settings: [{ key: 'sc.settings.intro' }],
  investigations: [{ key: 'sc.investigations.intro' }],
};

/** Passos do tour da tela — cai num intro genérico se a tela ainda não tem tour dedicado. */
export function tourFor(kind: ViewKind): TourStep[] {
  return SCREEN_TOURS[kind] ?? [{ key: 'sc.generic.intro' }];
}
