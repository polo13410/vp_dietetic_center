import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'FINALIZED', label: 'Finalise' },
];

const TYPE_FILTERS = [
  { value: '', label: 'Tous types' },
  { value: 'FREE', label: 'Libre' },
  { value: 'STRUCTURED', label: 'Structuree' },
];

export default function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const status = searchParams.get('status') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['notes', { patientId, status }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (patientId) params.patientId = patientId;
      if (status) params.status = status;
      const { data } = await api.get('/notes', { params });
      return data;
    },
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  // Client-side type filter (backend doesn't support it as query param)
  const typeFilter = searchParams.get('type') || '';
  const notes = (data ?? []).filter((note: any) => !typeFilter || note.type === typeFilter);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notes cliniques</h1>
        <Button size="sm" asChild>
          <Link to={patientId ? `/notes/new?patientId=${patientId}` : '/notes/new'}>
            <Plus className="w-4 h-4" /> Nouvelle note
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap gap-3 items-center">
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
          {TYPE_FILTERS.map((t) => (
            <Button
              key={t.value}
              variant={typeFilter === t.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setParam('type', t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <LoadingSpinner />
        ) : notes.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucune note</p>
        ) : (
          notes.map((note: any) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${note.status === 'FINALIZED' ? 'bg-green-500' : 'bg-amber-400'}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {note.title ?? 'Note sans titre'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(note.updatedAt)}
                  {note.patient && ` — ${note.patient.lastName} ${note.patient.firstName}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={note.type} />
                <StatusBadge status={note.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
