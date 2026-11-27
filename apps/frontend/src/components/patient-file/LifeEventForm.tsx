import { useState } from 'react';

import { EVENT_CATEGORIES, type LifeEventCategory, usePatientFileMutation } from '../../lib/patient-file';
import { todayISO } from '../../lib/utils';
import { DatePicker } from '../shared/DatePicker';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../ui/toaster';

/** Native field style, for the selects and inputs not built on `Input` (session screen) */
export const fieldClass =
  'w-full min-h-11 rounded-lg border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * A form to record a life event (« fait marquant »), inside a session or in the « Mesures » tab,
 * where life events annotate the curves.
 */
export function LifeEventForm({
  patientId,
  consultationId,
  onDone,
}: {
  patientId: string;
  consultationId?: string;
  onDone?: () => void;
}) {
  const [date, setDate] = useState(todayISO);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LifeEventCategory | ''>('');
  const create = usePatientFileMutation(patientId, () => ({
    method: 'post',
    url: `/patients/${patientId}/life-events`,
    body: { date, title, category: category || undefined, consultationId },
  }));

  const submit = () =>
    create.mutate(undefined, {
      onSuccess: () => {
        setTitle('');
        toast({ title: 'Fait marquant ajouté' });
        onDone?.();
      },
    });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Field label="Date">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Ce qui s’est passé">
          <Input
            placeholder="Ex. déménagement, nouveau traitement…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Catégorie" className="max-w-[16rem]">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LifeEventCategory | '')}
          className={fieldClass}
        >
          <option value="">Sans catégorie</option>
          {(Object.keys(EVENT_CATEGORIES) as LifeEventCategory[]).map((c) => (
            <option key={c} value={c}>
              {EVENT_CATEGORIES[c]}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button variant="outline" onClick={onDone}>
            Annuler
          </Button>
        )}
        <Button onClick={submit} disabled={!date || !title.trim() || create.isPending}>
          Ajouter le fait marquant
        </Button>
      </div>
    </div>
  );
}
