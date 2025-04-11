
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { LogOut, Search, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  sidebarWidth: number;
  onSearch?: (query: string) => void;
}

const Header = ({ sidebarWidth, onSearch }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      className="h-16 dark:bg-sidebar border-b fixed top-0 right-0 z-20 flex items-center justify-between px-6 transition-all duration-300"
      style={{ width: `calc(100% - ${sidebarWidth}px)` }}
    >
      <div className="w-full max-w-md">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 " />
          <Input
            placeholder="Search patients, appointments..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <NotificationCenter />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.name || "My Account"}</DropdownMenuLabel>
            <DropdownMenuLabel className="text-sm font-normal ">
              {user?.email || ""}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
