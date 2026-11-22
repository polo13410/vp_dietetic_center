import type { Theme } from '@vp/types';
import { type LucideIcon, Monitor, Moon, Palette, Sun } from 'lucide-react';

import { useSaveTheme } from '../../hooks/useMe';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../stores/themeStore';
import { Section } from '../shared/Section';

import { SaveIndicator, useSaveTracker } from './autosave';

const CHOICES: { value: Theme; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'LIGHT', label: 'Clair', description: 'Fond clair, toute la journée.', icon: Sun },
  { value: 'DARK', label: 'Sombre', description: 'Fond sombre, plus reposant le soir.', icon: Moon },
  {
    value: 'SYSTEM',
    label: 'Comme l’appareil',
    description: 'Suit le réglage de votre iPad ou de votre ordinateur.',
    icon: Monitor,
  },
];

export function AppearanceSection() {
  const theme = useThemeStore((s) => s.theme);
  const { mutateAsync: saveTheme } = useSaveTheme();
  const { state, track } = useSaveTracker();

  return (
    <Section
      icon={Palette}
      area="settings"
      title="Apparence"
      description="Les couleurs de l’application, sur tous vos appareils."
      action={<SaveIndicator state={state} />}
    >
      <fieldset>
        <legend className="sr-only">Apparence</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHOICES.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-ring',
                theme === value ? 'border-primary bg-accent' : 'border-input hover:bg-muted',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => void track(() => saveTheme(value))}
                className="sr-only"
              />
              <Icon
                className={cn('mt-0.5 size-5 shrink-0', theme === value ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden
              />
              <span>
                <span className="block text-base font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  );
}
