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
    return <Button variant="ghost" size="icon" className="opacity-0" aria-hidden />;
  }

  const label = theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="rounded-full text-muted-foreground hover:text-foreground"
    >
      {theme === 'light' ? <Moon /> : <Sun />}
    </Button>
  );
}
