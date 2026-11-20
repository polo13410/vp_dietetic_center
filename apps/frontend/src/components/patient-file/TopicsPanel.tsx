import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

import {
  type PatientTopic,
  TOPIC_TYPES,
  TOPICS,
  type TopicNote,
  usePatientFileMutation,
  useTopicNotes,
} from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

import { fieldClass } from './LifeEventsPanel';

/** Adds a note to one topic, inside a session or not. */
export function TopicNoteForm({
  patientId,
  topic,
  consultationId,
  onDone,
}: {
  patientId: string;
  topic: PatientTopic;
  consultationId?: string;
  onDone?: () => void;
}) {
  const [content, setContent] = useState('');
  const create = usePatientFileMutation(patientId, () => ({
    method: 'post',
    url: `/patients/${patientId}/topic-notes`,
    body: { topic, content, consultationId },
  }));
  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        rows={3}
        placeholder={TOPICS[topic].hint}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={`${fieldClass} resize-y`}
      />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        )}
        <Button
          size="sm"
          disabled={!content.trim() || create.isPending}
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: () => {
                setContent('');
                toast({ title: `${TOPICS[topic].label} mis à jour` });
                onDone?.();
              },
            })
          }
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

/**
 * Each topic of the file: its current state (latest note) and how it evolved.
 * Updating a topic adds a note, the previous ones stay in the history.
 */
export function TopicsPanel({ patientId }: { patientId: string }) {
  const { data: notes = [] } = useTopicNotes(patientId);
  const byTopic = new Map<PatientTopic, TopicNote[]>();
  for (const note of notes) byTopic.set(note.topic, [...(byTopic.get(note.topic) ?? []), note]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {TOPIC_TYPES.map((topic) => (
        <TopicCard key={topic} patientId={patientId} topic={topic} notes={byTopic.get(topic) ?? []} />
      ))}
    </div>
  );
}

function TopicCard({ patientId, topic, notes }: { patientId: string; topic: PatientTopic; notes: TopicNote[] }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, ...history] = notes; // newest first

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{TOPICS[topic].label}</h3>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Plus className="h-4 w-4" /> {current ? 'Mettre à jour' : 'Renseigner'}
          </Button>
        )}
      </div>

      {editing && <TopicNoteForm patientId={patientId} topic={topic} onDone={() => setEditing(false)} />}

      {current ? (
        <div className="text-sm">
          <p className="whitespace-pre-line">{current.content}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatDate(current.createdAt)}</p>
        </div>
      ) : (
        !editing && <p className="text-sm text-muted-foreground">{TOPICS[topic].hint}</p>
      )}

      {history.length > 0 && (
        <div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Historique ({history.length})
          </button>
          {open && (
            <ol className="mt-2 space-y-2 border-l-2 border-border pl-3">
              {history.map((note) => (
                <li key={note.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                  <p className="whitespace-pre-line text-muted-foreground">{note.content}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
