import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckSquare,
  Flag,
  History,
  Sparkles,
  Target,
  Utensils,
} from 'lucide-react';
import type { ReactNode } from 'react';

import {
  type Brief,
  EVENT_CATEGORIES,
  formatDelta,
  formatMetric,
  GOAL_STATUSES,
  METRICS,
  type MetricSummary,
  TOPICS,
  usePatientBrief,
} from '../../lib/patient-file';
import { cn, formatDate, formatDateTime } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../ui/loading-screen';

import { BmiBadge } from './BmiBadge';

/**
 * What to know before seeing the patient: alerts, why they came, how the last session went,
 * how their measurements moved, the goals to review and what happened in their life since.
 */
export function PatientBrief({ patientId, compact }: { patientId: string; compact?: boolean }) {
  const { data: brief, isLoading } = usePatientBrief(patientId);
  if (isLoading) return <LoadingSpinner />;
  if (!brief) return null;

  return (
    <div className={cn('grid gap-4', !compact && 'lg:grid-cols-2')}>
      <div className="space-y-4">
        <Alerts brief={brief} />
        <FollowUp brief={brief} />
        <LastSession brief={brief} />
        <OpenGoals brief={brief} />
      </div>
      <div className="space-y-4">
        <Measurements brief={brief} />
        <RecentEvents brief={brief} />
        <CurrentTopics brief={brief} />
        <OpenTasks brief={brief} />
      </div>
    </div>
  );
}

function Section({ icon, title, children, aside }: { icon: ReactNode; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Alerts({ brief }: { brief: Brief }) {
  const { allergies, dietaryRestrictions } = brief.patient;
  if (!allergies && !dietaryRestrictions) return null;
  return (
    <div className="space-y-2">
      {allergies && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Allergies :</strong> {allergies}
          </span>
        </div>
      )}
      {dietaryRestrictions && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <Utensils className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Régime :</strong> {dietaryRestrictions}
          </span>
        </div>
      )}
    </div>
  );
}

function FollowUp({ brief }: { brief: Brief }) {
  const { consultationCount, firstConsultationAt, nextAppointment, patient } = brief;
  return (
    <Section icon={<CalendarClock />} title="Suivi">
      {patient.consultationReason && (
        <p className="text-sm mb-3">
          <span className="text-muted-foreground">Motif : </span>
          {patient.consultationReason}
        </p>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <strong>{consultationCount}</strong> séance{consultationCount > 1 ? 's' : ''}
          {firstConsultationAt && (
            <span className="text-muted-foreground"> depuis le {formatDate(firstConsultationAt)}</span>
          )}
        </span>
        <span className="text-muted-foreground">
          Prochain RDV :{' '}
          <span className="text-foreground">
            {nextAppointment ? formatDateTime(nextAppointment.startAt) : 'aucun'}
          </span>
        </span>
      </div>
    </Section>
  );
}

function LastSession({ brief }: { brief: Brief }) {
  const last = brief.lastConsultation;
  return (
    <Section
      icon={<History />}
      title="Dernière séance"
      aside={last && <span className="text-xs text-muted-foreground">{formatDate(last.date)}</span>}
    >
      {!last ? (
        <Empty>Première séance : rien d’enregistré pour l’instant.</Empty>
      ) : (
        <div className="space-y-3 text-sm">
          {last.summary && <p className="whitespace-pre-line">{last.summary}</p>}
          {last.advice && (
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Conseils donnés</p>
              <p className="whitespace-pre-line">{last.advice}</p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function OpenGoals({ brief }: { brief: Brief }) {
  return (
    <Section icon={<Target />} title="Objectifs à revoir">
      {brief.openGoals.length === 0 ? (
        <Empty>Aucun objectif en cours.</Empty>
      ) : (
        <ul className="space-y-2">
          {brief.openGoals.map((goal) => {
            const last = goal.reviews[0];
            const status = GOAL_STATUSES[goal.status];
            return (
              <li key={goal.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>{goal.title}</p>
                  {last?.comment && <p className="text-xs text-muted-foreground">« {last.comment} »</p>}
                </div>
                <Badge variant="outline" className={cn(status.className, 'shrink-0')}>
                  {status.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** Weight-like values: going down is shown as a decrease, without judging if it is good. */
function Delta({ metric, from, label }: { metric: MetricSummary; from: { value: number } | null; label: string }) {
  if (!from) return null;
  const delta = metric.latest.value - from.value;
  const Icon = Math.abs(delta) < 0.05 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={label}>
      <Icon className="h-3 w-3" />
      {formatDelta(metric.type, delta)} <span className="opacity-70">{label}</span>
    </span>
  );
}

function Measurements({ brief }: { brief: Brief }) {
  const { metrics, bmi } = brief;
  return (
    <Section
      icon={<Sparkles />}
      title="Mesures"
      aside={<BmiBadge bmi={bmi.current} />}
    >
      {metrics.length === 0 ? (
        <Empty>Aucune mesure pour l’instant.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {bmi.current && bmi.atStart && bmi.current.value !== bmi.atStart.value && (
            <div className="col-span-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <span className="text-muted-foreground">IMC au début du suivi</span>
              <BmiBadge bmi={bmi.atStart} />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <BmiBadge bmi={bmi.current} />
            </div>
          )}
          {metrics
            .filter((m) => m.type !== 'HEIGHT')
            .map((metric) => (
              <div key={metric.type} className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">{METRICS[metric.type].label}</p>
                <p className="text-base font-semibold">{formatMetric(metric.type, metric.latest.value)}</p>
                <div className="flex flex-col">
                  <Delta metric={metric} from={metric.previous} label="vs dernière" />
                  {metric.count > 2 && <Delta metric={metric} from={metric.first} label="depuis le début" />}
                </div>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}

function RecentEvents({ brief }: { brief: Brief }) {
  const lastDate = brief.lastConsultation?.date;
  return (
    <Section icon={<Flag />} title="Événements de vie">
      {brief.recentEvents.length === 0 ? (
        <Empty>Aucun événement noté.</Empty>
      ) : (
        <ul className="space-y-2">
          {brief.recentEvents.map((event) => {
            const isNew = !lastDate || event.date > lastDate;
            return (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs text-muted-foreground pt-0.5">{formatDate(event.date)}</span>
                <div className="flex-1">
                  <p>
                    {event.title}{' '}
                    <span className="text-xs text-muted-foreground">· {EVENT_CATEGORIES[event.category]}</span>
                  </p>
                  {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
                </div>
                {isNew && lastDate && (
                  <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                    Nouveau
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function CurrentTopics({ brief }: { brief: Brief }) {
  return (
    <Section icon={<Utensils />} title="Situation actuelle">
      {brief.topics.length === 0 ? (
        <Empty>Aucune thématique renseignée.</Empty>
      ) : (
        <dl className="space-y-2">
          {brief.topics.map((note) => (
            <div key={note.id} className="text-sm">
              <dt className="text-xs font-medium text-muted-foreground">
                {TOPICS[note.topic].label} · {formatDate(note.createdAt)}
              </dt>
              <dd className="whitespace-pre-line">{note.content}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}

function OpenTasks({ brief }: { brief: Brief }) {
  if (brief.openTasks.length === 0) return null;
  return (
    <Section icon={<CheckSquare />} title="Tâches en cours">
      <ul className="space-y-1.5 text-sm">
        {brief.openTasks.map((task) => (
          <li key={task.id} className="flex justify-between gap-3">
            <span>{task.title}</span>
            {task.dueAt && <span className="text-xs text-muted-foreground">{formatDate(task.dueAt)}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
