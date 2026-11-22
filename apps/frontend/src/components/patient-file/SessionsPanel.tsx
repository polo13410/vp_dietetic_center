import { ChevronRight, Play } from 'lucide-react';
import { Link } from 'react-router';

import { PAYMENT_METHODS, sessionName, useConsultations } from '../../lib/patient-file';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/button';

import { useStartSession } from './useStartSession';

/** The patient's sessions, newest first: her follow-up sheet, with the computed figures. */
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
            const { weight, bmi, bmr } = s.figures;
            const parts = [
              s.formulaLabel,
              PAYMENT_METHODS[s.paymentMethod],
              weight !== null && `${weight.toLocaleString('fr-FR')} kg`,
              bmi && `IMC ${bmi.value.toLocaleString('fr-FR')}`,
              bmr && `MB ${bmr.mj.toLocaleString('fr-FR')} MJ · ${bmr.kcal.toLocaleString('fr-FR')} kcal`,
            ].filter(Boolean);
            return (
              <Link
                key={s.id}
                to={`/consultations/${s.id}`}
                className="flex items-center gap-4 bg-card rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
              >
                <div className="w-20 shrink-0 text-sm">
                  <p className="font-medium">{sessionName(s.sequence)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {s.sessionWork || <span className="text-muted-foreground">Rien d’écrit</span>}
                  </p>
                  {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
