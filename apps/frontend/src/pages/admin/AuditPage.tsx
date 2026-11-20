import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@vp/types';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useUsers } from '../../hooks/useUsers';
import api from '../../lib/api';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntry, patientRef } from '../../lib/audit';
import { cn, formatDate } from '../../lib/utils';

const selectClass = 'rounded-lg border border-input bg-background px-3 py-1.5 text-sm';

/**
 * Who read or changed what, and when. Patients appear as references only: the admin manages
 * the app, not patients, and can answer "who opened file #1a2b3c4d" without seeing names.
 */
export default function AuditPage() {
  const { data: users = [] } = useUsers();
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [patientId, setPatientId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, userId, action, patientId }],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (userId) params.userId = userId;
      if (action) params.action = action;
      if (patientId) params.patientId = patientId;
      return (await api.get<{ data: AuditEntry[]; meta: { total: number; totalPages: number } }>('/audit-logs', { params })).data;
    },
  });
  const filter = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const entries = data?.data ?? [];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ScrollText className="h-6 w-6 text-muted-foreground" /> Journal d’accès
        </h1>
        <p className="text-sm text-muted-foreground">
          Chaque consultation ou modification d’un dossier, chaque téléchargement et chaque connexion. Les patients
          apparaissent sous forme de référence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <select value={userId} onChange={(e) => filter(() => setUserId(e.target.value))} className={selectClass}>
          <option value="">Tous les utilisateurs</option>
          {(users as UserDto[]).map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => filter(() => setAction(e.target.value))} className={selectClass}>
          <option value="">Toutes les actions</option>
          {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTIONS[a].label}
            </option>
          ))}
        </select>
        {patientId && (
          <Button size="sm" variant="outline" onClick={() => filter(() => setPatientId(''))}>
            Patient {patientRef(patientId)} ✕
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{data?.meta.total ?? 0} entrées</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <LoadingSpinner />
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucune entrée</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Utilisateur</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Sur</th>
                <th className="px-4 py-2 text-left font-medium">Patient</th>
                <th className="px-4 py-2 text-left font-medium">Adresse IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(e.createdAt, 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-2">
                    {e.user.firstName} {e.user.lastName}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={cn(AUDIT_ACTIONS[e.action]?.className)}>
                      {AUDIT_ACTIONS[e.action]?.label ?? e.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{AUDIT_ENTITIES[e.entity] ?? e.entity}</td>
                  <td className="px-4 py-2">
                    {e.patientId ? (
                      <button
                        onClick={() => filter(() => setPatientId(e.patientId!))}
                        className="font-mono text-xs hover:text-primary"
                        title="Voir tous les accès à ce dossier"
                      >
                        {patientRef(e.patientId)}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(data?.meta.totalPages ?? 1) > 1 && (
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Button>
          <Button variant="outline" size="sm" disabled={page >= (data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
