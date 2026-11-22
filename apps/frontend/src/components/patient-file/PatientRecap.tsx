import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  History,
  type LucideIcon,
  Mail,
  Pencil,
  Phone,
  Scale,
  Stethoscope,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  type Brief,
  type FileField,
  formatDelta,
  formatMetric,
  missingMessage,
  sessionName,
  useLifeEvents,
  useMeasurements,
  usePatient,
  usePatientBrief,
} from '../../lib/patient-file';
import { cn, formatLongDate, formatNumber, formatTime } from '../../lib/utils';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-screen';

import { BmiBadge } from './BmiBadge';
import { MetricsChart } from './MetricsChart';
import { PatientIdentityForm } from './PatientIdentityForm';

export type RecapSize = 'page' | 'panel';

interface PatientRecapProps {
  patientId: string;
  /**
   * `page`: the « Récapitulatif » tab, three columns on a wide screen. `panel`: one narrow column,
   * the « Rappel » beside a session (lot 7).
   */
  size?: RecapSize;
  /** Identity and contact can be edited in place (the practitioner's file, page size) */
  editable?: boolean;
  /** Opens the medical file (to add what is missing, or change aversions and tastes) */
  onOpenFile?: () => void;
  /** Extra content under the summary, page size only (« Pour aller plus loin ») */
  children?: ReactNode;
}

/**
 * Everything on her Numbers sheet that matters before and during a session, on one screen:
 * allergies, identity and contact, key figures with the weight curve, the last session's advice,
 * aversions and tastes.
 */
export function PatientRecap({ patientId, size = 'page', editable, onOpenFile, children }: PatientRecapProps) {
  const { data: brief, isLoading } = usePatientBrief(patientId);
  const [editing, setEditing] = useState(false);
  if (isLoading) return <LoadingSpinner />;
  if (!brief) return null;
  const page = size === 'page';

  return (
    <div className="space-y-4" data-size={size}>
      <Allergies brief={brief} onOpenFile={onOpenFile} />
      <div className={cn('grid gap-4', page && 'md:grid-cols-2 lg:grid-cols-3')}>
        <div className={cn(page && editing && 'md:col-span-2 lg:col-span-3')}>
          <IdentityCard
            brief={brief}
            editable={editable && page}
            editing={editing}
            onEditingChange={setEditing}
          />
        </div>
        <KeyFigures brief={brief} onOpenFile={onOpenFile} />
        <div className={cn('space-y-4', page && 'md:col-span-2 lg:col-span-1')}>
          <LastSession brief={brief} size={size} />
          <AversionsAndTastes brief={brief} onOpenFile={onOpenFile} />
        </div>
      </div>
      {page && children}
    </div>
  );
}

// ─── Allergies ────────────────────────────────────────────────────────────────

function Allergies({ brief, onOpenFile }: { brief: Brief; onOpenFile?: () => void }) {
  const allergies = fileText(brief, 'ALLERGIES');
  if (!allergies) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-2">
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <AlertTriangle className="size-5" aria-hidden /> Allergies non renseignées
        </p>
        {onOpenFile && (
          <Button size="sm" variant="ghost" onClick={onOpenFile}>
            Compléter
          </Button>
        )}
      </div>
    );
  }
  return (
    <div
      role="note"
      aria-label="Allergies"
      className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-danger"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-base">
        <strong className="font-semibold">Allergies :</strong>{' '}
        <span className="whitespace-pre-line">{allergies}</span>
      </p>
    </div>
  );
}

// ─── Identity ─────────────────────────────────────────────────────────────────

function IdentityCard({
  brief,
  editable,
  editing,
  onEditingChange,
}: {
  brief: Brief;
  editable?: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const { patient } = brief;
  const { data: full } = usePatient(editable ? patient.id : undefined);
  const action =
    editable &&
    (editing ? (
      <Button size="sm" variant="outline" onClick={() => onEditingChange(false)}>
        <Check aria-hidden /> Terminer
      </Button>
    ) : (
      <Button size="sm" variant="ghost" onClick={() => onEditingChange(true)}>
        <Pencil aria-hidden /> Modifier
      </Button>
    ));

  return (
    <Section size="compact" icon={UserRound} area="patients" title="Patient" action={action} className="h-full">
      {editing && full ? (
        <PatientIdentityForm patient={full} />
      ) : (
        <div className="space-y-3">
          <dl className="space-y-1.5">
            <Row icon={UserRound} label="Âge et sexe">
              {[ageLabel(brief), sexLabel(patient.sex)].filter(Boolean).join(' · ') || null}
            </Row>
            <Row icon={Phone} label="Téléphone">
              {patient.phone && (
                <a
                  href={`tel:${patient.phone.replace(/[^\d+]/g, '')}`}
                  className="-my-2 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                >
                  {patient.phone}
                </a>
              )}
            </Row>
            <Row icon={Mail} label="E-mail">
              {patient.email && (
                <a
                  href={`mailto:${patient.email}`}
                  className="-my-2 inline-flex min-h-11 items-center break-all text-primary underline-offset-4 hover:underline"
                >
                  {patient.email}
                </a>
              )}
            </Row>
            <Row icon={Users} label="Situation familiale">
              {patient.familySituation}
            </Row>
            <Row icon={Briefcase} label="Profession">
              {patient.profession}
            </Row>
            <Row icon={Stethoscope} label="Médecin traitant">
              {patient.gpName && (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {patient.gpName}
                  <GpReportStatus brief={brief} />
                </span>
              )}
            </Row>
            <Row icon={CalendarDays} label="Prochain rendez-vous">
              {brief.nextAppointment &&
                `${formatLongDate(brief.nextAppointment.startAt, true)} à ${formatTime(brief.nextAppointment.startAt)}`}
            </Row>
          </dl>
          {patient.consultationReason && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-muted-foreground">Motif</p>
              <p className="whitespace-pre-line leading-relaxed">{patient.consultationReason}</p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/** One line of the identity card: the icon stands for the label, which screen readers still read. */
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="pt-0.5 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 text-base">
        {children || <span className="text-muted-foreground">{label} : non renseigné</span>}
      </dd>
    </div>
  );
}

function GpReportStatus({ brief }: { brief: Brief }) {
  const report = brief.latestGpReport;
  if (!report) return null;
  if (report.status === 'DRAFT') return <StatusBadge status="GP_REPORT_DRAFT" tone="warning" label="Compte rendu : à faire" />;
  return (
    <StatusBadge
      status="GP_REPORT_SENT"
      tone="success"
      label={`Compte rendu envoyé le ${formatLongDate(report.sentAt ?? report.date, true)}`}
    />
  );
}

// ─── Key figures and weight curve ─────────────────────────────────────────────

function KeyFigures({ brief, onOpenFile }: { brief: Brief; onOpenFile?: () => void }) {
  const { data: measurements = [] } = useMeasurements(brief.patient.id);
  const { data: events = [] } = useLifeEvents(brief.patient.id);
  const weight = brief.metrics.find((m) => m.type === 'WEIGHT');
  const change = weight && weight.count > 1 ? weight.latest.value - weight.first.value : null;
  const messages = [missingMessage(brief.missing, 'bmi'), missingMessage(brief.missing, 'bmr')].filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i,
  );

  return (
    <Section size="compact" icon={Scale} area="patients" title="Chiffres clés" className="h-full">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Poids" value={weight ? formatMetric('WEIGHT', weight.latest.value) : null} />
          <Tile label="IMC" value={brief.bmi.current ? formatNumber(brief.bmi.current.value) : null}>
            <BmiBadge bmi={brief.bmi.current} short />
          </Tile>
          <Tile label="MB (MJ/jour)" value={brief.bmr ? formatNumber(brief.bmr.mj) : null} />
          <Tile label="MB (kcal/jour)" value={brief.bmr ? formatNumber(brief.bmr.kcal, 1) : null} />
        </div>
        {change !== null && weight && (
          <p className="text-base">
            <span className="font-semibold tabular-nums">{formatDelta('WEIGHT', change)}</span>{' '}
            <span className="text-muted-foreground">
              depuis {brief.consultationCount > 0 ? 'le bilan' : 'la première pesée'} ({formatNumber(weight.first.value, 1)} kg)
            </span>
          </p>
        )}
        {messages.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
            <p className="text-sm text-muted-foreground">{messages.join('. ')}.</p>
            {onOpenFile && (
              <Button size="sm" variant="link" className="h-auto min-h-11 px-0" onClick={onOpenFile}>
                Compléter le dossier
              </Button>
            )}
          </div>
        )}
        {weight ? (
          <MetricsChart
            measurements={measurements}
            events={events}
            types={['WEIGHT']}
            className="h-32"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Aucune pesée pour l’instant : la courbe apparaîtra à la première séance.</p>
        )}
      </div>
    </Section>
  );
}

function Tile({ label, value, children }: { label: string; value: string | null; children?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value ?? '—'}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

// ─── Last session ─────────────────────────────────────────────────────────────

function LastSession({ brief, size }: { brief: Brief; size: RecapSize }) {
  const last = brief.lastConsultation;
  return (
    <Section
      size="compact"
      icon={History}
      area="patients"
      title="Dernière séance"
      description={last && `${sessionName(brief.consultationCount - 1)} · ${formatLongDate(last.date, true)}`}
      action={
        last &&
        size === 'page' && (
          <Button size="icon" variant="ghost" asChild>
            <Link to={`/consultations/${last.id}`} aria-label="Ouvrir la dernière séance">
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        )
      }
    >
      {!last ? (
        <p className="text-base text-muted-foreground">Aucune séance pour l’instant.</p>
      ) : (
        <div className="space-y-3">
          {size === 'panel' && last.sessionWork && (
            <TextBlock label="Travail en consultation">{last.sessionWork}</TextBlock>
          )}
          <TextBlock label="Conseils diététiques">
            {last.advice || <span className="text-muted-foreground">Aucun conseil noté.</span>}
          </TextBlock>
        </div>
      )}
    </Section>
  );
}

// ─── Aversions and tastes ─────────────────────────────────────────────────────

function AversionsAndTastes({ brief, onOpenFile }: { brief: Brief; onOpenFile?: () => void }) {
  return (
    <Section
      size="compact"
      icon={Utensils}
      area="patients"
      title="Aversions et goûts"
      action={
        onOpenFile && (
          <Button size="icon" variant="ghost" onClick={onOpenFile} aria-label="Modifier les aversions et goûts">
            <Pencil aria-hidden />
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <TextBlock label="Aversions">{fileText(brief, 'AVERSIONS') || <NotFilled />}</TextBlock>
        <TextBlock label="Goûts">{fileText(brief, 'TASTES') || <NotFilled />}</TextBlock>
      </div>
    </Section>
  );
}

function TextBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="whitespace-pre-line leading-relaxed">{children}</div>
    </div>
  );
}

function NotFilled() {
  return <span className="text-muted-foreground">Non renseigné</span>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileText(brief: Brief, field: FileField): string | null {
  return brief.file.find((s) => s.field === field)?.current?.content || null;
}

/** « 56 ans », « 56 ans (âge déclaré) » when only the age was known (§ 3.1). */
export function ageLabel(brief: Pick<Brief, 'patient'>): string | null {
  const { age, birthDateEstimated } = brief.patient;
  if (age === null) return null;
  return `${age} ans${birthDateEstimated ? ' (âge déclaré)' : ''}`;
}

export function sexLabel(sex: 'F' | 'M' | null): string | null {
  return sex === 'F' ? 'Femme' : sex === 'M' ? 'Homme' : null;
}
