import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface PatientGrowthChartProps {
  data: Array<{ month: string; count: number; cumulative: number }>;
}

export function PatientGrowthChart({ data }: PatientGrowthChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune donnee</p>;
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium mb-3">Croissance patients</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.15}
            name="Total patients"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
