'use client';

import { AnalyticsView } from '@/features/analytics/analytics-view';

/** Analytics dashboard page. */
export default function AnalyticsPage() {
  return (
    <div className="h-full overflow-auto">
      <AnalyticsView />
    </div>
  );
}
