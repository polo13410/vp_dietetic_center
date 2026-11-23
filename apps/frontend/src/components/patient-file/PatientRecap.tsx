import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckSquare,
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
import { Link } from 'react-router';

import {
  type Brief,
  FILE_ANCHORS,
  type FileField,
  fileFieldAnchor,
  formatDelta,
  formatMetric,
  missingMessage,
  type PatientTab,
  patientTabLink,
  sessionName,
  useLifeEvents,
  useMeasurements,
  usePatientBrief,
} from '../../lib/patient-file';
import { cn, formatLongDate, formatNumber, formatTime } from '../../lib/utils';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-screen';

import { AdultFormulaNote, BmiBadge } from './BmiBadge';
import { MetricsChart } from './MetricsChart';

export type RecapSize = 'page' | 'panel';

interface PatientRecapProps {
  patientId: string;
  /**
   * `page`: the « Récapitulatif » tab, three columns on a wide screen. `panel`: one narrow column,
   * the « Rappel » beside a session (lot 7).
   */
  size?: RecapSize;
  /**
   * The patient's file: each block gets a « Modifier » link to the tab that owns its data, at its
   * place (« ?onglet=mesures#poids »). The summary itself is never edited.
   */
  links?: boolean;
  /** Extra content under the summary, page size only (reports to the GP) */
  children?: ReactNode;
  /** Beside a session: the summary as it was before it (its own weight and texts left out) */
  beforeSessionId?: string;
}

/** Builds the « Modifier » links of the blocks, or none outside the patient's file. */
type EditLink = (tab: PatientTab, anchor: string, label: string) => ReactNode;

/**
 * Everything on her Numbers sheet that matters before and during a session, on one screen, read
 * only: allergies, identity and contact, key figures with the weight curve, the last session's
 * advice, aversions and tastes, and what is left to do.
 */
export function PatientRecap({ patientId, size = 'page', links, children, beforeSessionId }: PatientRecapProps) {
  const { data: brief, isLoading } = usePatientBrief(patientId, beforeSessionId);
  if (isLoading) return <LoadingSpinner />;
  if (!brief) return null;
  const page = size === 'page';
  const edit: EditLink | undefined = links
    ? (tab, anchor, label) => <EditLinkButton to={patientTabLink(patientId, tab, anchor)} label={label} />
    : undefined;

  return (
    <div className="space-y-4" data-size={size}>
      <Allergies brief={brief} edit={edit} />
      <div className={cn('grid gap-4', page && 'md:grid-cols-2 lg:grid-cols-3')}>
        <IdentityCard brief={brief} edit={edit} />
        <KeyFigures brief={brief} edit={edit} />
        <div className={cn('space-y-4', page && 'md:col-span-2 lg:col-span-1')}>
          <LastSession brief={brief} size={size} />
          <AversionsAndTastes brief={brief} edit={edit} />
          {page && <ToDo brief={brief} edit={edit} />}
        </div>
      </div>
      {page && children}
    </div>
  );
}

/** « Modifier », a link to where the data is edited. */
function EditLinkButton({ to, label }: { to: string; label: string }) {
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to={to} aria-label={label}>
        <Pencil aria-hidden /> Modifier
      </Link>
    </Button>
  );
}

// ─── Allergies ────────────────────────────────────────────────────────────────

function Allergies({ brief, edit }: { brief: Brief; edit?: EditLink }) {
  const allergies = fileText(brief, 'ALLERGIES');
  const link = edit?.('dossier', fileFieldAnchor('ALLERGIES'), 'Modifier les allergies');
  if (!allergies) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-2">
        <p className="flex min-h-11 items-center gap-2 text-base text-muted-foreground">
          <AlertTriangle className="size-5" aria-hidden /> Allergies non renseignées
        </p>
        {link}
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
      <p className="flex-1 text-base">
        <strong className="font-semibold">Allergies :</strong>{' '}
        <span className="whitespace-pre-line">{allergies}</span>
      </p>
      {link && <div className="-my-1.5 shrink-0">{link}</div>}
    </div>
  );
}

// ─── Identity ─────────────────────────────────────────────────────────────────

function IdentityCard({ brief, edit }: { brief: Brief; edit?: EditLink }) {
  const { patient } = brief;

  return (
    <Section
      size="compact"
      icon={UserRound}
      area="patients"
      title="Patient"
      action={edit?.('dossier', FILE_ANCHORS.identity, 'Modifier l’identité et le contact')}
      className="h-full"
    >
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

function KeyFigures({ brief, edit }: { brief: Brief; edit?: EditLink }) {
  const { data: measurements = [] } = useMeasurements(brief.patient.id);
  const { data: events = [] } = useLifeEvents(brief.patient.id);
  const weight = brief.metrics.find((m) => m.type === 'WEIGHT');
  const start = brief.weightAtStart;
  const change = weight && start && start.measuredAt !== weight.latest.measuredAt ? weight.latest.value - start.value : null;
  const messages = [missingMessage(brief.missing, 'bmi'), missingMessage(brief.missing, 'bmr')].filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i,
  );
  // Sex and age are on the medical file; a height or a weight is a measurement
  const toComplete = brief.missing.some((m) => m === 'sex' || m === 'age')
    ? edit?.('dossier', FILE_ANCHORS.baseMeasures, 'Compléter l’âge, le sexe et la taille')
    : edit?.('mesures', FILE_ANCHORS.timeline, 'Ajouter une mesure');

  return (
    <Section
      size="compact"
      icon={Scale}
      area="patients"
      title="Chiffres clés"
      action={edit?.('mesures', FILE_ANCHORS.weight, 'Modifier les mesures')}
      className="h-full"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Poids" value={weight ? formatMetric('WEIGHT', weight.latest.value) : null} />
          <Tile label="IMC" value={brief.bmi.current ? formatNumber(brief.bmi.current.value) : null}>
            <BmiBadge bmi={brief.bmi.current} short />
          </Tile>
          <Tile label="MB (MJ/jour)" value={brief.bmr ? formatNumber(brief.bmr.mj) : null}>
            <AdultFormulaNote bmr={brief.bmr} />
          </Tile>
          <Tile label="MB (kcal/jour)" value={brief.bmr ? formatNumber(brief.bmr.kcal, 1) : null}>
            <AdultFormulaNote bmr={brief.bmr} />
          </Tile>
        </div>
        {change !== null && start && (
          <p className="text-base">
            <span className="font-semibold tabular-nums">{formatDelta('WEIGHT', change)}</span>{' '}
            <span className="text-muted-foreground">
              depuis {brief.consultationCount > 0 ? 'le bilan' : 'la première pesée'} ({formatNumber(start.value, 1)} kg)
            </span>
          </p>
        )}
        {messages.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
            <p className="text-sm text-muted-foreground">{messages.join('. ')}.</p>
            {toComplete}
          </div>
        )}
        {weight ? (
          <MetricsChart measurements={measurements} events={events} types={['WEIGHT']} className="h-32" />
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

function AversionsAndTastes({ brief, edit }: { brief: Brief; edit?: EditLink }) {
  return (
    <Section
      size="compact"
      icon={Utensils}
      area="patients"
      title="Aversions et goûts"
      action={edit?.('dossier', fileFieldAnchor('AVERSIONS'), 'Modifier les aversions et goûts')}
    >
      <div className="space-y-3">
        <TextBlock label="Aversions">{fileText(brief, 'AVERSIONS') || <NotFilled />}</TextBlock>
        <TextBlock label="Goûts">{fileText(brief, 'TASTES') || <NotFilled />}</TextBlock>
      </div>
    </Section>
  );
}

// ─── What is left to do ───────────────────────────────────────────────────────

/** The patient's open tasks, read only; they are ticked off in the « Suivi » tab. */
function ToDo({ brief, edit }: { brief: Brief; edit?: EditLink }) {
  const tasks = brief.openTasks;
  return (
    <Section
      size="compact"
      icon={CheckSquare}
      area="patients"
      title="À faire"
      action={edit?.('suivi', FILE_ANCHORS.tasks, 'Modifier les tâches de ce patient')}
    >
      {tasks.length === 0 ? (
        <p className="text-base text-muted-foreground">Rien à faire pour ce patient.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li key={task.id} className="text-base">
              {task.title}
              {task.dueAt && (
                <span className="text-sm text-muted-foreground"> · avant le {formatLongDate(task.dueAt, true)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
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
