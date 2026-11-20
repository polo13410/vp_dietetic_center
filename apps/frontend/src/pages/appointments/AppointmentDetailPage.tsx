import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Edit, Play, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { PatientBrief } from '../../components/patient-file/PatientBrief';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Assistants schedule appointments but never see the patient's file
  const isAssistant = useIsRole('ASSISTANTE');

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const { data } = await api.get(`/appointments/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => api.patch(`/appointments/${id}`, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Statut mis a jour' });
      setCancelOpen(false);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!appt) return <p className="text-muted-foreground">Rendez-vous introuvable</p>;

  const canTransition = appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED';

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/appointments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Rendez-vous — {formatDateTime(appt.startAt)}</h1>
          <p className="text-sm text-muted-foreground">
            {appt.duration} min — {appt.patient?.lastName} {appt.patient?.firstName}
          </p>
        </div>
        <StatusBadge status={appt.status} />
      </div>

      {/* Status actions */}
      {canTransition && (
        <div className="flex gap-2">
          {appt.status === 'SCHEDULED' && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('CONFIRMED')}>
              <Check className="w-4 h-4" /> Confirmer
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('NO_SHOW')}>
            <XCircle className="w-4 h-4" /> Absent
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="w-4 h-4" /> Modifier
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
            <X className="w-4 h-4" /> Annuler
          </Button>
        </div>
      )}

      {/* Info card */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <InfoRow label="Patient">
          <Link to={`/patients/${appt.patientId}`} className="text-primary hover:underline">
            {appt.patient?.lastName} {appt.patient?.firstName}
          </Link>
        </InfoRow>
        {appt.practitioner && (
          <InfoRow label="Praticienne">
            {appt.practitioner.firstName} {appt.practitioner.lastName}
          </InfoRow>
        )}
        <InfoRow label="Type"><StatusBadge status={appt.type} /></InfoRow>
        <InfoRow label="Duree">{appt.duration} minutes</InfoRow>
        <InfoRow label="Statut"><StatusBadge status={appt.status} /></InfoRow>
        {appt.reason && <InfoRow label="Motif">{appt.reason}</InfoRow>}
        {appt.cancelReason && <InfoRow label="Motif annulation">{appt.cancelReason}</InfoRow>}
      </div>

      {!isAssistant && (
        <>
          <SessionAction appt={appt} />
          {/* What to know before seeing the patient */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Avant la séance
            </h2>
            <PatientBrief patientId={appt.patientId} />
          </div>
        </>
      )}

      {/* Edit dialog */}
      <AppointmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editId={id}
        defaultValues={{
          patientId: appt.patientId,
          startAt: appt.startAt?.slice(0, 16),
          duration: appt.duration,
          type: appt.type,
          reason: appt.reason ?? '',
        }}
      />

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Annuler le rendez-vous"
        description="Etes-vous sur de vouloir annuler ce rendez-vous ? Cette action ne peut pas etre defaite."
        variant="destructive"
        confirmLabel="Annuler le RDV"
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate('CANCELLED')}
      />
    </div>
  );
}

/** Starts the session of this appointment, or opens it if it already exists. */
function SessionAction({ appt }: { appt: any }) {
  const start = useStartSession(appt.patientId);
  const session = appt.consultation as { id: string; status: string } | null;
  if (session) {
    return (
      <Button asChild variant={session.status === 'DRAFT' ? 'default' : 'outline'}>
        <Link to={`/consultations/${session.id}`}>
          <Play className="w-4 h-4" />
          {session.status === 'DRAFT' ? 'Reprendre la séance' : 'Voir la séance'}
        </Link>
      </Button>
    );
  }
  if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') return null;
  return (
    <Button onClick={() => start.mutate({ appointmentId: appt.id })} disabled={start.isPending}>
      <Play className="w-4 h-4" /> Démarrer la séance
    </Button>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

