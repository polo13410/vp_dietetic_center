import { Clock } from 'lucide-react';
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { isCompleteTime, parseTime, timeSlots } from '../../lib/date-entry';
import { cn } from '../../lib/utils';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  /** HH:mm, or '' */
  value: string;
  onChange: (time: string) => void;
  /** Minutes between two proposed times */
  step?: number;
  from?: string;
  to?: string;
};

/**
 * A time typed short (« 9 », « 930 », « 14h30 ») or picked in the list of the day's slots, which
 * opens on a click or the down arrow and follows what she types.
 */
export function TimePicker({
  value, onChange, step = 15, from = '07:00', to = '21:00', disabled, className, onBlur, onKeyDown, ...props
}: Props) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  // The arrows moved the highlight since she last typed: Enter takes the highlighted slot
  const browsing = useRef(false);
  const slots = useMemo(() => timeSlots(from, to, step), [from, to, step]);

  const sent = useRef(value);
  const send = (time: string) => {
    sent.current = time;
    if (time !== value) onChange(time);
  };
  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    setText(value);
    setInvalid(false);
  }, [value]);

  /** The slot to highlight: the one typed, else the first one after it. */
  const nearest = (time: string | null) => {
    if (!time) return slots.indexOf('09:00');
    const index = slots.findIndex((slot) => slot >= time);
    return index === -1 ? slots.length - 1 : index;
  };

  // Keep the highlighted slot in view as the arrows move it
  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    if (disabled) return;
    const index = nearest(parseTime(text) ?? (value || null));
    setActive(index);
    setOpen(true);
    requestAnimationFrame(() => list.current?.children[index]?.scrollIntoView?.({ block: 'center' }));
  };

  const take = (time: string) => {
    setText(time);
    setInvalid(false);
    setOpen(false);
    browsing.current = false;
    send(time);
  };

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      send('');
      return;
    }
    const time = parseTime(text);
    if (time) take(time);
    else {
      setInvalid(true);
      send('');
    }
  };

  const type = (next: string) => {
    browsing.current = false;
    setText(next);
    setInvalid(false);
    const time = parseTime(next);
    if (open) setActive(time ? nearest(time) : -1);
    if (time && isCompleteTime(next)) send(time);
  };

  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show();
      const by = e.key === 'ArrowDown' ? 1 : -1;
      browsing.current = true;
      setActive((i) => Math.min(slots.length - 1, Math.max(0, (i < 0 ? nearest(parseTime(text)) : i + by))));
    } else if (e.key === 'Enter') {
      // A time typed in full wins over the highlighted slot, unless she moved to another one
      if (open && active >= 0 && (browsing.current || !isCompleteTime(text))) {
        e.preventDefault();
        take(slots[active]);
      } else commit();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative w-28 min-w-0', className)}>
          <input
            {...props}
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="hh:mm"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || props['aria-invalid']}
            value={text}
            disabled={disabled}
            className={cn(
              'flex h-11 w-full rounded-lg border border-input bg-card py-2 pl-3 pr-9 text-base tabular-nums',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
            )}
            onClick={() => (open ? undefined : show())}
            onChange={(e) => type(e.target.value)}
            onBlur={(e) => {
              commit();
              onBlur?.(e);
            }}
            onKeyDown={keys}
          />
          <Clock aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-28 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target === input.current) e.preventDefault();
        }}
      >
        <ul ref={list} id={listId} role="listbox" aria-label="Heures proposées" className="max-h-60 overflow-y-auto">
          {slots.map((slot, i) => (
            <li
              key={slot}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={slot === value}
              className={cn(
                'cursor-pointer rounded-md px-3 py-2 text-center tabular-nums',
                i === active && 'bg-accent text-accent-foreground',
                slot === value && 'font-semibold text-primary',
              )}
              // Keeps the focus in the field: the choice is taken before its blur
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => take(slot)}
            >
              {slot}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
