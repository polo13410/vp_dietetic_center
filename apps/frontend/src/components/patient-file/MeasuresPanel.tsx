import { Activity, Baby, Flag, ListOrdered, Pencil, Plus, Ruler, Scale, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { hasAny, heightChanges, parseDecimal, type TimelineRow, timelineRows } from '../../lib/measure-timeline';
import {
  EVENT_CATEGORIES,
  FILE_ANCHORS,
  formatMetric,
  type LifeEvent,
  type LifeEventCategory,
  METRICS,
  type MetricType,
  missingMessage,
  sessionName,
  type TimelineMeasurement,
  useMeasureTimeline,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatLongDate, formatNumber, todayISO } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingSpinner } from '../ui/loading-screen';
import { toast } from '../ui/toaster';

import { AdultFormulaNote, BmiBadge } from './BmiBadge';
import { CorpulenceChart } from './CorpulenceChart';
import { fieldClass, LifeEventForm } from './LifeEventForm';
import { MetricsChart } from './MetricsChart';

/** Measurements besides weight and height, for those who take them. */
export const EXTRA_METRICS: MetricType[] = ['WAIST', 'HIP', 'BODY_FAT', 'MUSCLE_MASS'];
const ALL_METRICS = Object.keys(METRICS) as MetricType[];

/**
 * The « Mesures » tab: the curves on top (weight with the life events, height when it changes, the
 * corpulence chart under 18, the extra measurements), then one timeline, latest first, of every
 * measurement and life event. A measurement can be added at any date, before the follow-up too
 * (« à cette époque je faisais 70 kg »), and each row is corrected or deleted in place.
 */
export function MeasuresPanel({ patientId }: { patientId: string }) {
  const { data: timeline, isLoading } = useMeasureTimeline(patientId);
  if (isLoading) return <LoadingSpinner />;
  if (!timeline) return null;
  const { measurements, lifeEvents, corpulence } = timeline;
  const weighed = hasAny(measurements, ['WEIGHT']);

  return (
    <div className="space-y-4">
      <Section icon={Scale} area="patients" title="Poids" id={FILE_ANCHORS.weight} size="compact">
        {weighed ? (
          <MetricsChart measurements={measurements} events={lifeEvents} types={['WEIGHT']} className="h-64" />
        ) : (
          <p className="text-base text-muted-foreground">
            Pas encore de pesée. Ajoutez une mesure, même ancienne : elle apparaîtra sur la courbe.
          </p>
        )}
      </Section>
      {(corpulence || heightChanges(measurements)) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {corpulence && (
            <Section
              icon={Baby}
              area="patients"
              title="Courbe de corpulence"
              description="IMC selon l’âge, avant 18 ans"
              id="corpulence"
              size="compact"
              className={heightChanges(measurements) ? undefined : 'lg:col-span-2'}
            >
              <CorpulenceChart data={corpulence} />
            </Section>
          )}
          {heightChanges(measurements) && (
            <Section
              icon={Ruler}
              area="patients"
              title="Taille"
              id={FILE_ANCHORS.height}
              size="compact"
              className={corpulence ? undefined : 'lg:col-span-2'}
            >
              <MetricsChart measurements={measurements} types={['HEIGHT']} className="h-64" />
            </Section>
          )}
        </div>
      )}
      {hasAny(measurements, EXTRA_METRICS) && (
        <Section icon={Activity} area="patients" title="Mesures complémentaires" id="complementaires" size="compact">
          <MetricsChart measurements={measurements} events={lifeEvents} types={EXTRA_METRICS} className="h-56" />
        </Section>
      )}
      <Timeline patientId={patientId} rows={timelineRows(timeline)} />
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

type Adding = 'measurement' | 'event' | null;

function Timeline({ patientId, rows }: { patientId: string; rows: TimelineRow[] }) {
  const [adding, setAdding] = useState<Adding>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TimelineRow | null>(null);
  const remove = usePatientFileMutation(patientId, (row: TimelineRow) => ({
    method: 'delete',
    url:
      row.kind === 'measurement'
        ? `/patients/${patientId}/measurements/${row.measurement.id}`
        : `/patients/${patientId}/life-events/${row.event.id}`,
  }));

  return (
    <Section
      icon={ListOrdered}
      area="patients"
      title="Toutes les mesures"
      description="Du plus récent au plus ancien, avec les faits marquants"
      id={FILE_ANCHORS.timeline}
      action={
        <>
          <Button onClick={() => setAdding('measurement')} disabled={adding === 'measurement'}>
            <Plus aria-hidden /> Ajouter une mesure
          </Button>
          <Button variant="outline" onClick={() => setAdding('event')} disabled={adding === 'event'}>
            <Flag aria-hidden /> Ajouter un fait marquant
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {adding === 'measurement' && <AddMeasurement patientId={patientId} onClose={() => setAdding(null)} />}
        {adding === 'event' && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <LifeEventForm patientId={patientId} onDone={() => setAdding(null)} />
          </div>
        )}
        {rows.length === 0 ? (
          !adding && (
            <EmptyState
              icon={Scale}
              title="Aucune mesure pour l’instant"
              description="Le poids pris en séance s’ajoute ici. Vous pouvez aussi saisir son histoire : un poids d’il y a quelques années, avec une note."
              action={
                <Button onClick={() => setAdding('measurement')}>
                  <Plus aria-hidden /> Ajouter une mesure
                </Button>
              }
            />
          )
        ) : (
          <ol className="divide-y" aria-label="Frise des mesures">
            {rows.map((row) => (
              <li key={row.id} className="py-2">
                {editing === row.id ? (
                  row.kind === 'measurement' ? (
                    <EditMeasurement patientId={patientId} measurement={row.measurement} onDone={() => setEditing(null)} />
                  ) : (
                    <EditEvent patientId={patientId} event={row.event} onDone={() => setEditing(null)} />
                  )
                ) : (
                  <RowView row={row} onEdit={() => setEditing(row.id)} onDelete={() => setDeleting(row)} />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting?.kind === 'event' ? 'Supprimer ce fait marquant ?' : 'Supprimer cette mesure ?'}
        description={deleting ? deleteDescription(deleting) : ''}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => setDeleting(null),
            onError: () => toast({ title: 'La suppression n’a pas été enregistrée. Réessayez.', variant: 'destructive' }),
          })
        }
      />
    </Section>
  );
}

function deleteDescription(row: TimelineRow): string {
  if (row.kind === 'event') return `« ${row.event.title} » (${formatLongDate(row.event.date)}) ne s’affichera plus sur la courbe.`;
  const m = row.measurement;
  const session = m.session ? ` Elle avait été prise pendant la séance « ${sessionName(m.session.sequence)} ».` : '';
  return `${METRICS[m.type].label} du ${formatLongDate(m.measuredAt)} : ${formatMetric(m.type, m.value)}.${session}`;
}

/** A row as read: date, what was measured or happened, and its actions. */
function RowView({ row, onEdit, onDelete }: { row: TimelineRow; onEdit: () => void; onDelete: () => void }) {
  const what = row.kind === 'measurement' ? METRICS[row.measurement.type].label.toLowerCase() : 'ce fait marquant';
  return (
    <div className="flex items-start gap-3">
      <p className="w-28 shrink-0 pt-2.5 text-sm tabular-nums text-muted-foreground sm:w-36">
        {formatLongDate(row.date, true)}
        <span className="block">{row.date.slice(0, 4)}</span>
      </p>
      <div className="min-w-0 flex-1 py-2">
        {row.kind === 'measurement' ? <MeasurementView measurement={row.measurement} /> : <EventView event={row.event} />}
      </div>
      <div className="flex shrink-0">
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Corriger ${what} du ${formatLongDate(row.date)}`}>
          <Pencil aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Supprimer ${what} du ${formatLongDate(row.date)}`}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function MeasurementView({ measurement: m }: { measurement: TimelineMeasurement }) {
  const figures = m.figures;
  const bmiMissing = figures && !figures.bmi ? missingMessage(figures.missing, 'bmi') : null;
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold">{METRICS[m.type].label}</span>
        <span className="text-lg font-semibold tabular-nums">{formatMetric(m.type, m.value)}</span>
        {m.session && (
          <Link
            to={`/consultations/${m.session.id}`}
            className="-my-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Prise en séance : {sessionName(m.session.sequence)}
          </Link>
        )}
      </p>
      {figures?.bmi && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
          <span className="tabular-nums">IMC {formatNumber(figures.bmi.value)}</span>
          <BmiBadge bmi={figures.bmi} short />
          {figures.bmr && (
            <span className="tabular-nums text-muted-foreground">
              MB {formatNumber(figures.bmr.mj)} MJ · {formatNumber(figures.bmr.kcal, 1)} kcal{' '}
              <AdultFormulaNote bmr={figures.bmr} />
            </span>
          )}
        </p>
      )}
      {figures?.minor && figures.height && (
        <p className="text-sm text-muted-foreground">
          Avec la taille de l’époque : {formatMetric('HEIGHT', figures.height.value)}, mesurée le{' '}
          {formatLongDate(figures.height.measuredAt, true)}
        </p>
      )}
      {bmiMissing && <p className="text-sm text-muted-foreground">{bmiMissing.replace('la taille', 'une taille à cette date')}.</p>}
      {m.note && <p className="whitespace-pre-line text-base italic text-muted-foreground">{m.note}</p>}
    </div>
  );
}

function EventView({ event }: { event: LifeEvent }) {
  return (
    <p className="text-base">
      <span className="text-info" aria-hidden>
        ◆
      </span>{' '}
      <span className="font-medium">Fait marquant</span> · {event.title}
      {event.category && <span className="text-sm text-muted-foreground"> · {EVENT_CATEGORIES[event.category]}</span>}
    </p>
  );
}

// ─── Forms in place ───────────────────────────────────────────────────────────

/**
 * « Ajouter une mesure »: date (any, before the follow-up too), what was measured, the value and an
 * optional note. It stays open with the same date, to enter a weight history quickly.
 */
function AddMeasurement({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [date, setDate] = useState(todayISO);
  const [type, setType] = useState<MetricType>('WEIGHT');
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const value = parseDecimal(raw);
  const create = usePatientFileMutation(patientId, () => ({
    method: 'post',
    url: `/patients/${patientId}/measurements`,
    body: { type, value, measuredAt: date, note: note.trim() || undefined },
  }));

  const submit = () =>
    value !== null &&
    create.mutate(undefined, {
      onSuccess: () => {
        toast({ title: `Mesure ajoutée : ${METRICS[type].label.toLowerCase()} du ${formatLongDate(date)}` });
        setRaw('');
        setNote('');
      },
      onError: (error: unknown) =>
        toast({
          title: 'Mesure refusée',
          description: apiMessage(error) ?? 'Vérifiez la valeur saisie.',
          variant: 'destructive',
        }),
    });

  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/40 p-4"
      aria-label="Ajouter une mesure"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr_9rem]">
        <Field label="Date" hint="Même ancienne">
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Mesure">
          <select value={type} onChange={(e) => setType(e.target.value as MetricType)} className={fieldClass}>
            {ALL_METRICS.map((t) => (
              <option key={t} value={t}>
                {METRICS[t].label} ({METRICS[t].unit})
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Valeur (${METRICS[type].unit})`}>
          <Input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} autoFocus />
        </Field>
      </div>
      <Field label="Note" hint="Facultative, par exemple « avant sa grossesse », « pendant le traitement »">
        <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Terminer
        </Button>
        <Button type="submit" disabled={value === null || !date || create.isPending}>
          Enregistrer la mesure
        </Button>
      </div>
    </form>
  );
}

/** Corrects a measurement in its row: value, date (a séance's is its date) and note. */
function EditMeasurement({
  patientId,
  measurement: m,
  onDone,
}: {
  patientId: string;
  measurement: TimelineMeasurement;
  onDone: () => void;
}) {
  const [date, setDate] = useState(m.measuredAt.slice(0, 10));
  const [raw, setRaw] = useState(String(m.value).replace('.', ','));
  const [note, setNote] = useState(m.note ?? '');
  const value = parseDecimal(raw);
  const update = usePatientFileMutation(patientId, () => ({
    method: 'patch',
    url: `/patients/${patientId}/measurements/${m.id}`,
    body: { value, note: note.trim() || null, ...(m.session ? {} : { measuredAt: date }) },
  }));
  const save = () =>
    value !== null &&
    update.mutate(undefined, {
      onSuccess: onDone,
      onError: (error: unknown) =>
        toast({ title: 'Correction refusée', description: apiMessage(error) ?? 'Vérifiez la valeur saisie.', variant: 'destructive' }),
    });

  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/40 p-4"
      aria-label={`Corriger : ${METRICS[m.type].label}`}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[11rem_9rem_1fr]">
        <Field label="Date" hint={m.session ? `Celle de la séance « ${sessionName(m.session.sequence)} »` : undefined}>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} disabled={!!m.session} />
        </Field>
        <Field label={`${METRICS[m.type].label} (${METRICS[m.type].unit})`}>
          <Input inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} autoFocus />
        </Field>
        <Field label="Note">
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={value === null || update.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** Corrects a life event in its row. */
function EditEvent({ patientId, event, onDone }: { patientId: string; event: LifeEvent; onDone: () => void }) {
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [title, setTitle] = useState(event.title);
  const [category, setCategory] = useState<LifeEventCategory | ''>(event.category ?? '');
  const update = usePatientFileMutation(patientId, () => ({
    method: 'patch',
    url: `/patients/${patientId}/life-events/${event.id}`,
    body: { date, title: title.trim(), category: category || null },
  }));

  return (
    <form
      className="space-y-3 rounded-xl border bg-muted/40 p-4"
      aria-label="Corriger le fait marquant"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(undefined, {
          onSuccess: onDone,
          onError: () => toast({ title: 'La correction n’a pas été enregistrée. Réessayez.', variant: 'destructive' }),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr_12rem]">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Ce qui s’est passé">
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Catégorie">
          <select value={category} onChange={(e) => setCategory(e.target.value as LifeEventCategory | '')} className={fieldClass}>
            <option value="">Sans catégorie</option>
            {(Object.keys(EVENT_CATEGORIES) as LifeEventCategory[]).map((c) => (
              <option key={c} value={c}>
                {EVENT_CATEGORIES[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={!title.trim() || !date || update.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** The API's explanation of a refusal (« Valeur hors limites… »), if any. */
function apiMessage(error: unknown): string | undefined {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' ? message : Array.isArray(message) ? message.join(' ') : undefined;
}
