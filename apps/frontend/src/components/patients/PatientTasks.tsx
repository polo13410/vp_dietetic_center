import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import api from '../../lib/api';
import { cn, formatDate } from '../../lib/utils';
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

/** The patient's to-dos: open ones first, ticked off in one click. */
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

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {visible.filter((t) => t.status !== 'DONE').length} à faire
        </p>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucune tâche</p>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => {
            const done = task.status === 'DONE';
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 bg-card rounded-lg border border-border p-3"
              >
                <button
                  onClick={() => toggle.mutate(task)}
                  className="text-muted-foreground hover:text-primary"
                  title={done ? 'Rouvrir' : 'Marquer comme faite'}
                >
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                    {task.title}
                  </p>
                  {task.dueAt && (
                    <p className="text-xs text-muted-foreground">Échéance {formatDate(task.dueAt)}</p>
                  )}
                </div>
                {!done && <StatusBadge status={task.priority} />}
              </div>
            );
          })}
        </div>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={taskDefaults}
      />
    </div>
  );
}
