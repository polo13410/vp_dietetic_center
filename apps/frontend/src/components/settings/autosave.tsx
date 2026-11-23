import { AlertCircle, Check, Loader2 } from 'lucide-react';
import {
  type InputHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatTime } from '../../lib/settings-format';
import { cn } from '../../lib/utils';
import { Field } from '../shared/Field';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

/**
 * The settings page saves every change by itself (docs/REFONTE.md § 2, principle 3): a field
 * is saved when the user leaves it or stops typing, a choice as soon as it is made. Each
 * section shows where its saving stands. Only actions keep a button (add a formula).
 */
export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: Date }
  | { status: 'error'; message: string };

export type Track = (save: () => Promise<unknown>) => Promise<boolean>;

/** Follows the saves of one section; `track` runs a save and says whether it worked. */
export function useSaveTracker() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const pending = useRef(0);

  const track = useCallback<Track>(async (save) => {
    pending.current += 1;
    setState({ status: 'saving' });
    try {
      await save();
      pending.current -= 1;
      if (pending.current === 0) setState({ status: 'saved', at: new Date() });
      return true;
    } catch (error) {
      pending.current -= 1;
      setState({
        status: 'error',
        message: apiErrorMessage(error, 'Vérifiez votre connexion, puis modifiez le champ à nouveau.'),
      });
      return false;
    }
  }, []);

  return { state, track };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-11 items-center gap-2 text-sm',
        state.status === 'error' ? 'font-medium text-destructive' : 'text-muted-foreground',
      )}
    >
      {state.status === 'idle' && 'Enregistrement automatique'}
      {state.status === 'saving' && (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Enregistrement…
        </>
      )}
      {state.status === 'saved' && (
        <>
          <Check className="size-4 text-success" aria-hidden />
          Enregistré à {formatTime(state.at)}
        </>
      )}
      {state.status === 'error' && (
        <>
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Non enregistré : {state.message}
        </>
      )}
    </p>
  );
}

/** Time without typing after which a valid value is saved (leaving the field saves at once). */
export const AUTOSAVE_DELAY_MS = 1200;

interface AutosaveFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** The saved value */
  value: string | null;
  /** Receives the trimmed text, or null when emptied */
  onSave: (value: string | null) => Promise<unknown>;
  track: Track;
  /** Refuses an empty value with this message */
  requiredMessage?: string;
  /** Message for a value that cannot be saved (never called with an empty value) */
  validate?: (value: string) => string | null;
  multiline?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  className?: string;
}

/** A text field that saves itself; a wrong value shows its error and is not sent. */
export function AutosaveField({
  label,
  hint,
  value,
  onSave,
  track,
  requiredMessage,
  validate,
  multiline,
  inputProps,
  className,
}: AutosaveFieldProps) {
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(draft);
  latest.current = draft;

  const problem = (text: string) =>
    text === '' ? (requiredMessage ?? null) : (validate?.(text) ?? null);

  const commit = async (showErrors: boolean) => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const text = latest.current.trim();
    if (text === saved.current) return;
    const message = problem(text);
    if (message) {
      if (showErrors) setError(message);
      return;
    }
    setError(null);
    const previous = saved.current;
    saved.current = text;
    // Failed: the next change or leaving the field tries again
    if (!(await track(() => onSave(text === '' ? null : text)))) saved.current = previous;
  };
  // The timer and the clean-up call the latest version
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Leaving the page while a save is waiting: save now
  useEffect(
    () => () => {
      if (timer.current) void commitRef.current(false);
    },
    [],
  );

  const onChange = (text: string) => {
    setDraft(text);
    latest.current = text;
    // An error goes away as soon as it is fixed
    if (error && !problem(text.trim())) setError(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void commitRef.current(false), AUTOSAVE_DELAY_MS);
  };

  const common = {
    value: draft,
    onBlur: () => void commit(true),
    'aria-invalid': error ? true : undefined,
  };

  return (
    <Field label={label} hint={hint} error={error ?? undefined} className={className}>
      {multiline ? (
        <Textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...inputProps} {...common} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}
