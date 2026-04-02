import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';

import api from '../../lib/api';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { formatDateTime } from '../../lib/utils';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => { const { data } = await api.get(`/appointments/${id}`); return data; },
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!appt) return <p className="text-muted-foreground">Rendez-vous introuvable</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/appointments" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-semibold">Rendez-vous — {formatDateTime(appt.startAt)}</h1>
      </div>
      <div className="bg-white rounded-xl border border-border p-5 space-y-3">
        <p className="text-sm"><span className="text-muted-foreground w-32 inline-block">Patient</span>
          <Link to={`/patients/${appt.patientId}`} className="text-primary hover:underline">
            {appt.patient?.lastName} {appt.patient?.firstName}
          </Link>
        </p>
        <p className="text-sm"><span className="text-muted-foreground w-32 inline-block">Type</span>{appt.type}</p>
        <p className="text-sm"><span className="text-muted-foreground w-32 inline-block">Durée</span>{appt.duration} minutes</p>
        <p className="text-sm"><span className="text-muted-foreground w-32 inline-block">Statut</span>{appt.status}</p>
        {appt.reason && <p className="text-sm"><span className="text-muted-foreground w-32 inline-block">Motif</span>{appt.reason}</p>}
        {appt.preNotes && <div className="mt-4 pt-4 border-t border-border"><p className="text-xs font-medium text-muted-foreground mb-1">Notes pré-consultation</p><p className="text-sm">{appt.preNotes}</p></div>}
        {appt.postNotes && <div className="mt-4 pt-4 border-t border-border"><p className="text-xs font-medium text-muted-foreground mb-1">Notes post-consultation</p><p className="text-sm">{appt.postNotes}</p></div>}
      </div>
    </div>
  );
}
