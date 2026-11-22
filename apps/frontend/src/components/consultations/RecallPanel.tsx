import { ChevronLeft, ChevronRight, NotebookText } from 'lucide-react';
import { type RefObject, useEffect, useId, useState } from 'react';

import { useMediaQuery } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';
import { PatientRecap } from '../patient-file/PatientRecap';
import { Button } from '../ui/button';

import { hintSeen, rememberHintSeen } from './session-route';

interface RecallPanelProps {
  patientId: string;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** iPad portrait and narrower: the panel goes over the séance instead of pushing it */
  drawer: boolean;
  /**
   * Coming from « Avant de commencer »: the panel starts as wide as this row and shrinks to the
   * left, to show where the summary went.
   */
  enterFrom?: RefObject<HTMLElement | null>;
}

/**
 * The « Rappel » beside the séance: the patient's summary as it was before it, in a narrow panel.
 * Its handle stays on its edge, open or closed; the first time, a bubble explains it.
 */
export function RecallPanel({ patientId, sessionId, open, onOpenChange, drawer, enterFrom }: RecallPanelProps) {
  const panelId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Its first paint is as wide as the row (read now: set later, the browser would animate to it
  // first), then it shrinks to its width with the CSS transition
  const [enterWidth, setEnterWidth] = useState<number | null>(() =>
    reducedMotion ? null : enterFrom?.current?.offsetWidth || null,
  );
  const [showHint, setShowHint] = useState(() => !hintSeen());

  useEffect(() => {
    if (enterWidth === null) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEnterWidth(null));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // Only when the séance appears
  }, []);

  // The drawer closes with Escape, like a menu
  useEffect(() => {
    if (!drawer || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, open, onOpenChange]);

  const dismissHint = () => {
    setShowHint(false);
    rememberHintSeen();
  };
  const toggle = () => {
    dismissHint();
    onOpenChange(!open);
  };

  return (
    <div className={cn('relative shrink-0', drawer && 'w-12')}>
      {drawer && open && (
        <div className="fixed inset-0 z-30 bg-foreground/20" aria-hidden onClick={() => onOpenChange(false)} />
      )}
      <div
        className={cn(
          'sticky top-4 z-40 flex h-[calc(100dvh-7rem)] items-start',
          drawer && 'w-max',
        )}
      >
        <aside
          id={panelId}
          aria-label="Rappel du dossier"
          inert={!open}
          style={enterWidth ? { width: enterWidth } : undefined}
          className={cn(
            'h-full overflow-hidden rounded-xl bg-muted transition-[width] duration-300 ease-out motion-reduce:transition-none',
            open ? 'w-72 border xl:w-80 2xl:w-96' : 'w-0',
            drawer && open && 'shadow-lg',
          )}
        >
          <div className="h-full w-full min-w-72 overflow-y-auto overscroll-contain p-3 xl:min-w-80 2xl:min-w-96">
            <PatientRecap patientId={patientId} size="panel" beforeSessionId={sessionId} />
          </div>
        </aside>

        <div className="relative">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Fermer le rappel' : 'Ouvrir le rappel'}
            className={cn(
              'flex w-12 flex-col items-center gap-2 rounded-r-xl border border-l-0 bg-card px-1 py-4 text-area-patients shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !open && 'rounded-l-xl border-l',
            )}
          >
            <NotebookText className="size-6" aria-hidden />
            <span className="text-base font-medium text-foreground [writing-mode:vertical-rl]">Rappel</span>
            {open ? (
              <ChevronLeft className="size-6" aria-hidden />
            ) : (
              <ChevronRight className="size-6" aria-hidden />
            )}
          </button>

          {showHint && (
            <div
              role="status"
              className="absolute left-full top-2 z-50 ml-3 w-64 rounded-xl bg-foreground p-4 text-background shadow-lg"
            >
              <span
                aria-hidden
                className="absolute -left-1.5 top-6 size-3 rotate-45 bg-foreground"
              />
              <p className="text-base leading-snug">
                Le résumé du dossier reste ici, touchez pour l’ouvrir ou le fermer.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={dismissHint}
              >
                J’ai compris
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
