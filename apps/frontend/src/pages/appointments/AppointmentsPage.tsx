import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'SCHEDULED', label: 'Planifie' },
  { value: 'CONFIRMED', label: 'Confirme' },
  { value: 'COMPLETED', label: 'Termine' },
  { value: 'CANCELLED', label: 'Annule' },
  { value: 'NO_SHOW', label: 'Absent' },
];

export default function AppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const status = searchParams.get('status') || '';
  const patientId = searchParams.get('patientId') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', { page, status, patientId, from, to }],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (status) params.status = status;
      if (patientId) params.patientId = patientId;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get('/appointments', { params });
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      api.patch(`/appointments/${id}`, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Statut mis a jour' });
    },
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const appointments = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rendez-vous</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" /> Nouveau rendez-vous
        </Button>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4 flex flex-wrap gap-3 items-center">
        {/* Status filters */}
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
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

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-muted-foreground">Du</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setParam('from', e.target.value)}
            className="px-2 py-1.5 text-sm border border-input rounded-lg bg-background"
          />
          <label className="text-xs text-muted-foreground">au</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setParam('to', e.target.value)}
            className="px-2 py-1.5 text-sm border border-input rounded-lg bg-background"
          />
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : appointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucun rendez-vous</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Duree</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {appointments.map((appt: any) => (
                <tr key={appt.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/appointments/${appt.id}`} className="hover:text-primary">
                      {formatDate(appt.startAt, 'dd/MM/yyyy HH:mm')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/patients/${appt.patientId}`} className="hover:text-primary">
                      {appt.patient?.lastName} {appt.patient?.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={appt.type} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{appt.duration} min</td>
                  <td className="px-4 py-3"><StatusBadge status={appt.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/appointments/${appt.id}`}>Voir details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {appt.status === 'SCHEDULED' && (
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: appt.id, newStatus: 'CONFIRMED' })}>
                            Confirmer
                          </DropdownMenuItem>
                        )}
                        {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                          <>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: appt.id, newStatus: 'COMPLETED' })}>
                              Marquer termine
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: appt.id, newStatus: 'NO_SHOW' })}>
                              Marquer absent
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => updateStatusMutation.mutate({ id: appt.id, newStatus: 'CANCELLED' })}
                            >
                              Annuler
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {meta.total} rendez-vous — page {meta.page}/{meta.totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
            >
              <ChevronLeft className="w-4 h-4" /> Precedent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setParam('page', String(page + 1))}
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <AppointmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={patientId ? { patientId } : undefined}
      />
    </div>
  );
}
