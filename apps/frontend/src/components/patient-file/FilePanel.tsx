import { UserRound } from 'lucide-react';
import { useRef, useState } from 'react';

import { useAutosave } from '../../hooks/useAutosave';
import { useGrowingTextarea } from '../../hooks/useGrowingTextarea';
import api from '../../lib/api';
import {
  FILE_ANCHORS,
  FILE_FIELD_TYPES,
  FILE_FIELDS,
  type FileEntryDto,
  type FileField,
  fileFieldAnchor,
  type FileSectionDto,
  useFileEntries,
  useFileSections,
  useInvalidatePatientFile,
  usePatient,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatLongDate } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { DatePicker } from '../shared/DatePicker';
import { Field } from '../shared/Field';
import { SaveIndicator } from '../shared/SaveIndicator';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/toaster';

import { BaseMeasures } from './BaseMeasures';
import { PatientIdentityForm } from './PatientIdentityForm';

/**
 * The medical file: identity and contact, age, sex, height and the figures, then her sections in
 * her order. Each block has an anchor the summary's « Modifier » links lead to.
 */
export function FilePanel({ patientId }: { patientId: string }) {
  const { data: sections = [] } = useFileSections(patientId);
  const { data: patient } = usePatient(patientId);
  const byField = new Map(sections.map((s) => [s.field as FileField, s]));

  return (
    <div className="space-y-4">
      {patient && (
        <Section size="compact" icon={UserRound} area="patients" title="Patient" id={FILE_ANCHORS.identity}>
          <PatientIdentityForm patient={patient} />
        </Section>
      )}
      <BaseMeasures patientId={patientId} />
      <div className="grid gap-4 md:grid-cols-2">
        {FILE_FIELD_TYPES.map((field) => (
          <FileSectionCard key={field} patientId={patientId} field={field} section={byField.get(field)} />
        ))}
      </div>
    </div>
  );
}

/** One section: the text, saved as she types, « Modifié le … · voir l’historique » underneath. */
export function FileSectionCard({
  patientId,
  field,
  section,
  consultationId,
}: {
  patientId: string;
  field: FileField;
  section?: FileSectionDto;
  consultationId?: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const current = section?.current;
  const versions = section?.versionCount ?? 0;
  const labelId = `file-${field}`;

  return (
    <Section size="compact" title={<span id={labelId}>{FILE_FIELDS[field]}</span>} id={consultationId ? undefined : fileFieldAnchor(field)}>
      <div className="space-y-2">
        <FileSectionEditor
          patientId={patientId}
          field={field}
          current={current?.content ?? ''}
          consultationId={consultationId}
          labelledBy={labelId}
        >
          {current && (
            <p className="text-sm text-muted-foreground">
              Modifié le {formatLongDate(current.date, true)}
              {versions > 1 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen(!historyOpen)}
                    className="-my-3 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {historyOpen ? 'masquer l’historique' : `voir l’historique (${versions} versions)`}
                  </button>
                </>
              )}
            </p>
          )}
        </FileSectionEditor>
        {historyOpen && <FileHistory patientId={patientId} field={field} />}
      </div>
    </Section>
  );
}

/**
 * Edits one section as a plain text, saved shortly after typing and when leaving the field. The API
 * keeps the history: the same day (or in the same session) it updates that version, another day it
 * adds one. The text grows with its content.
 */
export function FileSectionEditor({
  patientId,
  field,
  current,
  consultationId,
  labelledBy,
  children,
}: {
  patientId: string;
  field: FileField;
  current: string;
  consultationId?: string;
  labelledBy?: string;
  /** Shown beside the save indicator (e.g. « Modifié le … ») */
  children?: React.ReactNode;
}) {
  const invalidate = useInvalidatePatientFile();
  const [content, setContent] = useState(current);
  const focused = useRef(false);
  const autosave = useAutosave(async (text: string) => {
    await api.put(`/patients/${patientId}/file/${field}`, { content: text, consultationId });
    invalidate(patientId);
  });

  // Take the saved text (after a save, or a correction in the history) unless she is typing
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    if (!focused.current && !autosave.hasPending()) setContent(current);
  }

  const ref = useGrowingTextarea(content);

  return (
    <div className="space-y-1">
      <Textarea
        ref={ref}
        rows={2}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : FILE_FIELDS[field]}
        value={content}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          void autosave.flush();
        }}
        onChange={(e) => {
          setContent(e.target.value);
          if (e.target.value.trim() === current.trim()) autosave.cancel();
          else autosave.schedule(e.target.value);
        }}
        className="min-h-20 resize-none overflow-hidden"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        {children ?? <span />}
        <SaveIndicator state={autosave.state} />
      </div>
    </div>
  );
}

/** Every version of a section, latest first; each can be corrected or deleted. */
function FileHistory({ patientId, field }: { patientId: string; field: FileField }) {
  const { data: entries = [] } = useFileEntries(patientId);
  const versions = entries.filter((e) => e.field === field);

  return (
    <ol className="space-y-2 border-l-2 border-border pl-4" aria-label={`Historique : ${FILE_FIELDS[field]}`}>
      {versions.map((entry, index) => (
        <HistoryVersion key={entry.id} patientId={patientId} entry={entry} isCurrent={index === 0} />
      ))}
    </ol>
  );
}

function HistoryVersion({ patientId, entry, isCurrent }: { patientId: string; entry: FileEntryDto; isCurrent: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [content, setContent] = useState(entry.content);
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const update = usePatientFileMutation(patientId, () => ({
    method: 'patch',
    url: `/patients/${patientId}/file-entries/${entry.id}`,
    body: { content, date },
  }));
  const remove = usePatientFileMutation(patientId, () => ({
    method: 'delete',
    url: `/patients/${patientId}/file-entries/${entry.id}`,
  }));
  const label = FILE_FIELDS[entry.field];
  const day = formatLongDate(entry.date, true);

  if (editing) {
    return (
      <li className="space-y-3 rounded-lg border bg-background p-3">
        <Field label="Date de la version" className="max-w-[14rem]">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Texte">
          <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={update.isPending || !date}
            onClick={() =>
              update.mutate(undefined, {
                onSuccess: () => {
                  setEditing(false);
                  toast({ title: 'Version corrigée' });
                },
              })
            }
          >
            Enregistrer la correction
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">
        {day}
        {isCurrent && ' · version actuelle'}
      </p>
      <p className="whitespace-pre-line leading-relaxed">
        {entry.content || <span className="text-muted-foreground">(texte effacé)</span>}
      </p>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Corriger la version du ${day}`}>
          Corriger
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label={`Supprimer la version du ${day}`}>
          Supprimer
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Supprimer cette version ?"
        description={`La version du ${day} de « ${label} » sera supprimée. Les autres versions restent.`}
        confirmLabel="Supprimer la version"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirm(false);
              toast({ title: 'Version supprimée' });
            },
          })
        }
      />
    </li>
  );
}
