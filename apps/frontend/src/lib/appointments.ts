import { useQuery } from '@tanstack/react-query';
import type { BookingOptionsDto } from '@vp/types';

import { BOOKING_OPTIONS } from '../hooks/useMe';
import { useAuthStore } from '../stores/authStore';

import api from './api';
import { formatDuration, formatEuros } from './settings-format';

export type { BookingOptionsDto };
export type BookingFormula = BookingOptionsDto['formulas'][number];

/**
 * What an appointment of this patient can be booked with: the types (her formulas, with their
 * duration) and practices of the patient's practitioner. A practitioner gets hers before a
 * patient is chosen; an assistant once the patient is chosen.
 */
export function useBookingOptions(patientId: string | undefined, open: boolean) {
  const user = useAuthStore((s) => s.user);
  const isPractitioner = user?.role === 'PRATICIENNE';
  const key = patientId ?? (isPractitioner ? 'mine' : null);
  return useQuery<BookingOptionsDto>({
    queryKey: [...BOOKING_OPTIONS, user?.id, key],
    queryFn: async () =>
      (
        await api.get<BookingOptionsDto>('/appointments/options', {
          params: patientId ? { patientId } : {},
        })
      ).data,
    enabled: open && key !== null,
    gcTime: patientId ? 0 : 60_000,
    staleTime: patientId ? 0 : 60_000,
  });
}

/** « Bilan · 60 € · 1 h »: a type of appointment as offered when booking. */
export function formulaOption(formula: BookingFormula): string {
  return [
    formula.label,
    formula.priceCents !== null ? formatEuros(formula.priceCents) : null,
    formatDuration(formula.durationMinutes),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * What an appointment is, on the agenda and the dashboard: its type (« Suivi »), and its
 * practice when there are several (`withPractice`). Null when neither is known.
 */
export function appointmentSummary(
  appt: { formula?: { label: string } | null; practice?: { name: string } | null },
  withPractice: boolean,
): string | null {
  const parts = [appt.formula?.label ?? null, withPractice ? (appt.practice?.name ?? null) : null];
  const summary = parts.filter(Boolean).join(' · ');
  return summary || null;
}
