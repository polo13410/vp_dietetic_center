import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveState {
  status: SaveStatus;
  /** When the last save succeeded */
  savedAt: Date | null;
}

/**
 * Saves a value shortly after the last change (docs/REFONTE.md § 2, principle 3): no « Enregistrer »
 * button. `schedule` is called on every change, `flush` on blur; saves run one after the other, and
 * a pending change is saved when the component goes away.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 800) {
  const [state, setState] = useState<SaveState>({ status: 'idle', savedAt: null });
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    if (!next) return running.current;
    pending.current = null;
    running.current = running.current.then(async () => {
      if (mounted.current) setState((s) => ({ ...s, status: 'saving' }));
      try {
        await saveRef.current(next.value);
        if (mounted.current) setState({ status: 'saved', savedAt: new Date() });
      } catch {
        if (mounted.current) setState((s) => ({ ...s, status: 'error' }));
      }
    });
    return running.current;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  /** Forgets a change not saved yet (e.g. the text went back to what was saved). */
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void flush();
    };
  }, [flush]);

  return { state, schedule, flush, cancel, hasPending: () => pending.current !== null };
}
