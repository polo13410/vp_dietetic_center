import { Link, useSearchParams } from 'react-router';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

export default function NotesPage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');

  const { data, isLoading } = useQuery({
    queryKey: ['notes', { patientId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (patientId) params.set('patientId', patientId);
      const { data } = await api.get(`/notes?${params}`);
      return data;
    },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notes cliniques</h1>
        <Button size="sm">
          <Plus className="w-4 h-4" /> Nouvelle note
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <LoadingSpinner />
        ) : !data?.length ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucune note</p>
        ) : (
          data.map((note: any) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="flex items-start gap-3 bg-white rounded-xl border border-border p-4 hover:border-primary/20 transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${note.status === 'FINALIZED' ? 'bg-green-500' : 'bg-amber-400'}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {note.title ?? 'Note sans titre'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(note.updatedAt)} — {note.type} — {note.status}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
