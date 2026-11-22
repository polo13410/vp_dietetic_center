import { Flag, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  EVENT_CATEGORIES,
  type LifeEvent,
  type LifeEventCategory,
  useLifeEvents,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { formatLongDate, todayISO } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../ui/toaster';

/** Native field style, for the selects and inputs not built on `Input` (session screen) */
export const fieldClass =
  'w-full min-h-11 rounded-lg border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A form to record a life event (« fait marquant »), inside a session or not. */
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        <Button onClick={submit} disabled={!title.trim() || create.isPending}>
          Ajouter le fait marquant
        </Button>
      </div>
    </div>
  );
}

/** Life events (« faits marquants »): they annotate the weight curve. */
export function LifeEventsPanel({ patientId }: { patientId: string }) {
  const { data: events = [] } = useLifeEvents(patientId);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<LifeEvent | null>(null);
  const remove = usePatientFileMutation(patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${patientId}/life-events/${id}`,
  }));

  return (
    <Section
      size="compact"
      icon={Flag}
      area="patients"
      title="Faits marquants"
      description="Ils s’affichent sur la courbe de poids."
      action={
        !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Ajouter
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {adding && <LifeEventForm patientId={patientId} onDone={() => setAdding(false)} />}
        {events.length === 0 ? (
          !adding && <p className="text-base text-muted-foreground">Aucun fait marquant noté.</p>
        ) : (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex min-h-14 items-center justify-between gap-3">
                <span>
                  <span className="text-sm text-muted-foreground">{formatLongDate(e.date, true)} · </span>
                  {e.title}
                  {e.category && <span className="text-sm text-muted-foreground"> · {EVENT_CATEGORIES[e.category]}</span>}
                </span>
                <Button size="icon" variant="ghost" aria-label={`Supprimer : ${e.title}`} onClick={() => setDeleting(e)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer ce fait marquant ?"
        description={deleting ? `« ${deleting.title} » ne s’affichera plus sur la courbe.` : ''}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </Section>
  );
}
