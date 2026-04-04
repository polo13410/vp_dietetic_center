import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { NutritionalCharts } from '../../components/nutritional/NutritionalCharts';
import { NutritionalEntryFormDialog } from '../../components/nutritional/NutritionalEntryFormDialog';
import { NutritionalProfileForm } from '../../components/nutritional/NutritionalProfileForm';
import { DateRangePicker } from '../../components/shared/DateRangePicker';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

export default function NutritionalPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [from, setFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [to, setTo] = useState<Date | undefined>(new Date());

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['nutritional-profile', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/nutritional/profile/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['nutritional-entries', patientId, from?.toISOString(), to?.toISOString()],
    queryFn: async () => {
      const params: Record<string, string> = { patientId: patientId! };
      if (from) params.from = from.toISOString();
      if (to) params.to = to.toISOString();
      const { data } = await api.get('/nutritional/entries', { params });
      return data;
    },
    enabled: !!patientId,
  });

  if (loadingProfile || loadingEntries) return <LoadingSpinner />;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/patients/${patientId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold">Suivi nutritionnel</h1>
        <Button size="sm" onClick={() => { setEditEntry(null); setEntryDialogOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouvelle entree
        </Button>
      </div>

      {/* Profile */}
      {profile && <NutritionalProfileForm patientId={patientId!} profile={profile} />}

      {/* Date range */}
      <div className="bg-card rounded-xl border border-border p-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Charts */}
      <NutritionalCharts entries={entries} />

      {/* Entries table */}
      {entries.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium">Entrees ({entries.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Poids</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Humeur</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Energie</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Stress</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Sommeil</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Eau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e: any) => (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setEditEntry({
                        date: e.date?.split('T')[0],
                        weight: e.weight ? parseFloat(e.weight) : undefined,
                        mood: e.mood ?? undefined,
                        energyLevel: e.energyLevel ?? undefined,
                        stressLevel: e.stressLevel ?? undefined,
                        sleepHours: e.sleepHours ? parseFloat(e.sleepHours) : undefined,
                        sleepQuality: e.sleepQuality ?? undefined,
                        waterIntake: e.waterIntake ? parseFloat(e.waterIntake) : undefined,
                        physicalActivity: e.physicalActivity ?? '',
                        mealNotes: e.mealNotes ?? '',
                        behaviorNotes: e.behaviorNotes ?? '',
                        practitionerComment: e.practitionerComment ?? '',
                      });
                      setEntryDialogOpen(true);
                    }}
                  >
                    <td className="px-4 py-2">{formatDate(e.date)}</td>
                    <td className="px-4 py-2">{e.weight ? `${parseFloat(e.weight)} kg` : '—'}</td>
                    <td className="px-4 py-2">{e.mood ?? '—'}/10</td>
                    <td className="px-4 py-2">{e.energyLevel ?? '—'}/10</td>
                    <td className="px-4 py-2">{e.stressLevel ?? '—'}/10</td>
                    <td className="px-4 py-2">{e.sleepHours ? `${parseFloat(e.sleepHours)}h` : '—'}</td>
                    <td className="px-4 py-2">{e.waterIntake ? `${parseFloat(e.waterIntake)}L` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NutritionalEntryFormDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        patientId={patientId!}
        defaultValues={editEntry ?? undefined}
      />
    </div>
  );
}
