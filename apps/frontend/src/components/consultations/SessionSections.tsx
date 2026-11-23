import { ChevronDown, Flag, NotebookPen, Ruler, Scale, Trash2, Utensils } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { useAutosave } from '../../hooks/useAutosave';
import { apiErrorMessage, useFormulas, usePractices, useShowPractices } from '../../hooks/useMe';
import api from '../../lib/api';
import { formatAmount } from '../../lib/invoice-document';
import {
  type Consultation,
  EVENT_CATEGORIES,
  FILE_FIELD_TYPES,
  FILE_FIELDS,
  type FileField,
  formatDelta,
  type MetricType,
  missingMessage,
  PAYMENT_METHODS,
  type PaymentMethod,
  useFileSections,
  useInvalidatePatientFile,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { cn, formatLongDate, formatNumber } from '../../lib/utils';
import { SessionDiscount, SessionSplit } from '../invoices/SessionDiscount';
import { AdultFormulaNote, BmiBadge } from '../patient-file/BmiBadge';
import { FileSectionCard, FileSectionEditor } from '../patient-file/FilePanel';
import { fieldClass, LifeEventForm } from '../patient-file/LifeEventForm';
import { Field } from '../shared/Field';
import { SaveIndicator } from '../shared/SaveIndicator';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

import { MeasureField } from './SessionInputs';

// ─── Header line: date, formula, payment ──────────────────────────────────────

/** "2026-11-20" in local time, for a date input. */
const dayValue = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type HeaderChange = { date?: string; formulaId?: string | null; paymentMethod?: PaymentMethod; practiceId?: string };

/**
 * The first columns of her row: date, formula (« Bilan », then « Suivi », or the type of the
 * appointment, prefilled when the séance is started), practice (only when she has several: its
 * address goes on the invoice) and payment method (prefilled with the patient's last one). Then
 * the discount and who pays what (lot 16). What the invoice shows.
 */
export function SessionHeaderFields({ session }: { session: Consultation }) {
  const invalidate = useInvalidatePatientFile();
  const { data: formulas = [] } = useFormulas();
  const offered = formulas.filter((f) => !f.archivedAt);
  // Where it took place: its address goes on the invoice. Only asked when she has several.
  const showPractice = useShowPractices();
  const { data: practices = [] } = usePractices(showPractice);
  const activePractices = practices.filter((p) => !p.archivedAt);
  const [error, setError] = useState<string>();
  const autosave = useAutosave(async (body: HeaderChange) => {
    try {
      await api.patch(`/consultations/${session.id}`, body);
      setError(undefined);
    } catch (e) {
      setError(apiErrorMessage(e, 'Le changement n’a pas été enregistré. Réessayez.'));
      throw e;
    }
    invalidate(session.patientId);
  }, 0);
  const save = (body: HeaderChange) => {
    autosave.schedule(body);
    void autosave.flush();
  };

  const changeDay = (day: string) => {
    if (!day) return;
    // Keeps the séance's time, changes its day
    const [year, month, date] = day.split('-').map(Number);
    const next = new Date(session.date);
    next.setFullYear(year, month - 1, date);
    save({ date: next.toISOString() });
  };

  return (
    <div className="space-y-2 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        <Field label="Date">
          <input
            type="date"
            className={fieldClass}
            value={dayValue(session.date)}
            onChange={(e) => changeDay(e.target.value)}
          />
        </Field>
        <Field label="Formule">
          <select
            className={fieldClass}
            value={session.formulaId ?? ''}
            onChange={(e) => save({ formulaId: e.target.value || null })}
          >
            <option value="">Choisir…</option>
            {session.formulaId && !offered.some((f) => f.id === session.formulaId) && (
              <option value={session.formulaId}>{session.formulaLabel}</option>
            )}
            {offered.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
                {f.priceCents !== null && ` · ${formatAmount(f.priceCents)}`}
              </option>
            ))}
          </select>
        </Field>
        {showPractice && (
          <Field label="Cabinet">
            <select
              className={fieldClass}
              value={session.practiceId ?? ''}
              onChange={(e) => e.target.value && save({ practiceId: e.target.value })}
            >
              {!session.practiceId && <option value="">Choisir…</option>}
              {session.practiceId && !activePractices.some((p) => p.id === session.practiceId) && (
                <option value={session.practiceId}>{session.practice?.name ?? 'Cabinet archivé'}</option>
              )}
              {activePractices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Moyen de paiement">
          <select
            className={fieldClass}
            value={session.paymentMethod}
            onChange={(e) => save({ paymentMethod: e.target.value as PaymentMethod })}
          >
            {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHODS[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : (
        <SaveIndicator state={autosave.state} />
      )}
      {session.priceCents !== null && (
        <div className="space-y-3 border-t pt-3">
          <SessionDiscount session={session} />
          <SessionSplit session={session} />
        </div>
      )}
    </div>
  );
}

// ─── Weight and figures ───────────────────────────────────────────────────────

/**
 * Her weight column, then what her sheet computed from it: BMI, BMR in MJ and in kcal (by the
 * API, § 3.1), in big tiles, with the change since the last séance and since the bilan.
 */
export function WeightSection({ session }: { session: Consultation }) {
  const { bmi, bmr, missing } = session.figures;
  const { sincePrevious, sinceFirst } = session.weightChange;
  const needsHeight = missing.includes('height');
  const bmrMissing = !needsHeight && !missing.includes('weight') ? missingMessage(missing, 'bmr') : null;

  return (
    <Section icon={Scale} area="patients" title="Poids">
      <div className="grid gap-5 @2xl:grid-cols-[minmax(11rem,14rem)_1fr]">
        <div className="space-y-3">
          <MeasureField session={session} type="WEIGHT" large />
          {(sincePrevious !== null || sinceFirst !== null) && (
            <ul className="space-y-1 text-base" aria-label="Écarts de poids">
              {sincePrevious !== null && <Delta value={sincePrevious} label="depuis la dernière séance" />}
              {sinceFirst !== null && session.sequence > 0 && <Delta value={sinceFirst} label="depuis le bilan" />}
            </ul>
          )}
          {needsHeight && (
            <MeasureField session={session} type="HEIGHT" hint="Pour calculer l’IMC et le MB." />
          )}
        </div>
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-2 @lg:gap-3" aria-live="polite">
            <Tile label="IMC" value={bmi ? formatNumber(bmi.value) : null}>
              <BmiBadge bmi={bmi} short />
            </Tile>
            <Tile label="MB (MJ/jour)" value={bmr ? formatNumber(bmr.mj) : null}>
              {bmr?.adultFormulaForMinor && <AdultFormulaNote bmr={bmr} />}
            </Tile>
            <Tile label="MB (kcal/jour)" value={bmr ? formatNumber(bmr.kcal, 1) : null}>
              {bmr?.adultFormulaForMinor && <AdultFormulaNote bmr={bmr} />}
            </Tile>
          </dl>
          {needsHeight && <p className="text-base text-muted-foreground">Ajoutez la taille pour calculer l’IMC et le MB.</p>}
          {bmrMissing && (
            <p className="text-base text-muted-foreground">
              {bmrMissing} :{' '}
              <Link
                to={`/patients/${session.patientId}?onglet=dossier`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                compléter le dossier
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function Delta({ value, label }: { value: number; label: string }) {
  return (
    <li>
      <span className="font-semibold tabular-nums">{formatDelta('WEIGHT', value)}</span>{' '}
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}

function Tile({ label, value, children }: { label: string; value: string | null; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-background px-3 py-3 @lg:px-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums @xl:text-3xl">{value ?? '—'}</dd>
      {children && <dd className="mt-1">{children}</dd>}
    </div>
  );
}

// ─── Aversions and tastes ─────────────────────────────────────────────────────

const SESSION_FIELDS: FileField[] = ['AVERSIONS', 'TASTES'];

/**
 * The patient's « Aversions » and « Goûts » sections, filled with what is known: she completes them
 * here, the version is linked to the séance (the file keeps the history).
 */
export function AversionsAndTastes({ session }: { session: Consultation }) {
  const { data: sections = [], isSuccess } = useFileSections(session.patientId);
  return (
    <Section icon={Utensils} area="patients" title="Aversions · Goûts">
      {isSuccess && (
        <div className="grid gap-5 @2xl:grid-cols-2">
          {SESSION_FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <p id={`session-file-${field}`} className="text-base font-medium">
                {FILE_FIELDS[field]}
              </p>
              <FileSectionEditor
                patientId={session.patientId}
                field={field}
                current={sections.find((s) => s.field === field)?.current?.content ?? ''}
                consultationId={session.id}
                labelledBy={`session-file-${field}`}
              />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Further ──────────────────────────────────────────────────────────────────

const EXTRA_METRICS: MetricType[] = ['WAIST', 'HIP', 'BODY_FAT', 'MUSCLE_MASS'];
const OTHER_FIELDS = FILE_FIELD_TYPES.filter((f) => !SESSION_FIELDS.includes(f));

/** « Pour aller plus loin », folded: extra measurements, a life event, the rest of the medical file. */
export function SessionFurther({ session }: { session: Consultation }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card shadow-sm">
      <CollapsibleTrigger className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-5 py-3 text-left text-xl font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
        <span>
          Pour aller plus loin
          <span className="block text-sm font-normal text-muted-foreground">
            Mesures complémentaires, fait marquant, dossier médical
          </span>
        </span>
        <ChevronDown className={cn('size-6 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <Section size="compact" icon={Ruler} area="patients" title="Mesures complémentaires">
          <div className="grid grid-cols-2 gap-4">
            {EXTRA_METRICS.map((type) => (
              <MeasureField key={type} session={session} type={type} />
            ))}
          </div>
        </Section>
        <SessionEvents session={session} />
        <FileSections session={session} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SessionEvents({ session }: { session: Consultation }) {
  const events = session.lifeEvents ?? [];
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/life-events/${id}`,
  }));
  return (
    <Section size="compact" icon={Flag} area="patients" title="Fait marquant" description="Il annote la courbe de poids.">
      <div className="space-y-4">
        {events.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="text-base">
                  <span className="text-muted-foreground">{formatLongDate(e.date, true)}</span> · {e.title}
                  {e.category && <span className="text-sm text-muted-foreground"> ({EVENT_CATEGORIES[e.category]})</span>}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Retirer « ${e.title} »`}
                  onClick={() => remove.mutate(e.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <LifeEventForm patientId={session.patientId} consultationId={session.id} />
      </div>
    </Section>
  );
}

function FileSections({ session }: { session: Consultation }) {
  const { data: sections = [], isSuccess } = useFileSections(session.patientId);
  if (!isSuccess) return null;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-medium">
        <NotebookPen className="size-5 text-area-patients" aria-hidden /> Dossier médical
      </h3>
      <div className="grid gap-4 @3xl:grid-cols-2">
        {OTHER_FIELDS.map((field) => (
          <FileSectionCard
            key={field}
            patientId={session.patientId}
            field={field}
            section={sections.find((s) => s.field === field)}
            consultationId={session.id}
          />
        ))}
      </div>
    </div>
  );
}
