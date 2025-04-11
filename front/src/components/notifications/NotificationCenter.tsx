import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Notification, useNotification } from "@/contexts/NotificationContext";
import { toast } from "@/hooks/use-toast";
import { Bell, BellDot } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const NotificationItem: React.FC<{ notification: Notification }> = ({
  notification,
}) => {
  const { markAsRead, removeNotification } = useNotification();
  const handleClick = () => {
    // Mark notification as read when clicked
    if (!notification.read) {
      markAsRead(notification.id);
    }
    // Show the notification content in a toast
    toast({
      title: notification.title,
      description: notification.description,
      variant: notification.type === "error" ? "destructive" : "default",
    });
  };

  const getNotificationStyles = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "border-l-4 border-green-500";
      case "error":
        return "border-l-4 border-destructive";
      case "warning":
        return "border-l-4 border-yellow-500";
      case "info":
        return "border-l-4 border-blue-500";
      default:
        return "border-l-4 border-primary";
    }
  };

  return (
    <div
      className={`p-3 hover:bg-accent rounded-md cursor-pointer ${
        notification.read ? "opacity-70" : ""
      } ${getNotificationStyles(notification.type)}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="font-medium">{notification.title}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            removeNotification(notification.id);
          }}
        >
          <span className="sr-only">Remove notification</span>
          &times;
        </Button>
      </div>
      {notification.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.description}
        </p>
      )}
      {!notification.read && (
        <div className="mt-1 text-xs flex justify-end">
          <Badge variant="outline" className="bg-primary/10">
            New
          </Badge>
        </div>
      )}
    </div>
  );
};

const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, clearAllNotifications } =
    useNotification();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellDot size={20} />
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
          ) : (
            <Bell size={20} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-4 py-3 font-medium flex justify-between items-center">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={clearAllNotifications}
            >
              Clear all
            </Button>
          )}
          <Link
            to="/notifications"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <span>Demo</span>
          </Link>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[calc(80vh-10rem)] max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationCenter;
