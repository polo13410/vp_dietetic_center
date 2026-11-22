import { Plus, Ruler, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  formatMetric,
  METRICS,
  type Measurement,
  type MetricType,
  useLifeEvents,
  useMeasurements,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatLongDate } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

import { MeasurementsForm } from './MeasurementsForm';
import { MetricsChart } from './MetricsChart';

/** Measurements besides weight and height, for those who take them (« Pour aller plus loin »). */
export const EXTRA_METRICS: MetricType[] = ['WAIST', 'HIP', 'BODY_FAT', 'MUSCLE_MASS'];

/** The extra measurements over time, with the full list below (each one can be deleted). */
export function MeasurementsPanel({ patientId }: { patientId: string }) {
  const { data: all = [] } = useMeasurements(patientId);
  const { data: events = [] } = useLifeEvents(patientId);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Measurement | null>(null);
  const remove = usePatientFileMutation(patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${patientId}/measurements/${id}`,
  }));
  const measurements = useMemo(
    () => all.filter((m) => EXTRA_METRICS.includes(m.type)).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
    [all],
  );

  return (
    <Section
      size="compact"
      icon={Ruler}
      area="patients"
      title="Mesures complémentaires"
      description="Tour de taille, hanches, masse grasse, masse musculaire"
      action={
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Ajouter des mesures
        </Button>
      }
    >
      {measurements.length === 0 ? (
        <p className="text-base text-muted-foreground">Aucune mesure complémentaire.</p>
      ) : (
        <div className="space-y-3">
          <MetricsChart measurements={all} events={events} types={EXTRA_METRICS} className="h-48" />
          <ul className="divide-y">
            {measurements.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{METRICS[m.type].label}</span> · {formatMetric(m.type, m.value)}
                  <span className="text-sm text-muted-foreground"> · {formatLongDate(m.measuredAt, true)}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Supprimer : ${METRICS[m.type].label} du ${formatLongDate(m.measuredAt, true)}`}
                  onClick={() => setDeleting(m)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter des mesures</DialogTitle>
          </DialogHeader>
          <MeasurementsForm patientId={patientId} types={EXTRA_METRICS} onSaved={() => setAdding(false)} />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer cette mesure ?"
        description={
          deleting
            ? `${METRICS[deleting.type].label} du ${formatLongDate(deleting.measuredAt)} : ${formatMetric(deleting.type, deleting.value)}.`
            : ''
        }
        confirmLabel="Supprimer la mesure"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </Section>
  );
}
