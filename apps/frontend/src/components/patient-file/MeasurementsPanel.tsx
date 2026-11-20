import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  formatMetric,
  METRIC_TYPES,
  METRICS,
  type Measurement,
  useLifeEvents,
  useMeasurements,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

import { LifeEventsPanel } from './LifeEventsPanel';
import { MeasurementsForm } from './MeasurementsForm';
import { MetricsChart } from './MetricsChart';

/** Measurements over time, against the patient's life events, with the full history below. */
export function MeasurementsPanel({ patientId }: { patientId: string }) {
  const { data: measurements = [] } = useMeasurements(patientId);
  const { data: events = [] } = useLifeEvents(patientId);
  const [adding, setAdding] = useState(false);
  const remove = usePatientFileMutation(patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${patientId}/measurements/${id}`,
  }));

  // One row per date, one column per measured type
  const { rows, columns } = useMemo(() => {
    const byDate = new Map<string, Partial<Record<string, Measurement>>>();
    for (const m of measurements) {
      const day = m.measuredAt.slice(0, 10);
      byDate.set(day, { ...byDate.get(day), [m.type]: m });
    }
    const present = new Set(measurements.map((m) => m.type));
    return {
      rows: [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)),
      columns: METRIC_TYPES.filter((t) => present.has(t)),
    };
  }, [measurements]);

  return (
    <div className="space-y-5">
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Évolution</h3>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter des mesures
          </Button>
        </div>
        <MetricsChart measurements={measurements} events={events} />
      </section>

      {rows.length > 0 && (
        <section className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                {columns.map((t) => (
                  <th key={t} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {METRICS[t].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([day, values]) => (
                <tr key={day} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(day)}</td>
                  {columns.map((t) => {
                    const m = values[t];
                    return (
                      <td key={t} className="px-3 py-2 text-right whitespace-nowrap group">
                        {m ? (
                          <span className="inline-flex items-center gap-1">
                            {formatMetric(t, m.value)}
                            {/* Measurements taken in a session are changed from that session */}
                            {!m.consultationId && (
                              <button
                                onClick={() => remove.mutate(m.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <LifeEventsPanel patientId={patientId} />

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter des mesures</DialogTitle>
          </DialogHeader>
          <MeasurementsForm
            patientId={patientId}
            needsHeight={!measurements.some((m) => m.type === 'HEIGHT')}
            onSaved={() => setAdding(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
