import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ActivityChartProps {
  data: Array<{
    date: string;
    COMPLETED?: number;
    SCHEDULED?: number;
    CONFIRMED?: number;
    CANCELLED?: number;
    NO_SHOW?: number;
    total: number;
  }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune donnee</p>;
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium mb-3">Rendez-vous par jour</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="COMPLETED" stackId="a" fill="#10b981" name="Termine" />
          <Bar dataKey="CONFIRMED" stackId="a" fill="#6366f1" name="Confirme" />
          <Bar dataKey="SCHEDULED" stackId="a" fill="#3b82f6" name="Planifie" />
          <Bar dataKey="CANCELLED" stackId="a" fill="#ef4444" name="Annule" />
          <Bar dataKey="NO_SHOW" stackId="a" fill="#f97316" name="Absent" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
