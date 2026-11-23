import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardAppointmentDto, DashboardSummary } from '@vp/types';
import { Building2, CalendarDays, CalendarPlus, Check, ListChecks, Phone, Play, Receipt, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { useCurrentUser, useIsRole } from '../../hooks/useAuth';
import { apiErrorMessage, useShowPractices } from '../../hooks/useMe';
import api from '../../lib/api';
import { appointmentSummary } from '../../lib/appointments';
import {
  patientBilling,
  periodText,
  type SessionToInvoiceDto,
  useIssueInvoice,
  usePayerReminders,
  useSessionsToInvoice,
} from '../../lib/invoices';
import { formatPrice } from '../../lib/patient-file';
import { cn, formatLongDate, formatTime, todayISO } from '../../lib/utils';

const TYPE_LABELS: Record<string, string> = { IN_PERSON: 'En cabinet', VIDEO: 'Vidéo', PHONE: 'Téléphone' };
const UPCOMING = ['SCHEDULED', 'CONFIRMED'];
/** « Factures à faire » shows this many sessions before « Voir les N autres » */
const INVOICES_SHOWN = 5;

/**
 * The practitioner's day: today's appointments as big cards, then what is pending: patients to
 * follow up, sessions to invoice and tasks.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  // Assistants schedule appointments; sessions, follow-ups and invoices are the practitioner's
  const isPractitioner = useIsRole('PRATICIENNE');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) return <LoadingSpinner />;
  const booked = data.todayAppointments.filter((a) => a.status !== 'CANCELLED');

  return (
    <>
      <PageHeader
        area="home"
        title={`Bonjour${user?.firstName ? `, ${user.firstName}` : ''}`}
        subtitle={
          <span className="first-letter:uppercase">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {booked.length === 0
              ? 'aucun rendez-vous aujourd’hui'
              : `${booked.length} rendez-vous aujourd’hui`}
          </span>
        }
      />

      <div className="space-y-6">
        <Today appointments={data.todayAppointments} canStartSessions={isPractitioner} />
        {/* Follow-ups and invoices need the patients' files: the practitioner's */}
        {isPractitioner && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <FollowUps followUps={data.followUps} />
            <InvoicesToIssue />
          </div>
        )}
        {isPractitioner && <PayerReminders />}
        <Tasks tasks={data.tasks} />
      </div>
    </>
  );
}

// ─── Today ────────────────────────────────────────────────────────────────────

export function Today({
  appointments,
  canStartSessions,
}: {
  appointments: DashboardAppointmentDto[];
  canStartSessions: boolean;
}) {
  const now = Date.now();
  // The next one still to see gets a « À suivre » mark
  const nextId = appointments.find(
    (a) => UPCOMING.includes(a.status) && !a.consultation && new Date(a.startAt).getTime() + a.duration * 60000 > now,
  )?.id;

  return (
    <Section
      icon={CalendarDays}
      area="agenda"
      title="Aujourd’hui"
      action={
        <Button variant="ghost" asChild>
          <Link to="/appointments">Ouvrir l’agenda</Link>
        </Button>
      }
    >
      {appointments.length === 0 ? (
        <EmptyState
          illustration="pear"
          className="py-8"
          title="Aucun rendez-vous aujourd’hui."
          description="Profitez-en pour avancer sur les factures ou relancer un patient."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {appointments.map((appt) => (
            <TodayCard
              key={appt.id}
              appt={appt}
              isNext={appt.id === nextId}
              past={new Date(appt.startAt).getTime() + appt.duration * 60000 < now}
              canStartSessions={canStartSessions}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function TodayCard({
  appt,
  isNext,
  past,
  canStartSessions,
}: {
  appt: DashboardAppointmentDto;
  isNext: boolean;
  past: boolean;
  canStartSessions: boolean;
}) {
  const cancelled = appt.status === 'CANCELLED' || appt.status === 'NO_SHOW';
  const faded = cancelled || (past && !isNext);
  // Its type, and where when she consults in several practices
  const summary = appointmentSummary(appt, useShowPractices());

  return (
    <li
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-background p-5',
        isNext ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-3xl font-semibold tabular-nums', faded && 'text-muted-foreground')}>
            {formatTime(appt.startAt)}
          </p>
          <p className="text-sm text-muted-foreground">
            {appt.duration} min · {TYPE_LABELS[appt.type] ?? appt.type}
          </p>
        </div>
        {cancelled ? (
          <StatusBadge status={appt.status} />
        ) : appt.consultation ? (
          <StatusBadge status="STARTED" label="Séance commencée" tone="success" />
        ) : (
          isNext && <StatusBadge status="NEXT" label="À suivre" tone="info" />
        )}
      </div>

      <div className="min-w-0">
        <Link
          to={`/appointments/${appt.id}`}
          className={cn(
            'block truncate text-xl font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            cancelled && 'text-muted-foreground line-through',
          )}
        >
          {appt.patient.firstName} {appt.patient.lastName}
        </Link>
        {summary && <p className="mt-1 truncate text-base font-medium">{summary}</p>}
        {appt.reason && <p className="mt-1 line-clamp-2 text-base text-muted-foreground">{appt.reason}</p>}
      </div>

      {canStartSessions && !cancelled && (
        <div className="mt-auto">
          <SessionButton appt={appt} />
        </div>
      )}
    </li>
  );
}

/** « Démarrer la séance », or « Rouvrir » once the session exists. */
function SessionButton({ appt }: { appt: DashboardAppointmentDto }) {
  const start = useStartSession(appt.patientId);
  if (appt.consultation) {
    return (
      <Button variant="outline" className="w-full" asChild>
        <Link to={`/consultations/${appt.consultation.id}`}>
          <RotateCcw aria-hidden /> Rouvrir
        </Link>
      </Button>
    );
  }
  if (!UPCOMING.includes(appt.status)) return null;
  return (
    <Button
      className="w-full"
      onClick={() => start.mutate({ appointmentId: appt.id })}
      disabled={start.isPending}
    >
      <Play aria-hidden /> Démarrer la séance
    </Button>
  );
}

// ─── To follow up ─────────────────────────────────────────────────────────────

/** « Vu il y a 9 semaines » */
function lastSessionText(daysSince: number | null): string {
  if (daysSince === null) return 'Aucune séance pour l’instant';
  const weeks = Math.floor(daysSince / 7);
  if (weeks >= 9) {
    const months = Math.round(daysSince / 30);
    return `Dernière séance il y a ${months} mois`;
  }
  return `Dernière séance il y a ${weeks} semaines`;
}

export function FollowUps({ followUps }: { followUps: DashboardSummary['followUps'] }) {
  const [patientId, setPatientId] = useState<string | null>(null);
  // Stable object: the dialog resets its form whenever its default values change
  const defaults = useMemo(() => (patientId ? { patientId } : undefined), [patientId]);

  return (
    <Section
      icon={Phone}
      area="patients"
      title="À relancer"
      description="Sans séance depuis 6 semaines et sans rendez-vous prévu."
    >
      {followUps.length === 0 ? (
        <EmptyState
          icon={Check}
          area="patients"
          className="py-6"
          title="Tous vos patients sont suivis."
          description="Chacun a eu une séance récente ou a un rendez-vous prévu."
        />
      ) : (
        <ul className="-my-3 divide-y divide-border">
          {followUps.map(({ patient, daysSince }) => (
            <li key={patient.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <Link to={`/patients/${patient.id}`} className="block truncate text-base font-medium hover:text-primary">
                  {patient.firstName} {patient.lastName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {lastSessionText(daysSince)}
                  {patient.phone && (
                    <>
                      {' · '}
                      <a href={`tel:${patient.phone.replace(/\s/g, '')}`} className="hover:text-primary">
                        {patient.phone}
                      </a>
                    </>
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPatientId(patient.id)}>
                <CalendarPlus aria-hidden /> Prendre rendez-vous
              </Button>
            </li>
          ))}
        </ul>
      )}
      <AppointmentFormDialog
        open={!!patientId}
        onOpenChange={(open) => !open && setPatientId(null)}
        defaultValues={defaults}
      />
    </Section>
  );
}

// ─── Invoices to issue ────────────────────────────────────────────────────────

export function InvoicesToIssue() {
  const { data: sessions, isLoading } = useSessionsToInvoice();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? sessions : sessions?.slice(0, INVOICES_SHOWN);
  const hidden = (sessions?.length ?? 0) - (shown?.length ?? 0);

  return (
    <Section
      icon={Receipt}
      area="invoices"
      title="Factures à faire"
      description={
        sessions?.length
          ? `${sessions.length} séance${sessions.length > 1 ? 's' : ''} sans facture.`
          : undefined
      }
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : !sessions?.length ? (
        <EmptyState
          icon={Check}
          area="invoices"
          className="py-6"
          title="Toutes les séances ont leur facture."
          description="Une séance terminée sans facture apparaîtra ici."
        />
      ) : (
        <>
          <ul className="-my-3 divide-y divide-border">
            {shown?.map((session) => <InvoiceRow key={session.id} session={session} />)}
          </ul>
          {hidden > 0 && (
            <Button variant="ghost" className="mt-3" onClick={() => setShowAll(true)}>
              Voir {hidden === 1 ? 'l’autre séance' : `les ${hidden} autres séances`}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

function InvoiceRow({ session }: { session: SessionToInvoiceDto }) {
  const issue = useIssueInvoice();
  const billing = patientBilling(session);
  const ready = billing.state === 'ready';

  const run = () =>
    issue.mutate(session.id, {
      onSuccess: (invoice) => toast({ title: `Facture n° ${invoice.number} faite` }),
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être faite. Réessayez.'), variant: 'destructive' }),
    });

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/consultations/${session.id}`} className="block truncate text-base font-medium hover:text-primary">
          {session.patient.firstName} {session.patient.lastName}
        </Link>
        <p className="text-sm text-muted-foreground">
          {formatLongDate(session.date, true)}
          {ready ? ` · ${session.formulaLabel} ${formatPrice(billing.cents)}` : ' · formule à choisir'}
        </p>
      </div>
      {ready ? (
        <Button variant="outline" size="sm" onClick={run} disabled={issue.isPending}>
          <Receipt aria-hidden /> Faire la facture
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/consultations/${session.id}`}>Choisir la formule</Link>
        </Button>
      )}
    </li>
  );
}

// ─── Payers ───────────────────────────────────────────────────────────────────

/**
 * What the payers need (lot 16): periods ended and not billed yet, and their invoices still « en
 * attente » more than 60 days after. Nothing when all is up to date.
 */
export function PayerReminders() {
  const { data } = usePayerReminders();
  if (!data || (data.periodsToBill.length === 0 && data.overdueInvoices.length === 0)) return null;
  return (
    <Section icon={Building2} area="invoices" title="Organismes" description="Factures à préparer et règlements à relancer.">
      <ul className="-my-3 divide-y divide-border">
        {data.periodsToBill.map((p) => (
          <li key={p.payer.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium">{p.payer.name}</p>
              <p className="text-sm text-muted-foreground">
                Période terminée {periodText(p.from, p.to)} · {p.sessionCount} séance{p.sessionCount > 1 ? 's' : ''} ·{' '}
                {formatPrice(p.totalCents)}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/invoices?vue=organismes&preparer=${p.payer.id}`}>
                <Receipt aria-hidden /> Préparer la facture
              </Link>
            </Button>
          </li>
        ))}
        {data.overdueInvoices.map((invoice) => (
          <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium">
                Facture n° {invoice.number} · {invoice.payerName}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(invoice.amountCents)} · en attente depuis {invoice.days} jours
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/invoices?vue=organismes">Voir les factures</Link>
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function Tasks({ tasks }: { tasks: DashboardSummary['tasks'] }) {
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
    <Section icon={ListChecks} area="home" title="Tâches">
      {tasks.length === 0 ? (
        <EmptyState
          icon={Check}
          area="home"
          className="py-6"
          title="Aucune tâche en cours."
          description="Les tâches s’ajoutent depuis le dossier d’un patient."
        />
      ) : (
        <ul className="-my-3 divide-y divide-border">
          {tasks.map((task) => {
            const overdue = !!task.dueAt && task.dueAt.slice(0, 10) < today;
            return (
              <li key={task.id} className="flex items-center gap-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => done.mutate(task.id)}
                  disabled={done.isPending}
                  aria-label={`Marquer « ${task.title} » comme faite`}
                >
                  <span className="size-5 rounded-full border-2 border-current" aria-hidden />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="text-base">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.patient && (
                      <Link to={`/patients/${task.patient.id}`} className="hover:text-primary">
                        {task.patient.firstName} {task.patient.lastName}
                      </Link>
                    )}
                    {task.patient && task.dueAt && ' · '}
                    {task.dueAt && (
                      <span className={cn(overdue && 'font-medium text-danger')}>
                        {overdue && 'En retard · '}
                        {formatLongDate(task.dueAt, true)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
