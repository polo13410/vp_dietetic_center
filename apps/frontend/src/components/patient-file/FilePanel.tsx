import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import api from '../../lib/api';
import {
  FILE_FIELD_TYPES,
  FILE_FIELDS,
  type FileEntryDto,
  type FileField,
  type FileSectionDto,
  useFileEntries,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

import { fieldClass } from './LifeEventsPanel';

/** The current value of each section of the medical file. */
export function useFileSections(patientId: string) {
  return useQuery({
    queryKey: ['patient-file', patientId, 'file'],
    queryFn: async () => (await api.get<FileSectionDto[]>(`/patients/${patientId}/file`)).data,
  });
}

/**
 * Edits one section as a plain text. The API keeps the history: the same day (or in the same
 * session) it updates that version, another day it adds a new one.
 */
export function FileSectionEditor({
  patientId,
  field,
  current,
  consultationId,
}: {
  patientId: string;
  field: FileField;
  current: string;
  consultationId?: string;
}) {
  const [content, setContent] = useState(current);
  useEffect(() => setContent(current), [current]);
  const save = usePatientFileMutation(patientId, () => ({
    method: 'put',
    url: `/patients/${patientId}/file/${field}`,
    body: { content, consultationId },
  }));
  return (
    <div className="space-y-2">
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={`${fieldClass} resize-y`}
      />
      {content !== current && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(undefined, { onSuccess: () => toast({ title: `${FILE_FIELDS[field]} enregistré` }) })
            }
          >
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}

/** The medical file: each section in her order, editable, with its history. */
export function FilePanel({ patientId }: { patientId: string }) {
  const { data: sections = [] } = useFileSections(patientId);
  const { data: entries = [] } = useFileEntries(patientId);
  const byField = new Map(sections.map((s) => [s.field as FileField, s]));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FILE_FIELD_TYPES.map((field) => (
        <FileSectionCard
          key={field}
          patientId={patientId}
          field={field}
          section={byField.get(field)}
          history={entries.filter((e) => e.field === field).slice(1)}
        />
      ))}
    </div>
  );
}

function FileSectionCard({
  patientId,
  field,
  section,
  history,
}: {
  patientId: string;
  field: FileField;
  section?: FileSectionDto;
  history: FileEntryDto[];
}) {
  const [open, setOpen] = useState(false);
  const current = section?.current;

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-2">
      <h3 className="text-sm font-semibold">{FILE_FIELDS[field]}</h3>
      <FileSectionEditor patientId={patientId} field={field} current={current?.content ?? ''} />
      {current && <p className="text-xs text-muted-foreground">Modifié le {formatDate(current.updatedAt)}</p>}

      {history.length > 0 && (
        <div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Historique ({history.length})
          </button>
          {open && (
            <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {history.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                  <p className="whitespace-pre-line text-muted-foreground">{entry.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
