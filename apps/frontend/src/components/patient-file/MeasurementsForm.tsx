import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import api from '../../lib/api';
import { METRIC_TYPES, METRICS, type MetricType, useInvalidatePatientFile } from '../../lib/patient-file';
import { todayISO } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

/** The measurements taken at most sessions; the others are one click away. */
const COMMON: MetricType[] = ['WEIGHT', 'WAIST'];

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

/**
 * Enter several measurements at once. Inside a session they are dated with the session;
 * otherwise the date can be chosen (e.g. a weight the patient sent by email).
 */
export function MeasurementsForm({
  patientId,
  consultationId,
  needsHeight,
  onSaved,
}: {
  patientId: string;
  consultationId?: string;
  /** No height on file yet: ask for it (BMI needs it). */
  needsHeight?: boolean;
  onSaved?: () => void;
}) {
  const invalidate = useInvalidatePatientFile();
  const [values, setValues] = useState<Partial<Record<MetricType, string>>>({});
  const [showAll, setShowAll] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [saving, setSaving] = useState(false);

  const shown = showAll
    ? METRIC_TYPES
    : [...(needsHeight ? (['HEIGHT'] as MetricType[]) : []), ...COMMON];
  const filled = (Object.entries(values) as [MetricType, string][]).filter(([, v]) => v.trim() !== '');

  const save = async () => {
    if (filled.length === 0) return;
    setSaving(true);
    try {
      for (const [type, raw] of filled) {
        await api.post(`/patients/${patientId}/measurements`, {
          type,
          value: Number(raw.replace(',', '.')),
          consultationId,
          measuredAt: consultationId ? undefined : date,
        });
      }
      toast({ title: filled.length > 1 ? `${filled.length} mesures enregistrées` : 'Mesure enregistrée' });
      setValues({});
      onSaved?.();
    } catch (error: any) {
      toast({
        title: 'Mesure refusée',
        description: error?.response?.data?.message ?? 'Vérifiez les valeurs saisies',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      invalidate(patientId);
    }
  };

  return (
    <div className="space-y-3">
      {!consultationId && (
        <label className="block max-w-[12rem]">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {shown.map((type) => {
          const meta = METRICS[type];
          return (
            <label key={type} className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1">
                {meta.label} <span className="opacity-70">({meta.unit})</span>
              </span>
              <input
                inputMode="decimal"
                value={values[type] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                className={inputClass}
              />
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        {!showAll ? (
          <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline">
            <Plus className="inline h-3 w-3" /> Autres mesures
          </button>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={save} disabled={saving || filled.length === 0}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer {filled.length > 1 ? `${filled.length} mesures` : ''}
        </Button>
      </div>
    </div>
  );
}
