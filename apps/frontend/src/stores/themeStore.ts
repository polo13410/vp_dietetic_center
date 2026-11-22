import type { Theme } from '@vp/types';
import { create } from 'zustand';

/**
 * Appearance: light, dark, or the device's. The choice is saved on the server (settings page,
 * header button) and kept on the device too, so the right colours show before sign-in and
 * without waiting for the server.
 */
const STORAGE_KEY = 'ui-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: unknown): value is Theme {
  return value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM';
}

/** The theme kept on this device (older versions stored "light"/"dark" as JSON). */
export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'SYSTEM';
    const value = (raw.startsWith('"') ? JSON.parse(raw) : raw).toUpperCase();
    return isTheme(value) ? value : 'SYSTEM';
  } catch {
    return 'SYSTEM';
  }
}

function systemIsDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

/** What the screen actually shows for a theme. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'SYSTEM') return systemIsDark() ? 'dark' : 'light';
  return theme === 'DARK' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
}

interface ThemeState {
  theme: Theme;
  /** Shows the theme and keeps it on this device (saving it on the server is up to the caller) */
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing: the theme still applies for this visit
    }
    applyTheme(theme);
    set({ theme });
  },
}));

/** Applies the stored theme at start-up and follows the device while the choice is SYSTEM. */
export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
  if (typeof window.matchMedia !== 'function') return;
  window.matchMedia(DARK_QUERY).addEventListener?.('change', () => {
    if (useThemeStore.getState().theme === 'SYSTEM') applyTheme('SYSTEM');
  });
}
