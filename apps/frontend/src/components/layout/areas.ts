import {
  CalendarDays,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';

/**
 * One colour per area of the app (docs/DESIGN.md § 1.3), reused by the sidebar, PageHeader and
 * Section so the user always knows where they are. Class names are spelled out in full so
 * Tailwind can find them.
 */
export type Area = 'home' | 'patients' | 'agenda' | 'invoices' | 'settings' | 'users' | 'audit';

interface AreaStyle {
  icon: LucideIcon;
  /** Strong colour: icons and text (AA on the card and on the soft colour) */
  text: string;
  /** Soft colour: icon chips and the active sidebar item */
  soft: string;
  /** Solid colour: the active item marker */
  solid: string;
}

export const AREAS: Record<Area, AreaStyle> = {
  home: {
    icon: LayoutDashboard,
    text: 'text-area-home',
    soft: 'bg-area-home-soft',
    solid: 'bg-area-home',
  },
  patients: {
    icon: Users,
    text: 'text-area-patients',
    soft: 'bg-area-patients-soft',
    solid: 'bg-area-patients',
  },
  agenda: {
    icon: CalendarDays,
    text: 'text-area-agenda',
    soft: 'bg-area-agenda-soft',
    solid: 'bg-area-agenda',
  },
  invoices: {
    icon: Receipt,
    text: 'text-area-invoices',
    soft: 'bg-area-invoices-soft',
    solid: 'bg-area-invoices',
  },
  settings: {
    icon: Settings,
    text: 'text-area-settings',
    soft: 'bg-area-settings-soft',
    solid: 'bg-area-settings',
  },
  users: {
    icon: UserCog,
    text: 'text-area-users',
    soft: 'bg-area-users-soft',
    solid: 'bg-area-users',
  },
  audit: {
    icon: ScrollText,
    text: 'text-area-audit',
    soft: 'bg-area-audit-soft',
    solid: 'bg-area-audit',
  },
};
