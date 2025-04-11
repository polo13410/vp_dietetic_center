
import React from "react";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/contexts/NotificationContext";

const NotificationDemo: React.FC = () => {
  const { addNotification } = useNotification();

  const createInfoNotification = () => {
    addNotification({
      title: "Information",
      description: "This is an informational notification",
      type: "info",
      duration: 5000,
    });
  };

  const createSuccessNotification = () => {
    addNotification({
      title: "Success",
      description: "Operation completed successfully",
      type: "success",
      duration: 5000,
    });
  };

  const createWarningNotification = () => {
    addNotification({
      title: "Warning",
      description: "This action might have consequences",
      type: "warning",
      duration: 5000,
    });
  };

  const createErrorNotification = () => {
    addNotification({
      title: "Error",
      description: "Something went wrong",
      type: "error",
      duration: 5000,
    });
  };

  const createPersistentNotification = () => {
    addNotification({
      title: "Important Update",
      description: "This notification will not disappear automatically",
      type: "default",
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Notification Demo</h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={createInfoNotification} variant="outline">
          Info Notification
        </Button>
        <Button onClick={createSuccessNotification} variant="outline">
          Success Notification
        </Button>
        <Button onClick={createWarningNotification} variant="outline">
          Warning Notification
        </Button>
        <Button onClick={createErrorNotification} variant="outline">
          Error Notification
        </Button>
        <Button onClick={createPersistentNotification} variant="outline">
          Persistent Notification
        </Button>
      </div>
    </div>
  );
};

export default NotificationDemo;
