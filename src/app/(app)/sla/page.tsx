'use client';

import { SlaPoliciesView } from '@/features/admin/sla-policies-view';

export default function SlaPage() {
  return (
    <div className="h-full overflow-auto">
      <SlaPoliciesView />
    </div>
  );
}
