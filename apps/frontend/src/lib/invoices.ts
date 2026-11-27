/**
 * Invoices and credit notes, of patients and of payers: labels, periods, data hooks and
 * downloads (docs/REFONTE.md lots 5 and 16).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillingRhythm,
  CreateCoverageDto,
  CreatePayerDto,
  InvoiceDto,
  InvoiceListDto,
  InvoiceMismatch,
  PatientCoverageDto,
  PatientInvoicesDto,
  PayerInvoiceListItemDto,
  PayerInvoiceMismatchesDto,
  PayerOverviewDto,
  PayerPreviewDto,
  PayerRemindersDto,
  SessionInvoicesDto,
  SessionToInvoiceDto,
  ShareKind,
  UpdatePayerDto,
} from '@vp/types';

import type { BadgeTone } from '../components/shared/StatusBadge';

import api from './api';
import { saveFile } from './download';

export type {
  BillingRhythm,
  InvoiceDto,
  InvoiceListDto,
  InvoiceMismatch,
  PatientCoverageDto,
  PatientInvoicesDto,
  PayerInvoiceListItemDto,
  PayerOverviewDto,
  PayerPreviewDto,
  PayerRemindersDto,
  SessionInvoicesDto,
  SessionToInvoiceDto,
  ShareKind,
};

/** "2026-0012" for an invoice, "A-2026-0001" for a credit note */
export const isCreditNote = (invoice: Pick<InvoiceDto, 'type'>) => invoice.type === 'CREDIT_NOTE';

/** Invoices in force: the only ones counted in totals. */
export const countsInTotals = (invoice: Pick<InvoiceDto, 'type' | 'cancelledAt'>) =>
  !isCreditNote(invoice) && invoice.cancelledAt === null;

/** A payer invoice (or its credit note): grouped sessions of a period. */
export const isPayerInvoice = (invoice: Pick<InvoiceDto, 'recipient'>) => invoice.recipient === 'PAYER';

/** « Martine Roux » for a patient invoice, « Mutuelle Horizon » for a payer invoice. */
export function recipientName(invoice: Pick<InvoiceDto, 'recipient' | 'patientFirstName' | 'patientLastName' | 'payerName'>) {
  if (isPayerInvoice(invoice)) return invoice.payerName ?? 'Organisme';
  return [invoice.patientFirstName, invoice.patientLastName].filter(Boolean).join(' ');
}

/** The status pill of an invoice or credit note. A payer invoice: « En attente », « Réglée le … ». */
export function invoiceStatus(
  invoice: Pick<InvoiceDto, 'type' | 'cancelledAt' | 'paymentMethod'> & Partial<Pick<InvoiceDto, 'recipient' | 'paidAt'>>,
): {
  label: string;
  tone: BadgeTone;
} {
  if (isCreditNote(invoice)) return { label: 'Avoir', tone: 'neutral' };
  if (invoice.cancelledAt) return { label: 'Annulée', tone: 'danger' };
  if (invoice.recipient === 'PAYER') {
    return invoice.paidAt
      ? { label: `Réglée le ${dayLabel(invoice.paidAt, true)}`, tone: 'success' }
      : { label: 'En attente', tone: 'warning' };
  }
  return invoice.paymentMethod === 'NONE'
    ? { label: 'Non réglée', tone: 'warning' }
    : { label: 'Acquittée', tone: 'success' };
}

const MISMATCH_LABELS: Record<InvoiceMismatch, string> = {
  formula: 'la formule',
  price: 'le prix',
  discount: 'la remise',
  payer: 'la prise en charge',
  paymentMethod: 'le moyen de paiement',
  date: 'la date',
  practice: 'l’adresse du cabinet',
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

/**
 * Whether a séance needs a patient invoice (lot 16): not without a price, not when it is free
 * (100 % discount), not when the payer pays it all; otherwise, for the patient part.
 */
export function patientBilling(session: {
  formulaLabel: string | null;
  priceCents: number | null;
  netCents?: number | null;
  patientCents?: number | null;
}): { state: 'noPrice' | 'free' | 'payer' | 'ready'; cents: number } {
  if (!session.formulaLabel || session.priceCents === null) return { state: 'noPrice', cents: 0 };
  const net = session.netCents ?? session.priceCents;
  const patient = session.patientCents ?? net;
  if (net === 0) return { state: 'free', cents: 0 };
  if (patient === 0) return { state: 'payer', cents: 0 };
  return { state: 'ready', cents: patient };
}

/** « 1 séance supprimée, 2 séances modifiées » */
export function payerMismatchText(m: PayerInvoiceMismatchesDto): string {
  const part = (n: number, what: string) => (n ? `${n} séance${n > 1 ? 's' : ''} ${what}${n > 1 ? 's' : ''}` : null);
  return [part(m.deleted, 'supprimée'), part(m.changed, 'modifiée'), part(m.added, 'à ajouter')]
    .filter(Boolean)
    .join(', ');
}

// ─── Discount and payers ──────────────────────────────────────────────────────

export const RHYTHMS: Record<BillingRhythm, string> = {
  MONTHLY: 'Tous les mois',
  EVERY_N_MONTHS: 'Tous les N mois',
  ON_DEMAND: 'À la demande',
};

/** « tous les mois », « tous les 3 mois », « à la demande » */
export function rhythmLabel(payer: { billingRhythm: BillingRhythm; rhythmMonths: number | null }): string {
  if (payer.billingRhythm === 'EVERY_N_MONTHS') return `tous les ${payer.rhythmMonths ?? 'N'} mois`;
  return payer.billingRhythm === 'MONTHLY' ? 'tous les mois' : 'à la demande';
}

/** « 30,00 € par séance, 10 séances au plus, du 1er novembre 2026 au 31 octobre 2027 » */
export function coverageTerms(c: Pick<PatientCoverageDto, 'kind' | 'value' | 'maxSessions' | 'startDate' | 'endDate'>) {
  const parts = [c.kind === 'PERCENT' ? `${c.value} % de chaque séance` : `${formatEuros(c.value)} par séance`];
  if (c.maxSessions) parts.push(`${c.maxSessions} séance${c.maxSessions > 1 ? 's' : ''} au plus`);
  if (c.startDate && c.endDate) parts.push(`du ${dayLabel(c.startDate)} au ${dayLabel(c.endDate)}`);
  else if (c.startDate) parts.push(`à partir du ${dayLabel(c.startDate)}`);
  else if (c.endDate) parts.push(`jusqu’au ${dayLabel(c.endDate)}`);
  return parts.join(', ');
}

/** Euros typed with a comma or a dot (« 12,5 ») in cents; null when it is not a number. */
export function parseEuros(text: string): number | null {
  const clean = text.replace(/\s|€/g, '').replace(',', '.');
  if (clean === '' || !/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** 1250 → « 12,50 » for an input */
export const eurosInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const euroFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const formatEuros = (cents: number) => euroFormat.format(cents / 100);

/** « 30 novembre 2026 » for a day ("2026-11-30" or a date-only value at midnight UTC). */
export function dayLabel(day: string, short = false): string {
  const [year, month, date] = day.slice(0, 10).split('-').map(Number);
  const sameYear = year === new Date().getFullYear();
  return `${date === 1 ? '1er' : date} ${MONTHS[month - 1]}${short && sameYear ? '' : ` ${year}`}`;
}

/** « du 1er au 30 novembre 2026 », « du 1er novembre 2026 au 31 janvier 2027 » */
export function periodText(from: string, to: string): string {
  const [fy, fm] = from.split('-');
  const [ty, tm] = to.split('-');
  const start = dayLabel(from);
  if (fy === ty && fm === tm) return `du ${start.split(' ')[0]} au ${dayLabel(to)}`;
  if (fy === ty) return `du ${start.split(' ').slice(0, 2).join(' ')} au ${dayLabel(to)}`;
  return `du ${start} au ${dayLabel(to)}`;
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

// ─── Payers ───────────────────────────────────────────────────────────────────

const PAYERS = [...INVOICES, 'payers'] as const;

/** Her payers with their next period to bill (« Organismes »). */
export function usePayers(enabled = true) {
  return useQuery({
    queryKey: [...PAYERS, 'overview'],
    queryFn: async () => (await api.get<PayerOverviewDto[]>('/payers')).data,
    enabled,
  });
}

/** Payer periods ended and not billed, payer invoices pending for more than 60 days. */
export function usePayerReminders(enabled = true) {
  return useQuery({
    queryKey: [...PAYERS, 'reminders'],
    queryFn: async () => (await api.get<PayerRemindersDto>('/payers/reminders')).data,
    enabled,
  });
}

export function usePayerInvoices() {
  return useQuery({
    queryKey: [...PAYERS, 'invoices'],
    queryFn: async () => (await api.get<PayerInvoiceListItemDto[]>('/payer-invoices')).data,
  });
}

/** « Préparer la facture »: the sessions of the period it pays in part. */
export function usePayerPreview(payerId: string | undefined, range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: [...PAYERS, 'preview', payerId, range?.from, range?.to],
    queryFn: async () => (await api.get<PayerPreviewDto>(`/payers/${payerId}/preview`, { params: range })).data,
    enabled: !!payerId && !!range && range.from <= range.to,
  });
}

function useInvoicesMutation<T, R>(mutationFn: (arg: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVOICES });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useSavePayer = () =>
  useInvoicesMutation(async ({ id, ...body }: (CreatePayerDto | UpdatePayerDto) & { id?: string }) =>
    id ? (await api.patch(`/payers/${id}`, body)).data : (await api.post('/payers', body)).data,
  );

/** « Émettre la facture » of a payer over a period */
export const useIssuePayerInvoice = () =>
  useInvoicesMutation(async ({ payerId, from, to }: { payerId: string; from: string; to: string }) =>
    (await api.post<InvoiceDto>(`/payers/${payerId}/invoices`, { from, to })).data,
  );

/** « Réglée le … » (null: back « en attente ») */
export const useSetPayerInvoicePaid = () =>
  useInvoicesMutation(async ({ id, paidOn }: { id: string; paidOn: string | null }) =>
    (await api.post<InvoiceDto>(`/payer-invoices/${id}/paid`, { paidOn })).data,
  );

// ─── Coverages ────────────────────────────────────────────────────────────────

export function usePatientCoverages(patientId: string | undefined) {
  return useQuery({
    queryKey: [...INVOICES, 'coverages', patientId],
    queryFn: async () => (await api.get<PatientCoverageDto[]>(`/patients/${patientId}/coverages`)).data,
    enabled: !!patientId,
  });
}

/** Adds, changes or removes a coverage; the patient's open sessions take it, so the file is refreshed too. */
export function useSaveCoverage(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remove, ...body }: Partial<CreateCoverageDto> & { id?: string; remove?: boolean }) => {
      const base = `/patients/${patientId}/coverages`;
      if (remove && id) return (await api.delete(`${base}/${id}`)).data;
      return id ? (await api.patch(`${base}/${id}`, body)).data : (await api.post(base, body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVOICES });
      queryClient.invalidateQueries({ queryKey: ['consultation'] });
      queryClient.invalidateQueries({ queryKey: ['patient-file', patientId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Downloads ────────────────────────────────────────────────────────────────

/** « facture-2026-0012.pdf », « avoir-A-2026-0001.pdf » */
export function invoiceFilename(invoice: Pick<InvoiceDto, 'type' | 'number'>): string {
  return `${isCreditNote(invoice) ? 'avoir' : 'facture'}-${invoice.number}.pdf`;
}

export async function invoicePdf(invoiceId: string, action: 'preview' | 'document', signal?: AbortSignal) {
  const [{ data: invoice }, { renderInvoicePdf }] = await Promise.all([
    api.get<InvoiceDto>(`/invoices/${invoiceId}/${action}`, { signal }),
    import('../components/invoices/InvoicePdfDocument'),
  ]);
  signal?.throwIfAborted();
  return { blob: await renderInvoicePdf(invoice), filename: invoiceFilename(invoice) };
}

export async function downloadInvoicePdf(invoiceId: string) {
  const { blob, filename } = await invoicePdf(invoiceId, 'document');
  saveFile(blob, filename);
}

/** The period's invoices and credit notes, every status, for the accountant. */
export async function downloadInvoicesCsv(range: { from: string; to: string }) {
  const { data } = await api.get<Blob>('/invoices/export', { params: range, responseType: 'blob' });
  saveFile(data, `factures-${range.from}-${range.to}.csv`);
}
