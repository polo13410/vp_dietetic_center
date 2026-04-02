import { useQuery } from '@tanstack/react-query';

import api from '../../lib/api';
import { LoadingSpinner } from '../../components/ui/loading-screen';

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => { const { data } = await api.get('/reports/activity'); return data; },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-semibold">Reporting</h1>
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total rendez-vous" value={data.totalAppointments} />
          <StatCard label="Patients actifs" value={data.activePatients} />
          <StatCard label="Nouveaux patients" value={data.newPatients} />
          <StatCard label="Réalisés" value={data.byStatus?.COMPLETED ?? 0} />
          <StatCard label="Annulés" value={data.byStatus?.CANCELLED ?? 0} />
          <StatCard label="Absences" value={data.byStatus?.NO_SHOW ?? 0} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
