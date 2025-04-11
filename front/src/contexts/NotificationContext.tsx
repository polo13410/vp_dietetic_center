
import React, { createContext, useContext, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

export type NotificationType = "default" | "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  title: string;
  description?: string;
  type: NotificationType;
  duration?: number;
  read?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "read">) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Calculate unread notifications count
  const unreadCount = notifications.filter(notification => !notification.read).length;

  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, "id" | "read">) => {
    const id = uuidv4();
    const newNotification: Notification = {
      ...notification,
      id,
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove notification after duration if specified
    if (notification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }, []);

  // Remove a notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Mark a notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAllNotifications,
    unreadCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
