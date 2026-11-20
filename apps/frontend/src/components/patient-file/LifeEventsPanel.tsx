import { Flag, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  EVENT_CATEGORIES,
  type LifeEventCategory,
  useLifeEvents,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

export const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

/** A form to record a life event, inside a session or not. */
export function LifeEventForm({
  patientId,
  consultationId,
  onDone,
}: {
  patientId: string;
  consultationId?: string;
  onDone?: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LifeEventCategory>('OTHER');
  const [description, setDescription] = useState('');
  const create = usePatientFileMutation(patientId, () => ({
    method: 'post',
    url: `/patients/${patientId}/life-events`,
    body: { date, title, category, description: description || undefined, consultationId },
  }));

  const submit = () =>
    create.mutate(undefined, {
      onSuccess: () => {
        setTitle('');
        setDescription('');
        toast({ title: 'Événement ajouté' });
        onDone?.();
      },
    });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[9rem_1fr] gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        <input
          placeholder="Ex. déménagement, nouveau traitement, séparation…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-[9rem_1fr] gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LifeEventCategory)}
          className={fieldClass}
        >
          {(Object.keys(EVENT_CATEGORIES) as LifeEventCategory[]).map((c) => (
            <option key={c} value={c}>
              {EVENT_CATEGORIES[c]}
            </option>
          ))}
        </select>
        <input
          placeholder="Détails (facultatif)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!title.trim() || create.isPending}>
          Ajouter l’événement
        </Button>
      </div>
    </div>
  );
}

export function LifeEventsPanel({ patientId }: { patientId: string }) {
  const { data: events = [] } = useLifeEvents(patientId);
  const [adding, setAdding] = useState(false);
  const remove = usePatientFileMutation(patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${patientId}/life-events/${id}`,
  }));

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Flag className="h-4 w-4 text-purple-500" /> Événements de vie
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        )}
      </div>
      {adding && <LifeEventForm patientId={patientId} onDone={() => setAdding(false)} />}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Notez ce qui se passe dans la vie du patient : ces événements apparaissent sur les courbes.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2 text-sm group">
              <span className="w-20 shrink-0 text-xs text-muted-foreground pt-0.5">{formatDate(e.date)}</span>
              <div className="flex-1">
                <p>
                  {e.title} <span className="text-xs text-muted-foreground">· {EVENT_CATEGORIES[e.category]}</span>
                </p>
                {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
              </div>
              {!e.consultationId && (
                <button
                  onClick={() => remove.mutate(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
