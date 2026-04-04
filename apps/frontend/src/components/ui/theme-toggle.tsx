import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLocalStorage } from '../../hooks/use-local-storage';

import { Button } from './button';

export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('ui-theme', 'light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="opacity-0 w-10 h-10" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
      className="rounded-full"
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-primary" />
      ) : (
        <Sun className="w-4 h-4 text-primary" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
