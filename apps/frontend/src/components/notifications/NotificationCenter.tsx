import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellDot, Check } from 'lucide-react';
import { useNavigate } from 'react-router';

import api from '../../lib/api';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  read: boolean;
  createdAt: string;
}

function getEntityLink(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case 'appointment': return `/appointments/${entityId}`;
    case 'note': return `/notes/${entityId}`;
    case 'patient': return `/patients/${entityId}`;
    case 'task': return '/tasks';
    default: return null;
  }
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'A l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications');
      return data as Notification[];
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/count');
      return data as { count: number };
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = countData?.count ?? 0;

  const handleClick = (notif: Notification) => {
    if (!notif.read) {
      markAsReadMutation.mutate(notif.id);
    }
    const link = getEntityLink(notif.entityType, notif.entityId);
    if (link) navigate(link);
  };

  return (
    <div className="relative group">
      <Button variant="ghost" size="icon" className="relative">
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-4 h-4" />
        )}
      </Button>

      <div className="absolute right-0 top-full mt-1 w-80 bg-popover border rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="px-4 py-3 font-medium flex justify-between items-center border-b">
          <span className="text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              <Check className="w-3 h-3 mr-1" /> Tout lire
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="p-2 space-y-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                    !notif.read ? 'bg-primary/5' : 'opacity-70'
                  }`}
                  onClick={() => handleClick(notif)}
                >
                  <div className="flex items-start gap-2">
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notif.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Aucune notification
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
