import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle2, FileText } from 'lucide-react';
import { Link } from 'react-router';

import api from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';
import { LoadingSpinner } from '../ui/loading-screen';

interface TimelineItem {
  id: string;
  type: 'appointment' | 'note' | 'task';
  date: string;
  title: string;
  subtitle?: string;
  status: string;
  href: string;
}

const TYPE_CONFIG = {
  appointment: { icon: Calendar, color: 'bg-blue-500', label: 'Rendez-vous' },
  note: { icon: FileText, color: 'bg-emerald-500', label: 'Note' },
  task: { icon: CheckCircle2, color: 'bg-amber-500', label: 'Tache' },
};

interface PatientTimelineProps {
  patientId: string;
}

export function PatientTimeline({ patientId }: PatientTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/patients/${patientId}/timeline`);
      return data;
    },
    enabled: !!patientId,
  });

  if (isLoading) return <LoadingSpinner />;

  const items: TimelineItem[] = [];

  // Map appointments
  (data?.appointments ?? []).forEach((a: any) => {
    items.push({
      id: a.id,
      type: 'appointment',
      date: a.startAt,
      title: `${a.type === 'IN_PERSON' ? 'Cabinet' : a.type === 'VIDEO' ? 'Video' : 'Telephone'} — ${a.duration} min`,
      subtitle: a.reason || undefined,
      status: a.status,
      href: `/appointments/${a.id}`,
    });
  });

  // Map notes
  (data?.notes ?? []).forEach((n: any) => {
    items.push({
      id: n.id,
      type: 'note',
      date: n.createdAt,
      title: n.title || 'Note sans titre',
      subtitle: n.type === 'STRUCTURED' ? 'Note structuree' : 'Note libre',
      status: n.status,
      href: `/notes/${n.id}`,
    });
  });

  // Map tasks
  (data?.tasks ?? []).forEach((t: any) => {
    items.push({
      id: t.id,
      type: 'task',
      date: t.dueAt || t.completedAt || t.createdAt,
      title: t.title,
      subtitle: t.priority,
      status: t.status,
      href: '/tasks',
    });
  });

  // Sort chronologically (newest first)
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucun evenement</p>;
  }

  return (
    <div className="relative pl-8 space-y-4">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      {items.map((item) => {
        const config = TYPE_CONFIG[item.type];
        const Icon = config.icon;

        return (
          <Link
            key={`${item.type}-${item.id}`}
            to={item.href}
            className="relative flex gap-3 group"
          >
            {/* Dot */}
            <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full ${config.color} flex items-center justify-center`}>
              <Icon className="w-3 h-3 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 bg-card rounded-lg border border-border p-3 group-hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                  )}
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {formatDateTime(item.date)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
