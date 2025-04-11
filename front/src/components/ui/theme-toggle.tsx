
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("ui-theme", "light");
  const [mounted, setMounted] = useState(false);

  // Only show the toggle after component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove the previous theme class and add the new one
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  if (!mounted) {
    // Return an invisible placeholder of the same size to avoid layout shifts
    return <Button variant="ghost" size="icon" className="opacity-0 w-10 h-10" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      className="rounded-full"
    >
      {theme === "light" ? (
        <Moon size={20} className="text-primary" />
      ) : (
        <Sun size={20} className="text-primary" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
