import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, MoreHorizontal, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority: string;
  status: string;
  patient?: { id: string; firstName: string; lastName: string } | null;
};

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Termine' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'LOW', label: 'Basse' },
];

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null);

  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const patientId = searchParams.get('patientId') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { status, patientId }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (patientId) params.patientId = patientId;
      const { data } = await api.get('/tasks', { params });
      return data as TaskItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; status?: string }) =>
      api.patch(`/tasks/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tache mise a jour' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Tache supprimee' });
      setDeleteTarget(null);
    },
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  // Client-side priority filter (backend doesn't support it yet as query param)
  const tasks = (data ?? []).filter((t) => !priority || t.priority === priority);

  const pending = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'DONE');

  const openEdit = (task: TaskItem) => {
    setEditTask(task);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tâches</h1>
        <Button size="sm" onClick={() => { setEditTask(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouvelle tache
        </Button>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setParam('status', s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1.5">
          {PRIORITY_FILTERS.map((p) => (
            <Button
              key={p.value}
              variant={priority === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setParam('priority', p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardContent></Card>

      {isLoading ? (
        <LoadingSpinner />
      ) : tasks.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Aucune tache</p>
      ) : (
        <>
          {pending.length > 0 && (
            <TaskSection
              title="A faire"
              tasks={pending}
              onStatusChange={(id, s) => updateMutation.mutate({ id, status: s })}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          )}
          {done.length > 0 && (
            <TaskSection
              title="Terminees"
              tasks={done}
              done
              onStatusChange={(id, s) => updateMutation.mutate({ id, status: s })}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </>
      )}

      {/* Create dialog */}
      <TaskFormDialog
        open={dialogOpen && !editTask}
        onOpenChange={setDialogOpen}
      />

      {/* Edit dialog */}
      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => !open && setEditTask(null)}
          editId={editTask.id}
          defaultValues={{
            title: editTask.title,
            description: editTask.description ?? '',
            patientId: editTask.patient?.id ?? '',
            priority: editTask.priority as any,
            dueAt: editTask.dueAt ?? '',
          }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer la tache"
        description={`Supprimer "${deleteTarget?.title}" ?`}
        variant="destructive"
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  done,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: TaskItem[];
  done?: boolean;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title} ({tasks.length})
      </h2>
      <div className="space-y-1.5">
        {tasks.map((task) => {
          const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && !done;
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 bg-card rounded-lg border border-border p-3 ${done ? 'opacity-50' : ''} ${isOverdue ? 'border-red-300 dark:border-red-800' : ''}`}
            >
              <button
                onClick={() => onStatusChange(task.id, done ? 'PENDING' : 'DONE')}
                className="mt-0.5 shrink-0"
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.dueAt && (
                    <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {formatDate(task.dueAt)}
                    </span>
                  )}
                  {task.patient && (
                    <Link to={`/patients/${task.patient.id}`} className="text-xs text-primary hover:underline">
                      {task.patient.lastName} {task.patient.firstName}
                    </Link>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(task)}>Modifier</DropdownMenuItem>
                  {!done && task.status === 'PENDING' && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}>
                      <Play className="w-4 h-4" /> En cours
                    </DropdownMenuItem>
                  )}
                  {!done && (
                    <DropdownMenuItem onClick={() => onStatusChange(task.id, 'DONE')}>
                      <CheckCircle2 className="w-4 h-4" /> Terminer
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task)}>
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
