import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Loader2, Lock, Save, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';

import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

const editSchema = z.object({
  type: z.enum(['FREE', 'STRUCTURED']),
  title: z.string().optional(),
  content: z.string().min(1, 'Contenu requis'),
  sessionObjectives: z.string().optional(),
  actionPlan: z.string().optional(),
  followUpItems: z.string().optional(),
  observations: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const { data } = await api.get(`/notes/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { mutate: finalize, isPending: finalizing } = useMutation({
    mutationFn: () => api.post(`/notes/${id}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', id] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note finalisee' });
      setFinalizeOpen(false);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!note) return <p className="text-muted-foreground">Note introuvable</p>;

  const isDraft = note.status === 'DRAFT';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/notes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold truncate">{note.title ?? 'Note sans titre'}</h1>
        {isDraft && !editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit className="w-4 h-4" /> Modifier
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFinalizeOpen(true)}>
              <Lock className="w-4 h-4" /> Finaliser
            </Button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <StatusBadge status={note.status} />
        <StatusBadge status={note.type} />
        <span>Modifie le {formatDateTime(note.updatedAt)}</span>
        {note.finalizedAt && <span>Finalise le {formatDateTime(note.finalizedAt)}</span>}
      </div>

      {/* Content — view or edit */}
      {editing && isDraft ? (
        <NoteEditForm
          note={note}
          noteId={id!}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Contenu</p>
            <p className="text-sm whitespace-pre-line">{note.content}</p>
          </div>
          {note.sessionObjectives && <Section title="Objectifs de seance" content={note.sessionObjectives} />}
          {note.actionPlan && <Section title="Plan d'action" content={note.actionPlan} />}
          {note.followUpItems && <Section title="Points de suivi" content={note.followUpItems} />}
          {note.observations && <Section title="Observations" content={note.observations} />}
        </div>
      )}

      {/* Finalize confirm */}
      <ConfirmDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title="Finaliser la note"
        description="Une fois finalisee, la note ne pourra plus etre modifiee. Etes-vous sur ?"
        confirmLabel="Finaliser"
        loading={finalizing}
        onConfirm={() => finalize()}
      />
    </div>
  );
}

function NoteEditForm({
  note,
  noteId,
  onDone,
}: {
  note: any;
  noteId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      type: note.type,
      title: note.title ?? '',
      content: note.content,
      sessionObjectives: note.sessionObjectives ?? '',
      actionPlan: note.actionPlan ?? '',
      followUpItems: note.followUpItems ?? '',
      observations: note.observations ?? '',
    },
  });

  const noteType = watch('type');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: EditFormData) => api.patch(`/notes/${noteId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note mise a jour' });
      onDone();
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex gap-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <>
                <Button type="button" variant={field.value === 'FREE' ? 'default' : 'outline'} size="sm" onClick={() => field.onChange('FREE')}>Libre</Button>
                <Button type="button" variant={field.value === 'STRUCTURED' ? 'default' : 'outline'} size="sm" onClick={() => field.onChange('STRUCTURED')}>Structuree</Button>
              </>
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Titre</label>
          <input {...register('title')} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Contenu *</label>
          <textarea {...register('content')} rows={6} className={`${inputClass} resize-none`} />
          {errors.content && <p className="text-xs text-destructive mt-1">{errors.content.message}</p>}
        </div>

        {noteType === 'STRUCTURED' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5">Objectifs de seance</label>
              <textarea {...register('sessionObjectives')} rows={3} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Plan d'action</label>
              <textarea {...register('actionPlan')} rows={3} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Points de suivi</label>
              <textarea {...register('followUpItems')} rows={3} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Observations</label>
              <textarea {...register('observations')} rows={3} className={`${inputClass} resize-none`} />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          <X className="w-4 h-4" /> Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <p className="text-sm whitespace-pre-line">{content}</p>
    </div>
  );
}
