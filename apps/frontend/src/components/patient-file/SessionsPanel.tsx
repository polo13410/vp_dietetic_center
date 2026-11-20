import { ChevronRight, Play } from 'lucide-react';
import { Link } from 'react-router';

import { useConsultations } from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';

import { useStartSession } from './useStartSession';

/** The patient's sessions, newest first, with what was recorded in each. */
export function SessionsPanel({ patientId }: { patientId: string }) {
  const { data: sessions = [] } = useConsultations(patientId);
  const start = useStartSession(patientId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sessions.length} séance{sessions.length > 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => start.mutate({})} disabled={start.isPending}>
          <Play className="h-4 w-4" /> Nouvelle séance
        </Button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aucune séance. Démarrez-en une depuis un rendez-vous ou avec « Nouvelle séance ».
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const counts = s._count;
            const parts = counts
              ? [
                  counts.measurements && `${counts.measurements} mesure${counts.measurements > 1 ? 's' : ''}`,
                  counts.topicNotes && `${counts.topicNotes} thématique${counts.topicNotes > 1 ? 's' : ''}`,
                  counts.lifeEvents && `${counts.lifeEvents} événement${counts.lifeEvents > 1 ? 's' : ''}`,
                  counts.goals && `${counts.goals} objectif${counts.goals > 1 ? 's' : ''}`,
                ].filter(Boolean)
              : [];
            return (
              <Link
                key={s.id}
                to={`/consultations/${s.id}`}
                className="flex items-center gap-4 bg-card rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
              >
                <div className="w-20 shrink-0 text-sm font-medium">{formatDate(s.date)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{s.summary || <span className="text-muted-foreground">Sans résumé</span>}</p>
                  {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>}
                </div>
                <StatusBadge status={s.status} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
