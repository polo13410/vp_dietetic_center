import { type ReactNode, useRef, useState } from 'react';

import { useAutosave } from '../../hooks/useAutosave';
import { useGrowingTextarea } from '../../hooks/useGrowingTextarea';
import { apiErrorMessage } from '../../hooks/useMe';
import api from '../../lib/api';
import {
  type Consultation,
  METRICS,
  type MetricType,
  type Measurement,
  useInvalidatePatientFile,
} from '../../lib/patient-file';
import { cn, formatNumber } from '../../lib/utils';
import { Field } from '../shared/Field';
import { SaveIndicator } from '../shared/SaveIndicator';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

/**
 * Keeps what she types while she is in the field or a save is pending; otherwise shows what the
 * server has (after a save, or a change made elsewhere).
 */
function useServerValue(server: string, busy: () => boolean) {
  const [value, setValue] = useState(server);
  const [shown, setShown] = useState(server);
  if (server !== shown) {
    setShown(server);
    if (!busy()) setValue(server);
  }
  return [value, setValue] as const;
}

type TextKey = 'habits' | 'sessionWork' | 'advice';

/** One of her text columns of the séance, saved as she types. */
export function SessionTextField({
  session,
  field,
  label,
  placeholder,
  before,
}: {
  session: Consultation;
  field: TextKey;
  label: string;
  placeholder?: string;
  /** Shown between the label and the field (the previous advice above « Habitudes et évolution ») */
  before?: ReactNode;
}) {
  const invalidate = useInvalidatePatientFile();
  const focused = useRef(false);
  const saved = session[field] ?? '';
  const autosave = useAutosave(async (text: string) => {
    await api.patch(`/consultations/${session.id}`, { [field]: text });
    invalidate(session.patientId);
  });
  const [text, setText] = useServerValue(saved, () => focused.current || autosave.hasPending());
  const ref = useGrowingTextarea(text);
  const id = `session-${field}`;

  return (
    <section aria-labelledby={`${id}-label`} className="space-y-2 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <label id={`${id}-label`} htmlFor={id} className="block text-xl font-semibold">
        {label}
      </label>
      {before}
      <Textarea
        ref={ref}
        id={id}
        value={text}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          void autosave.flush();
        }}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === saved) autosave.cancel();
          else autosave.schedule(e.target.value);
        }}
        className="min-h-32 resize-none overflow-hidden text-lg"
      />
      <div className="flex justify-end">
        <SaveIndicator state={autosave.state} />
      </div>
    </section>
  );
}

/** « 76,5 » for the field, from the stored number. */
const fieldValue = (m: Measurement | undefined) => (m ? formatNumber(m.value, 1) : '');

/** « 76,5 » or « 76.5 » → 76.5; null when empty, NaN when not a number. */
export function parseMeasure(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!text) return null;
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}

/**
 * A measurement taken during the séance (weight, waist…), saved as she types: written the first
 * time, corrected after, removed when the field is emptied.
 */
export function MeasureField({
  session,
  type,
  hint,
  large,
  className,
}: {
  session: Consultation;
  type: MetricType;
  hint?: string;
  /** The weight: big field, big figures */
  large?: boolean;
  className?: string;
}) {
  const invalidate = useInvalidatePatientFile();
  const meta = METRICS[type];
  const existing = session.measurements?.filter((m) => m.type === type).at(-1);
  const idRef = useRef<string | null>(existing?.id ?? null);
  if (existing?.id && !idRef.current) idRef.current = existing.id;
  const focused = useRef(false);
  const [error, setError] = useState<string>();

  const autosave = useAutosave(async (value: number | null) => {
    const base = `/patients/${session.patientId}/measurements`;
    try {
      if (value === null) {
        if (idRef.current) await api.delete(`${base}/${idRef.current}`);
        idRef.current = null;
      } else if (idRef.current) {
        await api.patch(`${base}/${idRef.current}`, { value });
      } else {
        const { data } = await api.post<Measurement>(base, { type, value, consultationId: session.id });
        idRef.current = data.id;
      }
    } catch (e) {
      // « Valeur improbable pour Poids… »: say it under the field
      setError(apiErrorMessage(e, ''));
      throw e;
    }
    invalidate(session.patientId);
  }, 700);
  const [raw, setRaw] = useServerValue(fieldValue(existing), () => focused.current || autosave.hasPending());

  return (
    <div className={cn('space-y-1', className)}>
      <Field label={`${meta.label} (${meta.unit})`} hint={hint} error={error || undefined}>
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            void autosave.flush();
          }}
          onChange={(e) => {
            setRaw(e.target.value);
            const value = parseMeasure(e.target.value);
            if (Number.isNaN(value)) {
              autosave.cancel();
              setError(`Écrivez un nombre, par exemple ${type === 'WEIGHT' ? '72,5' : '85'}.`);
              return;
            }
            setError(undefined);
            if (value === (existing?.value ?? null)) autosave.cancel();
            else autosave.schedule(value);
          }}
          className={cn(large && 'h-14 max-w-48 text-2xl font-semibold tabular-nums')}
        />
      </Field>
      <SaveIndicator state={autosave.state} />
    </div>
  );
}
