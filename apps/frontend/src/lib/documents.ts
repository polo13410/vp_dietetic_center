/** Document files the API accepts (same list as its upload filter), and how to show them. */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ACCEPTED: { mime: string; ext: string[] }[] = [
  { mime: 'application/pdf', ext: ['.pdf'] },
  { mime: 'image/jpeg', ext: ['.jpg', '.jpeg'] },
  { mime: 'image/png', ext: ['.png'] },
  { mime: 'image/webp', ext: ['.webp'] },
  { mime: 'image/heic', ext: ['.heic'] },
  { mime: 'application/msword', ext: ['.doc'] },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: ['.docx'] },
  { mime: 'application/vnd.ms-excel', ext: ['.xls'] },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: ['.xlsx'] },
  { mime: 'text/plain', ext: ['.txt'] },
  { mime: 'text/csv', ext: ['.csv'] },
];

export const ACCEPTED_FORMATS_LABEL = 'PDF, image (JPG, PNG, WebP, HEIC), Word, Excel ou texte';

/** For the file picker: only offer accepted files. */
export const ACCEPT_ATTRIBUTE = ACCEPTED.flatMap((a) => [a.mime, ...a.ext]).join(',');

/** Why a file cannot be uploaded, or null if it can. */
export function documentProblem(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const known = ACCEPTED.some((a) => a.mime === file.type || a.ext.includes(ext));
  if (!known) return `Format non accepté. Formats possibles : ${ACCEPTED_FORMATS_LABEL}.`;
  if (file.size > MAX_DOCUMENT_BYTES) return 'Fichier trop lourd : 10 Mo maximum.';
  return null;
}

export type PreviewKind = 'pdf' | 'image' | 'text';

/** How a document can be shown in the browser (HEIC and Office files can only be downloaded). */
export function previewKind(mimeType: string): PreviewKind | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return 'image';
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return 'text';
  return null;
}
