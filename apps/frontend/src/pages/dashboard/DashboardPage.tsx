import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardAppointmentDto, DashboardSummary } from '@vp/types';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  FolderOpen,
  History,
  Phone,
  Play,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { BmiBadge } from '../../components/patient-file/BmiBadge';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useCurrentUser } from '../../hooks/useAuth';
import api from '../../lib/api';
import { usePatientBrief } from '../../lib/patient-file';
import { cn, formatDate, todayISO } from '../../lib/utils';

const TYPE_LABELS: Record<string, string> = { IN_PERSON: 'En cabinet', VIDEO: 'Visio', PHONE: 'Téléphone' };

/** The practitioner's day: who is next and what to know, today's agenda, and what is pending. */
export default function DashboardPage() {
  const user = useCurrentUser();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) return <LoadingSpinner />;
  const { stats } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {user?.firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}
          {stats.todayCount === 0
            ? 'aucun rendez-vous aujourd’hui'
            : `${stats.todayCount} rendez-vous aujourd’hui, ${stats.todayRemaining} à venir`}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi icon={<CalendarDays />} label="Rendez-vous aujourd’hui" value={stats.todayCount} href="/appointments" />
        <Kpi
          icon={<Users />}
          label="Patients suivis"
          value={stats.followedPatientCount}
          href="/patients"
          hint="Vus depuis moins de 3 mois ou avec un RDV prévu"
        />
        <Kpi icon={<CalendarPlus />} label="Rendez-vous cette semaine" value={stats.weekAppointmentCount} href="/appointments" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <NextPatient appointment={data.nextAppointment} />
        <TodayAgenda appointments={data.todayAppointments} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FollowUps followUps={data.followUps} />
        <Tasks tasks={data.tasks} />
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  href,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  href?: string;
  hint?: string;
  tone?: 'warn';
}) {
  const content = (
    <>
      <div
        className={cn(
          'mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:h-4 [&_svg]:w-4',
          tone === 'warn' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </>
  );
  const className = 'bg-card rounded-xl border border-border p-4';
  return href ? (
    <Link to={href} title={hint} className={`${className} hover:border-primary/30 transition-colors`}>
      {content}
    </Link>
  ) : (
    <div title={hint} className={className}>
      {content}
    </div>
  );
}

function Panel({ icon, title, children, aside }: { icon: ReactNode; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Starts the appointment's session, or reopens it. */
function SessionButton({ appt }: { appt: DashboardAppointmentDto }) {
  const start = useStartSession(appt.patientId);
  if (appt.consultation) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to={`/consultations/${appt.consultation.id}`}>Rouvrir</Link>
      </Button>
    );
  }
  if (!['SCHEDULED', 'CONFIRMED'].includes(appt.status)) return null;
  return (
    <Button size="sm" onClick={() => start.mutate({ appointmentId: appt.id })} disabled={start.isPending}>
      <Play className="h-4 w-4" /> Démarrer
    </Button>
  );
}

// ─── Next patient ─────────────────────────────────────────────────────────────

/** Who is next, and what to have in mind before they come in. */
function NextPatient({ appointment }: { appointment: DashboardAppointmentDto | null }) {
  const { data: brief } = usePatientBrief(appointment?.patientId);

  if (!appointment) {
    return (
      <Panel icon={<UserRoundCheck />} title="Prochain patient">
        <Empty>Aucun rendez-vous à venir.</Empty>
      </Panel>
    );
  }
  const start = new Date(appointment.startAt);
  const isToday = start.toDateString() === new Date().toDateString();
  const patient = appointment.patient;
  const weight = brief?.metrics.find((m) => m.type === 'WEIGHT');
  const weightChange = weight && weight.count > 1 ? weight.latest.value - weight.first.value : null;
  const allergies = brief?.file.find((s) => s.field === 'ALLERGIES')?.current?.content;

  return (
    <Panel
      icon={<UserRoundCheck />}
      title="Prochain patient"
      aside={
        <span className="text-xs text-muted-foreground">
          {isToday ? 'Aujourd’hui' : formatDate(start, 'dd/MM')} à {formatDate(start, 'HH:mm')} ·{' '}
          {TYPE_LABELS[appointment.type] ?? appointment.type}
        </span>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to={`/patients/${patient.id}`} className="text-lg font-semibold hover:text-primary">
              {patient.firstName} {patient.lastName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {brief
                ? brief.consultationCount === 0
                  ? 'Première séance'
                  : `${brief.consultationCount + 1}e séance · suivi depuis le ${formatDate(brief.firstConsultationAt)}`
                : '…'}
              {appointment.reason && ` · ${appointment.reason}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/patients/${patient.id}`}>
                <FolderOpen className="h-4 w-4" /> Dossier
              </Link>
            </Button>
            <SessionButton appt={appointment} />
          </div>
        </div>

        {allergies && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Allergies :</strong> {allergies}
            </span>
          </div>
        )}

        {brief && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {brief.lastConsultation
                  ? `Dernière séance · ${formatDate(brief.lastConsultation.date)}`
                  : 'Motif de consultation'}
              </p>
              <p className="text-sm line-clamp-4 whitespace-pre-line">
                {brief.lastConsultation?.sessionWork || brief.patient.consultationReason || '—'}
              </p>
              {brief.lastConsultation?.advice && (
                <p className="text-xs text-muted-foreground line-clamp-2">Conseils : {brief.lastConsultation.advice}</p>
              )}
            </div>
            <div className="space-y-2">
              {(weight || brief.bmi.current) && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {weight && (
                    <span>
                      <strong>{weight.latest.value.toLocaleString('fr-FR')} kg</strong>
                      {weightChange !== null && (
                        <span className="text-xs text-muted-foreground">
                          {' '}
                          ({weightChange > 0 ? '+' : ''}
                          {weightChange.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg depuis le début)
                        </span>
                      )}
                    </span>
                  )}
                  <BmiBadge bmi={brief.bmi.current} />
                </div>
              )}
              {brief.lastConsultation && brief.newEventsSinceLastConsultation > 0 && (
                <p className="text-xs text-purple-600 dark:text-purple-300">
                  {brief.newEventsSinceLastConsultation} événement(s) de vie depuis la dernière séance
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── Today ────────────────────────────────────────────────────────────────────

function TodayAgenda({ appointments }: { appointments: DashboardAppointmentDto[] }) {
  const now = Date.now();
  return (
    <Panel
      icon={<Clock />}
      title="Aujourd’hui"
      aside={
        <Link to="/appointments" className="text-xs text-primary hover:underline">
          Agenda
        </Link>
      }
    >
      {appointments.length === 0 ? (
        <Empty>Aucun rendez-vous aujourd’hui.</Empty>
      ) : (
        <ol className="space-y-1">
          {appointments.map((appt) => {
            const past = new Date(appt.startAt).getTime() + appt.duration * 60000 < now;
            const cancelled = appt.status === 'CANCELLED' || appt.status === 'NO_SHOW';
            return (
              <li key={appt.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                {/* Past and cancelled appointments fade, their actions stay usable */}
                <span className={cn('w-12 shrink-0 text-sm font-medium tabular-nums', (past || cancelled) && 'text-muted-foreground')}>
                  {formatDate(appt.startAt, 'HH:mm')}
                </span>
                <Link
                  to={`/appointments/${appt.id}`}
                  className={cn(
                    'flex-1 min-w-0 truncate text-sm hover:text-primary',
                    (past || cancelled) && 'text-muted-foreground',
                    cancelled && 'line-through',
                  )}
                >
                  {appt.patient.firstName} {appt.patient.lastName}
                </Link>
                {cancelled ? <StatusBadge status={appt.status} /> : <SessionButton appt={appt} />}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

// ─── Pending ──────────────────────────────────────────────────────────────────

function FollowUps({ followUps }: { followUps: DashboardSummary['followUps'] }) {
  const [patientId, setPatientId] = useState<string | null>(null);
  // Stable object: the dialog resets its form whenever its default values change
  const defaults = useMemo(() => (patientId ? { patientId } : undefined), [patientId]);
  return (
    <Panel icon={<Phone />} title="À relancer">
      {followUps.length === 0 ? (
        <Empty>Tous les patients actifs ont un suivi en cours.</Empty>
      ) : (
        <ul className="space-y-2">
          {followUps.map(({ patient, daysSince }) => (
            <li key={patient.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Link to={`/patients/${patient.id}`} className="block truncate text-sm font-medium hover:text-primary">
                  {patient.firstName} {patient.lastName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {daysSince === null ? 'Jamais vu' : `Vu il y a ${Math.round(daysSince / 7)} semaines`}
                  {patient.phone && ` · ${patient.phone}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPatientId(patient.id)} title="Planifier un rendez-vous">
                <CalendarPlus className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Patients actifs sans RDV prévu et non vus depuis 6 semaines.</p>
      <AppointmentFormDialog
        open={!!patientId}
        onOpenChange={(open) => !open && setPatientId(null)}
        defaultValues={defaults}
      />
    </Panel>
  );
}

function Tasks({ tasks }: { tasks: DashboardSummary['tasks'] }) {
  const queryClient = useQueryClient();
  const done = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}`, { status: 'DONE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  const today = todayISO();
  return (
    <Panel icon={<CheckCircle2 />} title="Tâches">
      {tasks.length === 0 ? (
        <Empty>Aucune tâche en cours.</Empty>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const overdue = !!task.dueAt && task.dueAt.slice(0, 10) < today;
            return (
              <li key={task.id} className="flex items-start gap-2">
                <button
                  onClick={() => done.mutate(task.id)}
                  className="mt-0.5 text-muted-foreground hover:text-primary"
                  title="Marquer comme faite"
                >
                  <Circle className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.patient && (
                      <Link to={`/patients/${task.patient.id}`} className="hover:text-primary">
                        {task.patient.firstName} {task.patient.lastName}
                      </Link>
                    )}
                    {task.patient && task.dueAt && ' · '}
                    {task.dueAt && (
                      <span className={cn(overdue && 'font-medium text-red-600 dark:text-red-400')}>
                        {overdue && 'En retard · '}
                        {formatDate(task.dueAt)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
