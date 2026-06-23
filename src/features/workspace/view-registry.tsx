'use client';

import { useTranslations } from 'next-intl';
import type { TabLocation } from '@/features/workspace/tab-store';
import { TicketsCentral } from '@/features/tickets/tickets-central';
import { TicketDetail } from '@/features/tickets/ticket-detail';
import { UsersView } from '@/features/admin/users-view';
import { ProfileGroupsView } from '@/features/admin/profile-groups-view';
import { AuditLogsView } from '@/features/admin/audit-logs-view';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { InvestigationsView } from '@/features/investigations/investigations-view';
import { KnowledgeView } from '@/features/knowledge/knowledge-view';
import { AnalyticsView } from '@/features/analytics/analytics-view';
import { IterationsView } from '@/features/iterations/iterations-view';
import { TagsView } from '@/features/tags/tags-view';
import { IntelligenceDashboard } from '@/features/intelligence/intelligence-dashboard';
import { EmptyState } from '@/shared/ui/states';
import { PageTransition } from '@/shared/ui/page-transition';
import { ICONS } from './icons';

function wrap(el: React.ReactElement) {
  return <PageTransition key={el.key ?? el.type?.toString()}>{el}</PageTransition>;
}

/** Resolve a localização de uma aba para o componente de view correspondente. */
export function renderView(loc: TabLocation) {
  switch (loc.kind) {
    case 'tickets':
      return wrap(<TicketsCentral />);
    case 'ticket':
      return wrap(<TicketDetail id={Number(loc.params.id)} />);
    case 'dashboard':
      return wrap(<DashboardView />);
    case 'users':
      return wrap(<UsersView />);
    case 'admin':
      return wrap(<ProfileGroupsView />);
    case 'audit':
      return wrap(<AuditLogsView />);
    case 'investigations':
      return wrap(<InvestigationsView />);
    case 'knowledge':
    case 'knowledge-article':
      return wrap(<KnowledgeView />);
    case 'analytics':
      return wrap(<AnalyticsView />);
    case 'intelligence':
      return wrap(<IntelligenceDashboard />);
    case 'iterations':
      return wrap(<IterationsView />);
    case 'tags':
      return wrap(<TagsView />);
    default:
      return wrap(
        <div className="grid h-full place-items-center">
          <ComingSoonPlaceholder loc={loc} />
        </div>
      );
  }
}

function ComingSoonPlaceholder({ loc }: { loc: TabLocation }) {
  const t = useTranslations('common');
  return (
    <EmptyState
      icon={ICONS[loc.icon]}
      message={t('comingSoon')}
    />
  );
}
