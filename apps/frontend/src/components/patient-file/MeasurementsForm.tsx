import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import api from '../../lib/api';
import { METRIC_TYPES, METRICS, type MetricType, useInvalidatePatientFile } from '../../lib/patient-file';
import { todayISO } from '../../lib/utils';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../ui/toaster';

/** The measurements taken at most sessions; the others are one click away. */
const COMMON: MetricType[] = ['WEIGHT', 'WAIST'];

/**
 * Enter several measurements at once. Inside a session they are dated with the session;
 * otherwise the date can be chosen (e.g. a weight the patient sent by email).
 */
export function MeasurementsForm({
  patientId,
  consultationId,
  needsHeight,
  types,
  onSaved,
}: {
  patientId: string;
  consultationId?: string;
  /** No height on file yet: ask for it (BMI needs it). */
  needsHeight?: boolean;
  /** The measurements offered (all of them, without the « Autres mesures » link) */
  types?: MetricType[];
  onSaved?: () => void;
}) {
  const invalidate = useInvalidatePatientFile();
  const [values, setValues] = useState<Partial<Record<MetricType, string>>>({});
  const [showAll, setShowAll] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [saving, setSaving] = useState(false);

  const shown =
    types ?? (showAll ? METRIC_TYPES : [...(needsHeight ? (['HEIGHT'] as MetricType[]) : []), ...COMMON]);
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
    <div className="space-y-4">
      {!consultationId && (
        <Field label="Date" className="max-w-[14rem]">
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {shown.map((type) => {
          const meta = METRICS[type];
          return (
            <Field key={type} label={`${meta.label} (${meta.unit})`}>
              <Input
                inputMode="decimal"
                value={values[type] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </Field>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!types && !showAll ? (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            <Plus aria-hidden /> Autres mesures
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={saving || filled.length === 0}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer {filled.length > 1 ? `les ${filled.length} mesures` : 'la mesure'}
        </Button>
      </div>
    </div>
  );
}
