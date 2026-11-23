import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CheckSquare, Circle, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import api from '../../lib/api';
import { FILE_ANCHORS } from '../../lib/patient-file';
import { cn, formatLongDate } from '../../lib/utils';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { TaskFormDialog } from '../tasks/TaskFormDialog';
import { Button } from '../ui/button';

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority: string;
  status: string;
};

/** « À faire pour ce patient », in the « Suivi » tab: open ones first, ticked off in one click. */
export function PatientTasks({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Stable object: the dialog resets its form whenever its default values change
  const taskDefaults = useMemo(() => ({ patientId }), [patientId]);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', { patientId }],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params: { patientId } });
      return data as TaskItem[];
    },
  });

  const toggle = useMutation({
    mutationFn: (task: TaskItem) =>
      api.patch(`/tasks/${task.id}`, { status: task.status === 'DONE' ? 'PENDING' : 'DONE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const visible = tasks
    .filter((t) => t.status !== 'CANCELLED')
    .sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'));

  const todo = visible.filter((t) => t.status !== 'DONE').length;

  return (
    <Section
      size="compact"
      icon={CheckSquare}
      area="patients"
      title="À faire pour ce patient"
      id={FILE_ANCHORS.tasks}
      description={visible.length > 0 ? `${todo} à faire` : undefined}
      action={
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus aria-hidden /> Nouvelle tâche
        </Button>
      }
    >
      {visible.length === 0 ? (
        <p className="text-base text-muted-foreground">Aucune tâche pour ce patient.</p>
      ) : (
        <ul className="divide-y">
          {visible.map((task) => {
            const done = task.status === 'DONE';
            return (
              <li key={task.id} className="flex min-h-14 items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggle.mutate(task)}
                  aria-label={done ? `Rouvrir : ${task.title}` : `Marquer comme faite : ${task.title}`}
                >
                  {done ? <CheckCircle2 className="text-primary" aria-hidden /> : <Circle aria-hidden />}
                </Button>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>{task.title}</p>
                  {task.dueAt && (
                    <p className="text-sm text-muted-foreground">Échéance : {formatLongDate(task.dueAt, true)}</p>
                  )}
                </div>
                {!done && <StatusBadge status={task.priority} />}
              </li>
            );
          })}
        </ul>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={taskDefaults}
      />
    </Section>
  );
}
