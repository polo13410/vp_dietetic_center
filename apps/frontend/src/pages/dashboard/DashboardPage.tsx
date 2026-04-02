import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, CheckSquare, FileText, Clock } from 'lucide-react';
import { Link } from 'react-router';

import api from '../../lib/api';
import { useCurrentUser } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { formatDateTime, formatDate } from '../../lib/utils';
import type { DashboardSummary, AppointmentStatus } from '@vp/types';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Prévu',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Réalisé',
  CANCELLED: 'Annulé',
  NO_SHOW: 'Absent',
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-slate-50 text-slate-600',
  CANCELLED: 'bg-red-50 text-red-600',
  NO_SHOW: 'bg-orange-50 text-orange-600',
};

export default function DashboardPage() {
  const user = useCurrentUser();

  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/summary');
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;

  const today = new Date();

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Bonjour, {user?.firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="w-4 h-4 text-primary" />}
          label="Patients actifs"
          value={data?.activePatientCount ?? 0}
          href="/patients"
        />
        <KpiCard
          icon={<Calendar className="w-4 h-4 text-blue-600" />}
          label="RDV aujourd'hui"
          value={data?.todayAppointments.length ?? 0}
          href="/appointments"
        />
        <KpiCard
          icon={<CheckSquare className="w-4 h-4 text-amber-600" />}
          label="Tâches en cours"
          value={data?.pendingTasks.length ?? 0}
          href="/tasks"
        />
        <KpiCard
          icon={<FileText className="w-4 h-4 text-slate-500" />}
          label="Brouillons"
          value={data?.draftNotes.length ?? 0}
          href="/notes"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's appointments */}
        <section className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Rendez-vous du jour</h2>
            <Link to="/appointments" className="text-xs text-primary hover:underline">
              Voir tout
            </Link>
          </div>
          {!data?.todayAppointments.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun rendez-vous aujourd'hui
            </p>
          ) : (
            <div className="space-y-2">
              {data.todayAppointments.map((appt) => (
                <Link
                  key={appt.id}
                  to={`/appointments/${appt.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-1.5 h-8 rounded-full bg-primary/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(appt as any).patient?.firstName} {(appt as any).patient?.lastName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(appt.startAt, 'HH:mm')} ({appt.duration}min)
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[appt.status]
                    }`}
                  >
                    {STATUS_LABELS[appt.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Pending tasks */}
        <section className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Tâches à faire</h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline">
              Voir tout
            </Link>
          </div>
          {!data?.pendingTasks.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune tâche en attente 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {data.pendingTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-start gap-2.5 p-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      task.priority === 'URGENT' || task.priority === 'HIGH'
                        ? 'bg-red-500'
                        : task.priority === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        Échéance : {formatDate(task.dueAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="bg-white rounded-xl border border-border p-4 hover:border-primary/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </Link>
  );
}
