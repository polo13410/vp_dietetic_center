import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Edit, FileText, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

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

  const postNotesMutation = useMutation({
    mutationFn: (postNotes: string) => api.patch(`/appointments/${id}`, { postNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast({ title: 'Notes post-consultation enregistrees' });
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!appt) return <p className="text-muted-foreground">Rendez-vous introuvable</p>;

  const canTransition = appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED';

  return (
    <div className="max-w-2xl space-y-5">
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
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('COMPLETED')}>
            <Check className="w-4 h-4" /> Termine
          </Button>
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
        <InfoRow label="Type"><StatusBadge status={appt.type} /></InfoRow>
        <InfoRow label="Duree">{appt.duration} minutes</InfoRow>
        <InfoRow label="Statut"><StatusBadge status={appt.status} /></InfoRow>
        {appt.reason && <InfoRow label="Motif">{appt.reason}</InfoRow>}
        {appt.cancelReason && <InfoRow label="Motif annulation">{appt.cancelReason}</InfoRow>}
      </div>

      {/* Pre-notes */}
      {appt.preNotes && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes pre-consultation</p>
          <p className="text-sm whitespace-pre-line">{appt.preNotes}</p>
        </div>
      )}

      {/* Post-notes (editable) */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes post-consultation</p>
        <PostNotesEditor
          value={appt.postNotes ?? ''}
          onSave={(value) => postNotesMutation.mutate(value)}
          saving={postNotesMutation.isPending}
        />
      </div>

      {/* Link to create note */}
      <Button variant="outline" asChild>
        <Link to={`/notes/new?patientId=${appt.patientId}&appointmentId=${appt.id}`}>
          <FileText className="w-4 h-4" /> Creer une note clinique
        </Link>
      </Button>

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
          preNotes: appt.preNotes ?? '',
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function PostNotesEditor({
  value,
  onSave,
  saving,
}: {
  value: string;
  onSave: (val: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (!editing) {
    return (
      <div>
        <p className="text-sm whitespace-pre-line">{value || 'Aucune note'}</p>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setText(value); setEditing(true); }}>
          <Edit className="w-3 h-3 mr-1" /> Editer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(text); setEditing(false); }} disabled={saving}>
          Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
