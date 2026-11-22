import { Moon, Sun } from 'lucide-react';

import { useSaveTheme } from '../../hooks/useMe';
import { resolveTheme, useThemeStore } from '../../stores/themeStore';

import { Button } from './button';

/** Header shortcut: switches between light and dark (the settings page also offers « Comme l’appareil »). */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const { mutate: saveTheme } = useSaveTheme();
  const isDark = resolveTheme(theme) === 'dark';
  const label = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => saveTheme(isDark ? 'LIGHT' : 'DARK')}
      aria-label={label}
      title={label}
      className="rounded-full text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
