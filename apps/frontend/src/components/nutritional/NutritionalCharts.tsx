import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate } from '../../lib/utils';

interface Entry {
  date: string;
  weight?: string | number | null;
  mood?: number | null;
  energyLevel?: number | null;
  stressLevel?: number | null;
  sleepHours?: string | number | null;
  sleepQuality?: number | null;
  waterIntake?: string | number | null;
}

interface NutritionalChartsProps {
  entries: Entry[];
}

export function NutritionalCharts({ entries }: NutritionalChartsProps) {
  const data = [...entries].reverse().map((e) => ({
    date: formatDate(e.date),
    poids: e.weight ? parseFloat(String(e.weight)) : null,
    humeur: e.mood,
    energie: e.energyLevel,
    stress: e.stressLevel,
    sommeilH: e.sleepHours ? parseFloat(String(e.sleepHours)) : null,
    sommeilQ: e.sleepQuality,
    eau: e.waterIntake ? parseFloat(String(e.waterIntake)) : null,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucune donnee a afficher</p>;
  }

  const hasWeight = data.some((d) => d.poids !== null);
  const hasMoodStress = data.some((d) => d.humeur !== null || d.stress !== null);
  const hasEnergy = data.some((d) => d.energie !== null);
  const hasSleep = data.some((d) => d.sommeilH !== null || d.sommeilQ !== null);
  const hasWater = data.some((d) => d.eau !== null);

  return (
    <div className="space-y-6">
      {/* Weight */}
      {hasWeight && (
        <ChartCard title="Poids (kg)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Line type="monotone" dataKey="poids" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Poids" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Mood + Stress + Energy */}
      {(hasMoodStress || hasEnergy) && (
        <ChartCard title="Humeur, Stress, Energie">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="humeur" stroke="#6366f1" strokeWidth={2} dot={false} name="Humeur" connectNulls />
              <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={2} dot={false} name="Stress" connectNulls />
              <Line type="monotone" dataKey="energie" stroke="#f59e0b" strokeWidth={2} dot={false} name="Energie" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Sleep */}
      {hasSleep && (
        <ChartCard title="Sommeil">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="hours" tick={{ fontSize: 11 }} domain={[0, 12]} />
              <YAxis yAxisId="quality" orientation="right" tick={{ fontSize: 11 }} domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="hours" dataKey="sommeilH" fill="#6366f1" opacity={0.5} name="Heures" />
              <Line yAxisId="quality" type="monotone" dataKey="sommeilQ" stroke="#10b981" strokeWidth={2} dot={false} name="Qualite" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Water */}
      {hasWater && (
        <ChartCard title="Hydratation (L)">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="eau" fill="#06b6d4" name="Eau (L)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}
