import { AlertCircle, Check, Loader2 } from 'lucide-react';

import type { SaveState } from '../../hooks/useAutosave';
import { cn, formatTime } from '../../lib/utils';

/** « Enregistré à 14 h 32 » under an autosaved field (docs/DESIGN.md § 7). Nothing before the first change. */
export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        state.status === 'error' ? 'font-medium text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {state.status === 'saving' && (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden /> Enregistrement…
        </>
      )}
      {state.status === 'saved' && state.savedAt && (
        <>
          <Check className="size-4 text-success" aria-hidden /> Enregistré à {formatTime(state.savedAt)}
        </>
      )}
      {state.status === 'error' && (
        <>
          <AlertCircle className="size-4" aria-hidden /> Non enregistré. Vérifiez la connexion, puis modifiez à
          nouveau le texte.
        </>
      )}
    </p>
  );
}
