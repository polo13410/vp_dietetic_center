import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', { patientId }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (patientId) params.set('patientId', patientId);
      const { data } = await api.get(`/appointments?${params}`);
      return data;
    },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rendez-vous</h1>
        <Button size="sm">
          <Plus className="w-4 h-4" /> Nouveau rendez-vous
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !data?.data.length ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucun rendez-vous</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Patient
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Durée
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((appt: any) => (
                <tr key={appt.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">{formatDate(appt.startAt, 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/patients/${appt.patientId}`} className="hover:text-primary">
                      {appt.patient?.lastName} {appt.patient?.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{appt.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{appt.duration}min</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {appt.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
