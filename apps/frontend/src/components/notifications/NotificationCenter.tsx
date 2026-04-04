import { Bell, BellDot } from 'lucide-react';

import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from '../ui/toaster';

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead, removeNotification } = useNotificationStore();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    toast({
      title: notification.title,
      description: notification.description,
      variant: notification.type === 'error' ? 'destructive' : 'default',
    });
  };

  const getNotificationStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-green-500';
      case 'error':
        return 'border-l-4 border-destructive';
      case 'warning':
        return 'border-l-4 border-yellow-500';
      case 'info':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-primary';
    }
  };

  return (
    <div
      className={`p-3 hover:bg-accent rounded-md cursor-pointer ${
        notification.read ? 'opacity-70' : ''
      } ${getNotificationStyles(notification.type)}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="font-medium text-sm">{notification.title}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            removeNotification(notification.id);
          }}
        >
          <span className="sr-only">Supprimer la notification</span>
          &times;
        </Button>
      </div>
      {notification.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{notification.description}</p>
      )}
      {!notification.read && (
        <div className="mt-1 text-xs flex justify-end">
          <Badge variant="outline" className="bg-primary/10">
            Nouveau
          </Badge>
        </div>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const { notifications, unreadCount, clearAllNotifications } = useNotificationStore();

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
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={clearAllNotifications}
            >
              Tout effacer
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
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
