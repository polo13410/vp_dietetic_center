import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarX, Check, ClipboardList, Pencil, Play, RotateCcw, UserX, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { PatientRecap } from '../../components/patient-file/PatientRecap';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { useIsRole } from '../../hooks/useAuth';
import { useShowPractices } from '../../hooks/useMe';
import api from '../../lib/api';
import { formatDate, formatLongDate, formatTime } from '../../lib/utils';

interface AppointmentDetail {
  id: string;
  patientId: string;
  startAt: string;
  duration: number;
  type: string;
  status: string;
  formulaId: string | null;
  formula?: { id: string; label: string } | null;
  practiceId: string | null;
  practice?: { id: string; name: string } | null;
  /** Optional note */
  reason: string | null;
  cancelReason?: string | null;
  patient?: { firstName: string; lastName: string };
  practitioner?: { firstName: string; lastName: string };
  consultation?: { id: string } | null;
}

const BACK = { to: '/appointments', label: 'Agenda' };

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Assistants schedule appointments but never see the patient's file
  const isAssistant = useIsRole('ASSISTANTE');
  const showPractice = useShowPractices();

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => (await api.get<AppointmentDetail>(`/appointments/${id}`)).data,
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => api.patch(`/appointments/${id}`, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Rendez-vous mis à jour' });
      setCancelOpen(false);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!appt) {
    return (
      <>
        <PageHeader area="agenda" back={BACK} title="Rendez-vous" />
        <EmptyState
          icon={CalendarX}
          area="agenda"
          title="Ce rendez-vous n’existe plus."
          description="Il a peut-être été supprimé. Retrouvez les autres dans l’agenda."
          action={
            <Button asChild>
              <Link to="/appointments">Ouvrir l’agenda</Link>
            </Button>
          }
        />
      </>
    );
  }

  const name = `${appt.patient?.firstName ?? ''} ${appt.patient?.lastName ?? ''}`.trim();
  const open = appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED';

  return (
    <>
      <PageHeader
        area="agenda"
        back={BACK}
        title={name}
        subtitle={
          <span className="first-letter:uppercase">
            {new Date(appt.startAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
            à {formatTime(appt.startAt)}
            {appt.formula && ` · ${appt.formula.label}`} · {appt.duration} min
          </span>
        }
        actions={!isAssistant && <SessionAction appt={appt} />}
      />

      <div className="space-y-6">
        <Section
          icon={CalendarDays}
          area="agenda"
          title="Rendez-vous"
          action={<StatusBadge status={appt.status} />}
        >
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info label="Patient">
              {isAssistant ? (
                name
              ) : (
                <Link to={`/patients/${appt.patientId}`} className="font-medium text-primary hover:underline">
                  {name}
                </Link>
              )}
            </Info>
            <Info label="Date">
              {formatLongDate(appt.startAt)} à {formatTime(appt.startAt)}
            </Info>
            <Info label="Type de rendez-vous">{appt.formula?.label ?? 'Non précisé'}</Info>
            <Info label="Lieu">
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={appt.type} />
                {showPractice && appt.practice && appt.practice.name}
              </span>
            </Info>
            <Info label="Durée">{appt.duration} minutes</Info>
            {appt.practitioner && (
              <Info label="Praticienne">
                {appt.practitioner.firstName} {appt.practitioner.lastName}
              </Info>
            )}
            {appt.reason && <Info label="Note">{appt.reason}</Info>}
            {appt.cancelReason && <Info label="Motif d’annulation">{appt.cancelReason}</Info>}
          </dl>

          {open && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden /> Modifier
              </Button>
              {appt.status === 'SCHEDULED' && (
                <Button variant="outline" onClick={() => statusMutation.mutate('CONFIRMED')}>
                  <Check aria-hidden /> Confirmer
                </Button>
              )}
              <Button variant="outline" onClick={() => statusMutation.mutate('NO_SHOW')}>
                <UserX aria-hidden /> Marquer absent
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:bg-danger-soft hover:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                <X aria-hidden /> Annuler le rendez-vous
              </Button>
            </div>
          )}
        </Section>

        {!isAssistant && (
          <section className="space-y-3" aria-labelledby="before-session">
            <h2 id="before-session" className="flex items-center gap-2 text-xl font-semibold">
              <ClipboardList className="size-5 text-area-patients" aria-hidden /> Avant la séance
            </h2>
            <PatientRecap patientId={appt.patientId} size="panel" />
          </section>
        )}
      </div>

      <AppointmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={id}
        defaultValues={{
          patientId: appt.patientId,
          startAt: formatDate(appt.startAt, 'yyyy-MM-ddTHH:mm'), // local time for the field
          duration: appt.duration,
          type: appt.type as 'IN_PERSON' | 'VIDEO' | 'PHONE',
          formulaId: appt.formulaId ?? '',
          practiceId: appt.practiceId ?? '',
          reason: appt.reason ?? '',
        }}
        booked={{ formula: appt.formula, practice: appt.practice }}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Annuler le rendez-vous de ${name} ?`}
        description="Il reste visible dans l’agenda, barré, et le créneau redevient libre."
        variant="destructive"
        confirmLabel="Annuler le rendez-vous"
        cancelLabel="Garder le rendez-vous"
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate('CANCELLED')}
      />
    </>
  );
}

/** « Démarrer la séance » for this appointment, or « Rouvrir la séance » once it exists. */
function SessionAction({ appt }: { appt: AppointmentDetail }) {
  const start = useStartSession(appt.patientId);
  if (appt.consultation) {
    return (
      <Button asChild variant="outline">
        <Link to={`/consultations/${appt.consultation.id}`}>
          <RotateCcw aria-hidden /> Rouvrir la séance
        </Link>
      </Button>
    );
  }
  if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') return null;
  return (
    <Button onClick={() => start.mutate({ appointmentId: appt.id })} disabled={start.isPending}>
      <Play aria-hidden /> Démarrer la séance
    </Button>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}
