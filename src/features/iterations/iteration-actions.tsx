'use client';

import { Target, Plus } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import type { IterationResponse } from '@/shared/api/types';
import { IterationForm } from './iteration-form';

export interface IterationPreFill {
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export function openIterationWindow(iteration?: IterationResponse, preFill?: IterationPreFill) {
  const id = iteration ? `iteration-${iteration.id}` : 'iteration-new';
  const iterationData = preFill
    ? ({ ...({ id: 0, name: preFill.name ?? '', goal: preFill.goal ?? '', startDate: preFill.startDate ?? null, endDate: preFill.endDate ?? null, status: 'Planning', ticketCount: 0 } as IterationResponse) })
    : iteration;
  useWindowStore.getState().open({
    id,
    title: iteration ? iteration.name : 'Nova Iteração',
    icon: iteration ? <Target className="h-4 w-4" /> : <Plus className="h-4 w-4" />,
    modal: true,
    width: 600,
    height: 560,
    content: <IterationForm windowId={id} iteration={preFill ? iterationData : iteration} />,
  });
}
