import { cn } from "@/lib/utils";
import {
  BarChart2,
  Calendar,
  Menu,
  Settings,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({
  onWidthChange,
}: {
  onWidthChange?: (width: number) => void;
}) => {
  // Use localStorage to persist the collapsed state
  const [collapsed, setCollapsed] = useState(
    localStorage.getItem("sidebarCollapsed") === "true"
  );
  const location = useLocation();

  const navItems = [
    { name: "Patients", icon: Users, path: "/patients" },
    { name: "Add Patient", icon: UserPlus, path: "/add-patient" },
    { name: "Calendar", icon: Calendar, path: "/calendar" },
    { name: "Analytics", icon: BarChart2, path: "/analytics" },
    { name: "Profile", icon: User, path: "/profile" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ];

  const sidebarWidth = collapsed ? 64 : 256;

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(sidebarWidth);
    }
  }, [collapsed, onWidthChange, sidebarWidth]);

  // Update localStorage when the collapsed state changes
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prevCollapsed) => !prevCollapsed);
  }, []);

  // Add keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log("test", { event });
      if (event.altKey && event.key === "s") {
        toggleCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleCollapsed]);

  return (
    <div
      className={cn(
        "h-screen border-r border-border transition-all duration-300 fixed left-0 top-0 z-30",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!collapsed && (
          <h1 className="text-xl font-semibold text-primary">
            Dietetic Center 🍏
          </h1>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-md hover:bg-muted"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center gap-x-3 px-3 py-3 rounded-md transition-colors",
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            )}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
