/** Reports to the patient's GP (docs/REFONTE.md lot 10): labels, data hooks and the PDF download. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GpReportDocumentDto, GpReportDto } from '@vp/types';

import type { BadgeTone } from '../components/shared/StatusBadge';

import api from './api';
import { saveFile } from './download';
import { formatLongDate } from './utils';

export type { GpReportDocumentDto, GpReportDto };

/** « Brouillon », « Envoyé le 22 novembre » */
export function gpReportStatus(report: Pick<GpReportDto, 'status' | 'sentAt' | 'date'>): {
  label: string;
  tone: BadgeTone;
} {
  return report.status === 'SENT'
    ? { label: `Envoyé le ${formatLongDate(report.sentAt ?? report.date, true)}`, tone: 'success' }
    : { label: 'Brouillon', tone: 'warning' };
}

/** The paragraphs of the letter (separated by blank lines), each keeping its line breaks. */
export function paragraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\n+|\s+$/g, ''))
    .filter((p) => p.trim() !== '');
}

/** Signs the PDF standard fonts (WinAnsi) cannot draw, and what to print instead. */
const PRINTABLE: Record<string, string> = {
  '−': '-', // minus sign (« −8 kg »)
  '‐': '-',
  '‑': '-',
  ' ': ' ', // narrow no-break space
  ' ': ' ',
  '≤': '<=',
  '≥': '>=',
  '→': '->',
  '≈': '~',
};

/**
 * The text as the PDF can print it: signs outside its fonts replaced, and a no-break space before
 * « : ; ! ? » so that French punctuation never starts a line.
 */
export function printable(text: string): string {
  return text
    .replace(/[−‐‑  ≤≥→≈]/g, (c) => PRINTABLE[c])
    .replace(/ ([:;!?])/g, ' $1');
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** « compte-rendu-roux-martine-2026-11-22.pdf » */
export function gpReportFilename(report: Pick<GpReportDocumentDto, 'patient' | 'date'>): string {
  return `compte-rendu-${slug(`${report.patient.lastName} ${report.patient.firstName}`)}-${report.date.slice(0, 10)}.pdf`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const reportsKey = (patientId: string) => ['gp-reports', patientId] as const;
const url = (patientId: string, id?: string) => `/patients/${patientId}/gp-reports${id ? `/${id}` : ''}`;

export function useGpReports(patientId: string | undefined) {
  return useQuery({
    queryKey: reportsKey(patientId ?? ''),
    queryFn: async () => (await api.get<GpReportDto[]>(url(patientId!))).data,
    enabled: !!patientId,
  });
}

export function useGpReport(patientId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: [...reportsKey(patientId ?? ''), id],
    queryFn: async () => (await api.get<GpReportDocumentDto>(url(patientId!, id))).data,
    enabled: !!patientId && !!id,
  });
}

/** Refreshes the list and the file's recap (« Compte rendu : à faire » / « envoyé le … »). */
function useRefresh(patientId: string) {
  const queryClient = useQueryClient();
  return (report?: GpReportDto) => {
    if (report) {
      queryClient.setQueryData<GpReportDocumentDto>([...reportsKey(patientId), report.id], (old) =>
        old ? { ...old, ...report } : old,
      );
    }
    queryClient.invalidateQueries({ queryKey: reportsKey(patientId), exact: true });
    queryClient.invalidateQueries({ queryKey: ['patient-file', patientId, 'brief'] });
  };
}

/** « Rédiger un compte rendu »: a new draft, pre-filled by the API from the file. */
export function useCreateGpReport(patientId: string) {
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: async () => (await api.post<GpReportDto>(url(patientId), {})).data,
    onSuccess: (report) => refresh(report),
  });
}

/** Saves the text, or marks the report as sent (or back to draft). */
export function useUpdateGpReport(patientId: string, id: string) {
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: async (changes: { content?: string; status?: 'DRAFT' | 'SENT' }) =>
      (await api.patch<GpReportDto>(url(patientId, id), changes)).data,
    onSuccess: (report) => refresh(report),
  });
}

/** « Régénérer »: the draft's text is replaced by a new one from the file. */
export function useRegenerateGpReport(patientId: string, id: string) {
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: async () => (await api.post<GpReportDto>(`${url(patientId, id)}/regenerate`)).data,
    onSuccess: (report) => refresh(report),
  });
}

export function useDeleteGpReport(patientId: string) {
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(url(patientId, id));
    },
    onSuccess: () => refresh(),
  });
}

/** Fetches the report (recorded in the access log as a download), renders and saves its PDF. */
export async function downloadGpReportPdf(patientId: string, id: string) {
  const [{ data: report }, { renderGpReportPdf }] = await Promise.all([
    api.get<GpReportDocumentDto>(`${url(patientId, id)}/document`),
    // The PDF renderer is heavy: loaded on the first download only
    import('../components/gp-reports/GpReportPdfDocument'),
  ]);
  saveFile(await renderGpReportPdf(report), gpReportFilename(report));
}
