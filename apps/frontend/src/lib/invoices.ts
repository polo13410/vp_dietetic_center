/** Invoices and credit notes: labels, periods, data hooks and downloads (docs/REFONTE.md lot 5). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  InvoiceDto,
  InvoiceListDto,
  InvoiceMismatch,
  PatientInvoicesDto,
  SessionInvoicesDto,
  SessionToInvoiceDto,
} from '@vp/types';

import type { BadgeTone } from '../components/shared/StatusBadge';

import api from './api';
import { saveFile } from './download';

export type { InvoiceDto, InvoiceListDto, InvoiceMismatch, PatientInvoicesDto, SessionInvoicesDto, SessionToInvoiceDto };

/** "2026-0012" for an invoice, "A-2026-0001" for a credit note */
export const isCreditNote = (invoice: Pick<InvoiceDto, 'type'>) => invoice.type === 'CREDIT_NOTE';

/** Invoices in force: the only ones counted in totals. */
export const countsInTotals = (invoice: Pick<InvoiceDto, 'type' | 'cancelledAt'>) =>
  !isCreditNote(invoice) && invoice.cancelledAt === null;

/** The status pill of an invoice or credit note. */
export function invoiceStatus(invoice: Pick<InvoiceDto, 'type' | 'cancelledAt' | 'paymentMethod'>): {
  label: string;
  tone: BadgeTone;
} {
  if (isCreditNote(invoice)) return { label: 'Avoir', tone: 'neutral' };
  if (invoice.cancelledAt) return { label: 'Annulée', tone: 'danger' };
  return invoice.paymentMethod === 'NONE'
    ? { label: 'Non réglée', tone: 'warning' }
    : { label: 'Acquittée', tone: 'success' };
}

/** « la facture n° 2026-0012 », « l’avoir n° A-2026-0001 » */
export function documentName(invoice: Pick<InvoiceDto, 'type' | 'number'>): string {
  return isCreditNote(invoice) ? `l’avoir n° ${invoice.number}` : `la facture n° ${invoice.number}`;
}

const MISMATCH_LABELS: Record<InvoiceMismatch, string> = {
  formula: 'la formule',
  price: 'le prix',
  paymentMethod: 'le moyen de paiement',
  date: 'la date',
};

/** « le prix et le moyen de paiement » */
export function mismatchText(mismatches: InvoiceMismatch[]): string {
  const labels = mismatches.map((m) => MISMATCH_LABELS[m]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

/** What the links of a cancelled invoice or a credit note say (« annulée par l’avoir n° … »). */
export function linksText(invoice: InvoiceDto): string[] {
  const lines: string[] = [];
  if (invoice.cancels) lines.push(`Annule la ${invoice.cancels.number}`);
  if (invoice.replaces) lines.push(`Remplace la ${invoice.replaces.number}`);
  if (invoice.creditNote) lines.push(`Annulée par l’avoir ${invoice.creditNote.number}`);
  if (invoice.replacedBy) lines.push(`Remplacée par la ${invoice.replacedBy.number}`);
  if (invoice.cancelReason) lines.push(`Motif : ${invoice.cancelReason}`);
  return lines;
}

// ─── Periods ──────────────────────────────────────────────────────────────────

export type PeriodKind = 'month' | 'quarter' | 'year';

export interface Period {
  kind: PeriodKind;
  year: number;
  /** month: 0–11; quarter: 0–3; year: 0 */
  index: number;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const QUARTERS = ['1er trimestre', '2e trimestre', '3e trimestre', '4e trimestre'];

export function currentPeriod(kind: PeriodKind, now = new Date()): Period {
  const month = now.getMonth();
  return {
    kind,
    year: now.getFullYear(),
    index: kind === 'month' ? month : kind === 'quarter' ? Math.floor(month / 3) : 0,
  };
}

export function shiftPeriod(period: Period, by: number): Period {
  if (period.kind === 'year') return { ...period, year: period.year + by };
  const size = period.kind === 'month' ? 12 : 4;
  const total = period.year * size + period.index + by;
  return { ...period, year: Math.floor(total / size), index: ((total % size) + size) % size };
}

/** First and last day of the period, as the API takes them ("2026-11-01", "2026-11-30"). */
export function periodRange(period: Period): { from: string; to: string } {
  const [firstMonth, months] =
    period.kind === 'month' ? [period.index, 1] : period.kind === 'quarter' ? [period.index * 3, 3] : [0, 12];
  const lastDay = new Date(Date.UTC(period.year, firstMonth + months, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${period.year}-${pad(firstMonth + 1)}-01`,
    to: `${period.year}-${pad(firstMonth + months)}-${pad(lastDay)}`,
  };
}

/** « novembre 2026 », « 4e trimestre 2026 », « 2026 » */
export function periodLabel(period: Period): string {
  if (period.kind === 'month') return `${MONTHS[period.index]} ${period.year}`;
  if (period.kind === 'quarter') return `${QUARTERS[period.index]} ${period.year}`;
  return String(period.year);
}

/** « novembre 2026 » for "2026-11" */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return `${MONTHS[index - 1]} ${year}`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INVOICES = ['invoices'] as const;

export function useSessionInvoices(consultationId: string | undefined) {
  return useQuery({
    queryKey: [...INVOICES, 'session', consultationId],
    queryFn: async () => (await api.get<SessionInvoicesDto>(`/consultations/${consultationId}/invoices`)).data,
    enabled: !!consultationId,
  });
}

export function usePatientInvoices(patientId: string | undefined) {
  return useQuery({
    queryKey: [...INVOICES, 'patient', patientId],
    queryFn: async () => (await api.get<PatientInvoicesDto>(`/patients/${patientId}/invoices`)).data,
    enabled: !!patientId,
  });
}

export function useInvoiceList(range: { from: string; to: string }) {
  return useQuery({
    queryKey: [...INVOICES, 'list', range.from, range.to],
    queryFn: async () => (await api.get<InvoiceListDto>('/invoices', { params: range })).data,
  });
}

/** Sessions with no invoice in force, latest first (the dashboard's « Factures à faire »). */
export function useSessionsToInvoice(enabled = true) {
  return useQuery({
    queryKey: [...INVOICES, 'to-issue'],
    queryFn: async () => (await api.get<SessionToInvoiceDto[]>('/invoices/to-issue')).data,
    enabled,
  });
}

function useInvoiceMutation<T>(mutationFn: (arg: T) => Promise<InvoiceDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVOICES });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** « Faire la facture » */
export const useIssueInvoice = () =>
  useInvoiceMutation(async (consultationId: string) =>
    (await api.post<InvoiceDto>(`/consultations/${consultationId}/invoice`)).data,
  );

/** « Corriger la facture »: returns the new invoice */
export const useCorrectInvoice = () =>
  useInvoiceMutation(async (invoiceId: string) => (await api.post<InvoiceDto>(`/invoices/${invoiceId}/correct`)).data);

/** « Annuler la facture »: returns the credit note */
export const useCancelInvoice = () =>
  useInvoiceMutation(async ({ id, reason }: { id: string; reason?: string }) =>
    (await api.post<InvoiceDto>(`/invoices/${id}/cancel`, { reason: reason?.trim() || undefined })).data,
  );

// ─── Downloads ────────────────────────────────────────────────────────────────

/** « facture-2026-0012.pdf », « avoir-A-2026-0001.pdf » */
export function invoiceFilename(invoice: Pick<InvoiceDto, 'type' | 'number'>): string {
  return `${isCreditNote(invoice) ? 'avoir' : 'facture'}-${invoice.number}.pdf`;
}

/** Fetches the document (recorded in the access log as a download), renders and saves its PDF. */
export async function downloadInvoicePdf(invoiceId: string) {
  const [{ data: invoice }, { renderInvoicePdf }] = await Promise.all([
    api.get<InvoiceDto>(`/invoices/${invoiceId}/document`),
    // The PDF renderer is heavy: loaded on the first download only
    import('../components/invoices/InvoicePdfDocument'),
  ]);
  saveFile(await renderInvoicePdf(invoice), invoiceFilename(invoice));
}

/** The period's invoices and credit notes, every status, for the accountant. */
export async function downloadInvoicesCsv(range: { from: string; to: string }) {
  const { data } = await api.get<Blob>('/invoices/export', { params: range, responseType: 'blob' });
  saveFile(data, `factures-${range.from}-${range.to}.csv`);
}
