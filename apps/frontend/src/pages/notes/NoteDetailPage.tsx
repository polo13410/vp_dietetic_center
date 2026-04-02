import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: note, isLoading } = useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const { data } = await api.get(`/notes/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { mutate: finalize, isPending } = useMutation({
    mutationFn: () => api.post(`/notes/${id}/finalize`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['note', id] }),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!note) return <p className="text-muted-foreground">Note introuvable</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/notes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="flex-1 text-xl font-semibold truncate">{note.title ?? 'Note sans titre'}</h1>
        {note.status === 'DRAFT' && (
          <Button size="sm" variant="outline" onClick={() => finalize()} disabled={isPending}>
            <Lock className="w-4 h-4" /> Finaliser
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span
          className={`px-2 py-0.5 rounded-full font-medium ${note.status === 'FINALIZED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
        >
          {note.status === 'FINALIZED' ? 'Finalisé' : 'Brouillon'}
        </span>
        <span>{note.type}</span>
        <span>Modifié le {formatDateTime(note.updatedAt)}</span>
        {note.finalizedAt && <span>Finalisé le {formatDateTime(note.finalizedAt)}</span>}
      </div>

      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Contenu</p>
          <p className="text-sm whitespace-pre-line">{note.content}</p>
        </div>
        {note.sessionObjectives && (
          <Section title="Objectifs de séance" content={note.sessionObjectives} />
        )}
        {note.actionPlan && <Section title="Plan d'action" content={note.actionPlan} />}
        {note.followUpItems && <Section title="Points de suivi" content={note.followUpItems} />}
        {note.observations && <Section title="Observations" content={note.observations} />}
      </div>
    </div>
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
