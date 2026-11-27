import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  FileUp,
  HeartPulse,
  Loader2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Field } from '../../components/shared/Field';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';
import { FILE_FIELDS, FILE_FIELD_TYPES, PAYMENT_METHODS, formatPrice } from '../../lib/patient-file';
import {
  apiMessage,
  IMPORT_ACCEPT,
  importErrors,
  importPayload,
  importSummary,
  isImportFile,
  outOfOrder,
  type PatientImportDraftDto,
  type PatientImportPreviewDto,
  type PatientImportSessionDto,
} from '../../lib/patient-import';
import { cn, formatLongDate, formatNumber } from '../../lib/utils';

type Sex = 'F' | 'M' | 'none';
const SEXES = [
  { value: 'F', label: 'Femme' },
  { value: 'M', label: 'Homme' },
  { value: 'none', label: 'Non renseigné' },
] as const;

type Stage =
  | { kind: 'pick'; error?: string }
  | { kind: 'reading'; name: string }
  | { kind: 'review'; name: string; preview: PatientImportPreviewDto }
  | { kind: 'done'; id: string; name: string; sessions: number };

/**
 * « Importer un patient »: one of her Numbers files (one per patient) becomes a patient in the
 * app, with their medical file and every past session. The file is read first and shown to
 * check and correct (names, dates): nothing is saved before « Importer le dossier ».
 */
export default function PatientImportPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });

  const read = async (file: File) => {
    if (!isImportFile(file.name)) {
      return setStage({ kind: 'pick', error: 'Choisissez un fichier Numbers (.numbers) ou Excel (.xlsx).' });
    }
    setStage({ kind: 'reading', name: file.name });
    try {
      const body = new FormData();
      body.append('file', file);
      // The client sends JSON by default: the file needs a multipart body
      const { data } = await api.post<PatientImportPreviewDto>('/patients/import/preview', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStage({ kind: 'review', name: file.name, preview: data });
    } catch (error) {
      setStage({ kind: 'pick', error: apiMessage(error) ?? 'Le fichier n’a pas pu être lu.' });
    }
  };

  return (
    <>
      <PageHeader
        area="patients"
        title="Importer un patient"
        subtitle="Depuis votre fichier Numbers : identité, dossier médical et toutes les séances."
        actions={
          <Button asChild variant="outline">
            <Link to="/patients">
              <ArrowLeft aria-hidden /> Patients
            </Link>
          </Button>
        }
      />
      {stage.kind === 'pick' && <PickFile onFile={read} error={stage.error} />}
      {stage.kind === 'reading' && (
        <Section title={stage.name} icon={FileUp} area="patients">
          <p role="status" className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden /> Lecture du fichier…
          </p>
        </Section>
      )}
      {stage.kind === 'review' && (
        <Review
          key={stage.name}
          name={stage.name}
          preview={stage.preview}
          onCancel={() => setStage({ kind: 'pick' })}
          onDone={(id, sessions) => setStage({ kind: 'done', id, sessions, name: stage.name })}
        />
      )}
      {stage.kind === 'done' && (
        <Section title="Dossier importé" icon={CircleCheck} area="patients">
          <p className="text-base">
            {stage.name} : le patient est créé avec {stage.sessions} séance{stage.sessions > 1 ? 's' : ''}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/patients/${stage.id}`}>Ouvrir son dossier</Link>
            </Button>
            <Button variant="outline" onClick={() => setStage({ kind: 'pick' })}>
              <FileUp aria-hidden /> Importer un autre fichier
            </Button>
          </div>
        </Section>
      )}
    </>
  );
}

function PickFile({ onFile, error }: { onFile: (file: File) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Section
      title="Choisir le fichier"
      icon={FileUp}
      area="patients"
      description="Un fichier par patient. Rien n’est enregistré avant que vous ayez relu et confirmé."
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          over ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/40',
        )}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        <span className="text-base font-medium">Choisir un fichier ou le déposer ici</span>
        <span className="text-sm text-muted-foreground">Numbers (.numbers) ou export Excel (.xlsx)</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        aria-label="Fichier du patient"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // the same file can be picked again after a correction
          if (file) onFile(file);
        }}
      />
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </Section>
  );
}

function Review({
  name,
  preview,
  onCancel,
  onDone,
}: {
  name: string;
  preview: PatientImportPreviewDto;
  onCancel: () => void;
  onDone: (id: string, sessions: number) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PatientImportDraftDto>(preview.draft);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  const errors = importErrors(draft);
  const blocked = preview.duplicates.length > 0 && !allowDuplicate;
  const set = <K extends keyof PatientImportDraftDto>(key: K, value: PatientImportDraftDto[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setSession = (index: number, change: Partial<PatientImportSessionDto>) =>
    setDraft((d) => ({ ...d, sessions: d.sessions.map((s, i) => (i === index ? { ...s, ...change } : s)) }));

  const submit = async () => {
    if (Object.keys(errors).length) return setShowErrors(true);
    if (blocked || busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const { data } = await api.post<{ id: string; sessions: number }>(
        '/patients/import',
        importPayload(draft, allowDuplicate),
      );
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      onDone(data.id, data.sessions);
    } catch (error) {
      setFailure(apiMessage(error) ?? 'L’import n’a pas abouti : rien n’a été enregistré.');
      setBusy(false);
    }
  };

  const facts: [string, string | null][] = [
    ['Situation familiale', draft.familySituation],
    ['Profession', draft.profession],
    ['Médecin traitant', draft.gpName],
    ['Adresse', [draft.address, draft.zipCode, draft.city].filter(Boolean).join(' ') || null],
    ['Motif', draft.consultationReason],
    ['Adressé par', draft.referralSource],
    ['Taille', draft.heightCm ? `${formatNumber(draft.heightCm, 1)} cm` : null],
  ];
  const sections = FILE_FIELD_TYPES.filter((f) => draft.file[f]?.trim());
  const flagged = outOfOrder(draft.sessions);

  return (
    <div className="space-y-6">
      {(preview.warnings.length > 0 || preview.duplicates.length > 0) && (
        <div role="status" className="space-y-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-warning">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-5" aria-hidden /> À vérifier avant l’import
          </p>
          {preview.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-6 text-sm">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {preview.duplicates.length > 0 && (
            <div className="space-y-2 text-sm">
              <p>
                Vous avez déjà{' '}
                {preview.duplicates.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ', '}
                    <Link to={`/patients/${p.id}`} target="_blank" className="font-medium underline">
                      {p.firstName} {p.lastName}
                    </Link>
                  </span>
                ))}
                . Ce fichier est peut-être déjà importé.
              </p>
              <label className="flex min-h-11 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={allowDuplicate}
                  onChange={(e) => setAllowDuplicate(e.target.checked)}
                />
                C’est un autre patient : importer quand même
              </label>
            </div>
          )}
        </div>
      )}

      <Section title="Identité" icon={UserRound} area="patients" description={`Lue dans ${name}. Corrigez si besoin.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={showErrors ? errors.firstName : undefined}>
            <Input value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Nom" required error={showErrors ? errors.lastName : undefined}>
            <Input value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input type="tel" value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field
            label="Âge"
            hint={draft.ageOn ? `Au ${formatLongDate(draft.ageOn)} : l’année de naissance est estimée.` : undefined}
            error={showErrors ? errors.age : undefined}
          >
            <Input
              inputMode="numeric"
              value={draft.age ?? ''}
              onChange={(e) => {
                const value = e.target.value.trim();
                set('age', value === '' ? null : Number(value));
              }}
            />
          </Field>
          <div className="space-y-1.5">
            <p className="text-base font-medium">Sexe</p>
            <SegmentedControl<Sex>
              label="Sexe"
              options={SEXES}
              value={draft.sex ?? 'none'}
              onChange={(v) => set('sex', v === 'none' ? null : (v as PatientImportDraftDto['sex']))}
            />
          </div>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-foreground">{label} :</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
        </dl>
      </Section>

      <Section title="Dossier médical" icon={HeartPulse} area="patients">
        {sections.length === 0 ? (
          <p className="text-muted-foreground">Aucune rubrique remplie dans le fichier.</p>
        ) : (
          <dl className="space-y-3">
            {sections.map((field) => (
              <div key={field}>
                <dt className="text-sm text-muted-foreground">{FILE_FIELDS[field]}</dt>
                <dd className="whitespace-pre-line">{draft.file[field]}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section
        title="Séances"
        icon={CalendarDays}
        area="patients"
        flush
        description="Une ligne par séance du suivi. Les dates se corrigent ici."
      >
        {draft.sessions.length === 0 ? (
          <p className="px-5 pb-5 text-muted-foreground sm:px-6">Aucune séance dans le fichier.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Séance</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Prix</th>
                  <th className="px-4 py-2 font-medium">Paiement</th>
                  <th className="px-4 py-2 font-medium">Poids</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {draft.sessions.map((s, i) => {
                  const notes = [
                    s.habits && 'habitudes',
                    s.sessionWork && 'travail en séance',
                    s.advice && 'conseils',
                    s.aversions && 'aversions',
                    s.tastes && 'goûts',
                  ].filter(Boolean);
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{s.label}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="date"
                          aria-label={`Date de ${s.label}`}
                          aria-invalid={flagged.has(i) || (showErrors && !!errors[`session-${i}`])}
                          className={cn('w-40', flagged.has(i) && 'border-warning')}
                          value={s.date}
                          onChange={(e) => setSession(i, { date: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">{s.priceCents === null ? '—' : formatPrice(s.priceCents)}</td>
                      <td className="px-4 py-2">{PAYMENT_METHODS[s.paymentMethod]}</td>
                      <td className="px-4 py-2">{s.weightKg === null ? '—' : `${formatNumber(s.weightKg)} kg`}</td>
                      <td className="px-4 py-2 text-muted-foreground">{notes.join(', ') || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {preview.ignored.length > 0 && (
        <p className="text-sm text-muted-foreground">Non repris : {preview.ignored.join(' · ')}.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={busy || blocked}>
          {busy && <Loader2 className="animate-spin" aria-hidden />} Importer le dossier
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Choisir un autre fichier
        </Button>
        <span className="text-sm text-muted-foreground">{importSummary(draft)}</span>
      </div>
      {showErrors && Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Corrigez les champs signalés en rouge
          {Object.keys(errors).some((k) => k.startsWith('session-')) && ' (une séance sans date)'}.
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {failure}
        </p>
      )}
    </div>
  );
}
