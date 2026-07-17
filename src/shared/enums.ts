'use client';

import { useTranslations } from 'next-intl';
import {
  Priority, TicketStatus, RootCauseCategory, EvidenceType, HypothesisStatus,
  PlaybookStatus, ProblemStatus, GoalMetric, PlaybookStepKindEnum,
} from '@/shared/api/types';

/**
 * FONTE ÚNICA de todos os enums do sistema no front: liga cada valor do enum ao seu rótulo
 * traduzido (via i18n) numa ordem canônica. Telas consomem daqui (useEnumOptions/useEnumLabel)
 * em vez de reconstruir `Object.keys(...).map(t(...))` cada uma — layout e traduções consistentes.
 */

// WorklogType não tem const em types.ts (a resposta vem como string) — definido aqui,
// alinhado ao enum do backend (Orbit.Domain.Enums.WorklogType): 7 valores.
export const WorklogType = {
  Investigation: 1, Meeting: 2, Development: 3, Validation: 4, CustomerSupport: 5, Documentation: 6, Other: 7,
} as const;

// Rótulos do worklog vivem em camelCase no i18n (worklogType.customerSupport, ...).
const WORKLOG_TYPE_I18N: Record<string, string> = {
  Investigation: 'worklogType.investigation',
  Meeting: 'worklogType.meeting',
  Development: 'worklogType.development',
  Validation: 'worklogType.validation',
  CustomerSupport: 'worklogType.customerSupport',
  Documentation: 'worklogType.documentation',
  Other: 'worklogType.other',
};

export interface EnumOption {
  /** Valor numérico (o que o back espera em requests). */
  value: number;
  /** Nome/chave do enum (o que o back devolve em responses, ex.: "InProgress"). */
  name: string;
  /** Caminho completo da chave i18n do rótulo. */
  i18nKey: string;
}

function build(obj: Record<string, number>, ns: string): EnumOption[] {
  return Object.entries(obj).map(([name, value]) => ({ value, name, i18nKey: `${ns}.${name}` }));
}

/** Registro de todos os enums → opções ordenadas com chave i18n. */
export const ENUM_DEFS = {
  priority: build(Priority, 'priority'),
  ticketStatus: build(TicketStatus, 'ticketStatus'),
  rootCauseCategory: build(RootCauseCategory, 'investigation.cat'),
  worklogType: Object.entries(WorklogType).map(([name, value]) => ({ value, name, i18nKey: WORKLOG_TYPE_I18N[name] })),
  goalMetric: build(GoalMetric, 'performance.metric'),
  evidenceType: build(EvidenceType, 'investigation.eType'),
  hypothesisStatus: build(HypothesisStatus, 'investigation.hStatus'),
  playbookStatus: build(PlaybookStatus, 'playbookStatus'),
  problemStatus: build(ProblemStatus, 'problemStatus'),
  playbookStepKind: build(PlaybookStepKindEnum, 'playbookStepKind'),
} as const;

export type EnumKey = keyof typeof ENUM_DEFS;

/** Opções traduzidas de um enum, prontas para `Select`/filtros. */
export function useEnumOptions(key: EnumKey): { value: number; name: string; label: string }[] {
  const t = useTranslations();
  return ENUM_DEFS[key].map((o) => ({
    value: o.value,
    name: o.name,
    label: t(o.i18nKey as Parameters<typeof t>[0]),
  }));
}

/** Resolvedor de rótulo por valor numérico OU nome (string do response). */
export function useEnumLabel(): (key: EnumKey, valueOrName: number | string) => string {
  const t = useTranslations();
  return (key, valueOrName) => {
    const def = ENUM_DEFS[key].find((o) => o.value === valueOrName || o.name === valueOrName);
    return def ? t(def.i18nKey as Parameters<typeof t>[0]) : String(valueOrName);
  };
}
