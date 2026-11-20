import { Plus, Target } from 'lucide-react';
import { useState } from 'react';

import {
  type Goal,
  GOAL_STATUSES,
  type GoalStatus,
  useGoals,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { cn, formatDate } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

import { fieldClass } from './LifeEventsPanel';

const OPEN: GoalStatus[] = ['IN_PROGRESS', 'PARTIAL'];

/** Adds a goal, inside a session or not. */
export function GoalForm({ patientId, consultationId, onDone }: { patientId: string; consultationId?: string; onDone?: () => void }) {
  const [title, setTitle] = useState('');
  const create = usePatientFileMutation(patientId, () => ({
    method: 'post',
    url: `/patients/${patientId}/goals`,
    body: { title, consultationId },
  }));
  const submit = () =>
    create.mutate(undefined, {
      onSuccess: () => {
        setTitle('');
        onDone?.();
      },
    });
  return (
    <div className="flex gap-2">
      <input
        placeholder="Ex. prendre un petit-déjeuner chaque matin"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && title.trim() && submit()}
        className={fieldClass}
      />
      <Button size="sm" className="h-9" onClick={submit} disabled={!title.trim() || create.isPending}>
        Ajouter
      </Button>
    </div>
  );
}

/** Goals set with the patient, how each one was reviewed over the sessions. */
export function GoalsPanel({ patientId }: { patientId: string }) {
  const { data: goals = [] } = useGoals(patientId);
  const [adding, setAdding] = useState(false);
  const open = goals.filter((g) => OPEN.includes(g.status));
  const closed = goals.filter((g) => !OPEN.includes(g.status));

  return (
    <div className="space-y-4">
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-muted-foreground" /> En cours ({open.length})
          </h3>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Nouvel objectif
            </Button>
          )}
        </div>
        {adding && <GoalForm patientId={patientId} onDone={() => setAdding(false)} />}
        {open.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">Aucun objectif en cours.</p>
        )}
        {open.map((goal) => (
          <GoalRow key={goal.id} patientId={patientId} goal={goal} />
        ))}
      </section>

      {closed.length > 0 && (
        <section className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Terminés ({closed.length})</h3>
          {closed.map((goal) => (
            <GoalRow key={goal.id} patientId={patientId} goal={goal} />
          ))}
        </section>
      )}
    </div>
  );
}

function GoalRow({ patientId, goal }: { patientId: string; goal: Goal }) {
  const update = usePatientFileMutation(patientId, (status: GoalStatus) => ({
    method: 'patch',
    url: `/patients/${patientId}/goals/${goal.id}`,
    body: { status },
  }));
  const status = GOAL_STATUSES[goal.status];

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-sm font-medium', goal.status === 'ABANDONED' && 'line-through text-muted-foreground')}>
            {goal.title}
          </p>
          <p className="text-xs text-muted-foreground">
            Fixé le {formatDate(goal.consultation?.date ?? goal.createdAt)}
            {goal.closedAt && ` · clos le ${formatDate(goal.closedAt)}`}
          </p>
        </div>
        <select
          value={goal.status}
          onChange={(e) => update.mutate(e.target.value as GoalStatus)}
          className={cn('rounded-md border px-2 py-1 text-xs font-medium', status.className)}
          title="Changer le statut"
        >
          {(Object.keys(GOAL_STATUSES) as GoalStatus[]).map((s) => (
            <option key={s} value={s}>
              {GOAL_STATUSES[s].label}
            </option>
          ))}
        </select>
      </div>
      {goal.reviews && goal.reviews.length > 0 && (
        <ol className="flex flex-wrap gap-1.5">
          {goal.reviews.map((r) => (
            <li key={r.id} title={r.comment ?? undefined}>
              <Badge variant="outline" className={cn(GOAL_STATUSES[r.status].className, 'font-normal')}>
                {formatDate(r.consultation?.date ?? r.createdAt, 'dd/MM')} · {GOAL_STATUSES[r.status].label}
                {r.comment && ' 💬'}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
