import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Plus } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-red-500',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-amber-500',
  LOW: 'text-slate-400',
};

export default function TasksPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await api.get('/tasks');
      return data;
    },
  });

  const { mutate: toggleTask } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  if (isLoading) return <LoadingSpinner />;

  const pending = data?.filter((t: any) => t.status !== 'DONE' && t.status !== 'CANCELLED') ?? [];
  const done = data?.filter((t: any) => t.status === 'DONE') ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tâches</h1>
        <Button size="sm">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </Button>
      </div>

      <TaskSection
        title="À faire"
        tasks={pending}
        onToggle={(id) => toggleTask({ id, status: 'DONE' })}
      />
      {done.length > 0 && <TaskSection title="Terminées" tasks={done} done />}
    </div>
  );
}

function TaskSection({ title, tasks, done, onToggle }: any) {
  return (
    <div>
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title} ({tasks.length})
      </h2>
      <div className="space-y-1.5">
        {tasks.map((task: any) => (
          <div
            key={task.id}
            className={`flex items-start gap-3 bg-white rounded-lg border border-border p-3 ${done ? 'opacity-50' : ''}`}
          >
            <button onClick={() => onToggle?.(task.id)} className="mt-0.5 flex-shrink-0">
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
                {task.dueAt && (
                  <span className="text-xs text-muted-foreground">
                    Échéance : {formatDate(task.dueAt)}
                  </span>
                )}
                {task.patient && (
                  <span className="text-xs text-muted-foreground">
                    · {task.patient.lastName} {task.patient.firstName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
