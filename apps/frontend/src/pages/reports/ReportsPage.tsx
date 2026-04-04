import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { ActivityChart } from '../../components/reports/ActivityChart';
import { PatientGrowthChart } from '../../components/reports/PatientGrowthChart';
import { DateRangePicker } from '../../components/shared/DateRangePicker';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { exportCsv } from '../../lib/csv-export';

export default function ReportsPage() {
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  const params: Record<string, string> = {};
  if (from) params.from = from.toISOString();
  if (to) params.to = to.toISOString();

  const { data: activity, isLoading } = useQuery({
    queryKey: ['reports', 'activity', params.from, params.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/activity', { params });
      return data;
    },
  });

  const { data: trend = [] } = useQuery({
    queryKey: ['reports', 'trend', params.from, params.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/trend', { params });
      return data;
    },
  });

  const { data: growth = [] } = useQuery({
    queryKey: ['reports', 'patient-growth', params.from, params.to],
    queryFn: async () => {
      const { data } = await api.get('/reports/patient-growth', { params });
      return data;
    },
  });

  const handleExportCsv = () => {
    if (!activity) return;
    const rows = [
      { metric: 'Total rendez-vous', value: activity.totalAppointments },
      { metric: 'Patients actifs', value: activity.activePatients },
      { metric: 'Nouveaux patients', value: activity.newPatients },
      { metric: 'Realises', value: activity.byStatus?.COMPLETED ?? 0 },
      { metric: 'Annules', value: activity.byStatus?.CANCELLED ?? 0 },
      { metric: 'Absences', value: activity.byStatus?.NO_SHOW ?? 0 },
    ];
    exportCsv(rows, [
      { key: 'metric', label: 'Metrique' },
      { key: 'value', label: 'Valeur' },
    ], 'rapport-activite');
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reporting</h1>
        <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!activity}>
          <Download className="w-4 h-4" /> Exporter CSV
        </Button>
      </div>

      {/* Date range */}
      <div className="bg-card rounded-xl border border-border p-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Stat cards */}
      {activity && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total rendez-vous" value={activity.totalAppointments} />
          <StatCard label="Patients actifs" value={activity.activePatients} />
          <StatCard label="Nouveaux patients" value={activity.newPatients} />
          <StatCard label="Realises" value={activity.byStatus?.COMPLETED ?? 0} accent="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Annules" value={activity.byStatus?.CANCELLED ?? 0} accent="text-red-600 dark:text-red-400" />
          <StatCard label="Absences" value={activity.byStatus?.NO_SHOW ?? 0} accent="text-orange-600 dark:text-orange-400" />
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <ActivityChart data={trend} />
        <PatientGrowthChart data={growth} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className={`text-2xl font-semibold ${accent ?? 'text-foreground'}`}>{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
