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
import { EmptyState } from '@/shared/ui/states';
import { ICONS } from './icons';

/** Resolve a localização de uma aba para o componente de view correspondente. */
export function renderView(loc: TabLocation) {
  switch (loc.kind) {
    case 'tickets':
      return <TicketsCentral />;
    case 'ticket':
      return <TicketDetail id={Number(loc.params.id)} />;
    case 'dashboard':
      return <DashboardView />;
    case 'users':
      return <UsersView />;
    case 'admin':
      return <ProfileGroupsView />;
    case 'audit':
      return <AuditLogsView />;
    case 'investigations':
      return <InvestigationsView />;
    case 'knowledge':
    case 'knowledge-article':
      return <KnowledgeView />;
    case 'analytics':
      return <AnalyticsView />;
    case 'iterations':
      return <IterationsView />;
    case 'tags':
      return <TagsView />;
    default:
      return (
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
