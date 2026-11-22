import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@vp/types';
import { SearchX, X } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Pagination } from '../../components/shared/Pagination';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useUsers } from '../../hooks/useUsers';
import api from '../../lib/api';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditAction, type AuditEntry, patientRef } from '../../lib/audit';
import { formatLongDate, formatTime } from '../../lib/utils';

const ALL = 'ALL';

/**
 * Who read or changed what, and when. Patients appear as references only: the admin manages
 * the app, not patients, and can answer "who opened file #1a2b3c4d" without seeing names.
 */
export default function AuditPage() {
  const { data: users = [] } = useUsers();
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [patientId, setPatientId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, userId, action, patientId }],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (userId !== ALL) params.userId = userId;
      if (action !== ALL) params.action = action;
      if (patientId) params.patientId = patientId;
      return (await api.get<{ data: AuditEntry[]; meta: { total: number; totalPages: number } }>('/audit-logs', { params })).data;
    },
  });
  const filter = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const entries = data?.data ?? [];
  const filtered = userId !== ALL || action !== ALL || !!patientId;

  return (
    <>
      <PageHeader
        area="audit"
        title="Journal d’accès"
        subtitle="Chaque ouverture ou modification d’un dossier, chaque téléchargement et chaque connexion. Les patients y figurent sous forme de référence."
      />

      <div className="space-y-6">
        <Card className="flex flex-wrap items-end gap-4 p-4">
          <div className="w-60 space-y-1.5">
            <label htmlFor="audit-user" className="text-sm font-medium text-muted-foreground">
              Utilisateur
            </label>
            <Select value={userId} onValueChange={(value) => filter(() => setUserId(value))}>
              <SelectTrigger id="audit-user">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les utilisateurs</SelectItem>
                {(users as UserDto[]).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-60 space-y-1.5">
            <label htmlFor="audit-action" className="text-sm font-medium text-muted-foreground">
              Action
            </label>
            <Select value={action} onValueChange={(value) => filter(() => setAction(value))}>
              <SelectTrigger id="audit-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes les actions</SelectItem>
                {(Object.keys(AUDIT_ACTIONS) as AuditAction[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {AUDIT_ACTIONS[a].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {patientId && (
            <Button variant="outline" onClick={() => filter(() => setPatientId(''))}>
              Dossier {patientRef(patientId)} <X aria-hidden />
              <span className="sr-only">: voir tous les dossiers</span>
            </Button>
          )}
          <p className="ml-auto self-center text-base text-muted-foreground">
            {data?.meta.total ?? 0} entrée{(data?.meta.total ?? 0) > 1 ? 's' : ''}
          </p>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <LoadingSpinner />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={SearchX}
              area="audit"
              title={filtered ? 'Aucune entrée ne correspond à ces filtres.' : 'Aucune entrée pour l’instant.'}
              action={
                filtered && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      filter(() => {
                        setUserId(ALL);
                        setAction(ALL);
                        setPatientId('');
                      })
                    }
                  >
                    Effacer les filtres
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-sm text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Utilisateur</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Sur</th>
                    <th className="px-5 py-3 font-medium">Dossier</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Adresse IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => (
                    <tr key={e.id} className="h-14">
                      <td className="whitespace-nowrap px-5 py-2 tabular-nums">
                        {formatLongDate(e.createdAt, true)} · {formatTime(e.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2">
                        {e.user.firstName} {e.user.lastName}
                      </td>
                      <td className="px-5 py-2">
                        <StatusBadge
                          status={e.action}
                          label={AUDIT_ACTIONS[e.action]?.label ?? e.action}
                          tone={AUDIT_ACTIONS[e.action]?.tone ?? 'neutral'}
                        />
                      </td>
                      <td className="px-5 py-2 text-muted-foreground">{AUDIT_ENTITIES[e.entity] ?? e.entity}</td>
                      <td className="px-5 py-2">
                        {e.patientId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="font-mono"
                            onClick={() => filter(() => setPatientId(e.patientId!))}
                            aria-label={`Voir tous les accès au dossier ${patientRef(e.patientId)}`}
                          >
                            {patientRef(e.patientId)}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-2 font-mono text-xs text-muted-foreground">{e.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />}
      </div>
    </>
  );
}
