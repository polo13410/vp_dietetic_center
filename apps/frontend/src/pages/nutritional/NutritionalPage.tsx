import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

export default function NutritionalPage() {
  const { patientId } = useParams<{ patientId: string }>();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['nutritional-profile', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/nutritional/profile/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['nutritional-entries', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/nutritional/entries?patientId=${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

  if (loadingProfile || loadingEntries) return <LoadingSpinner />;

  const chartData = [...(entries ?? [])].reverse().map((e: any) => ({
    date: formatDate(e.date),
    humeur: e.mood,
    sommeil: e.sleepHours,
    stress: e.stressLevel,
    poids: e.weight ? parseFloat(e.weight) : null,
  }));

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to={`/patients/${patientId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold">Suivi nutritionnel</h1>
      </div>

      {/* Profile */}
      {profile && (
        <div className="bg-card rounded-xl border border-border p-5 grid md:grid-cols-2 gap-4">
          <ProfileItem label="Objectifs" value={profile.objectives} />
          <ProfileItem label="Relation à l'alimentation" value={profile.foodRelationship} />
          <ProfileItem label="Habitudes alimentaires" value={profile.dietaryHabits} />
          <ProfileItem label="Déclencheurs émotionnels" value={profile.emotionalTriggers} />
          <ProfileItem label="Allergies" value={profile.allergies} />
          <ProfileItem label="Suppléments" value={profile.supplements} />
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium mb-4">Évolution — 14 derniers jours</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="humeur"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name="Humeur"
              />
              <Line
                type="monotone"
                dataKey="stress"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Stress"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-line">{value}</p>
    </div>
  );
}
