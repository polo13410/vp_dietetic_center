import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import api from '../../lib/api';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditEntry } from '../../lib/audit';
import { formatLongDate, formatTime } from '../../lib/utils';
import { Section } from '../shared/Section';

/** Who opened or changed this patient's file, and when (the latest 100 entries). */
export function PatientAccessLog({ patientId }: { patientId: string }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['patient-access-log', patientId],
    queryFn: async () => (await api.get<AuditEntry[]>(`/patients/${patientId}/access-log`)).data,
  });

  return (
    <Section
      size="compact"
      icon={ShieldCheck}
      area="audit"
      title="Historique des accès"
      description="Chaque ouverture ou modification de ce dossier est enregistrée."
    >
      {entries.length === 0 ? (
        <p className="text-base text-muted-foreground">Aucun accès enregistré.</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
              <span className="w-44 shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatLongDate(e.createdAt, true)} à {formatTime(e.createdAt)}
              </span>
              <span className="font-medium">
                {e.user.firstName} {e.user.lastName}
              </span>
              <span className="text-muted-foreground">
                {AUDIT_ACTIONS[e.action]?.label ?? e.action} · {AUDIT_ENTITIES[e.entity] ?? e.entity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
