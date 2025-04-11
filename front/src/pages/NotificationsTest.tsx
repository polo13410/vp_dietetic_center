import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import NotificationDemo from "@/components/notifications/NotificationDemo";
import { useState } from "react";

const NotifTest = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  return (
    <div className="min-h-screen">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <Header sidebarWidth={sidebarWidth} />
      <main
        className="pt-24 pb-16 px-6 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Notifications Demo</h1>
          <NotificationDemo />
        </div>
      </main>
    </div>
  );
};

export default NotifTest;
