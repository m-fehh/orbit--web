'use client';

import { SymptomsCatalogView } from '@/features/admin/symptoms-catalog-view';

export default function SymptomsPage() {
  return (
    <div className="h-full overflow-auto">
      <SymptomsCatalogView />
    </div>
  );
}
