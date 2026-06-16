import {
  Ticket,
  LayoutGrid,
  LayoutDashboard,
  Users,
  BookOpen,
  Search,
  BarChart3,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { IconKey } from '@/features/workspace/tab-store';

export const ICONS: Record<IconKey, LucideIcon> = {
  ticket: Ticket,
  tickets: LayoutGrid,
  dashboard: LayoutDashboard,
  users: Users,
  knowledge: BookOpen,
  search: Search,
  analytics: BarChart3,
  admin: ShieldCheck,
  audit: ScrollText,
};

export function Icon({ name, className }: { name: IconKey; className?: string }) {
  const C = ICONS[name] ?? Ticket;
  return <C className={className} aria-hidden />;
}
