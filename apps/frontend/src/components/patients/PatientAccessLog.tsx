import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import api from '../../lib/api';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditEntry } from '../../lib/audit';
import { formatDate } from '../../lib/utils';

/** Who opened or changed this patient's file, and when (the latest 100 entries). */
export function PatientAccessLog({ patientId }: { patientId: string }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['patient-access-log', patientId],
    queryFn: async () => (await api.get<AuditEntry[]>(`/patients/${patientId}/access-log`)).data,
  });

  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Historique des accès
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">Chaque ouverture ou modification de ce dossier est enregistrée.</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun accès enregistré.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-1.5">
              <span className="w-32 shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatDate(e.createdAt, 'dd/MM/yyyy HH:mm')}
              </span>
              <span className="w-36 shrink-0 truncate">
                {e.user.firstName} {e.user.lastName}
              </span>
              <span className="text-muted-foreground">
                {AUDIT_ACTIONS[e.action]?.label ?? e.action} · {AUDIT_ENTITIES[e.entity] ?? e.entity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
