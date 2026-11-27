import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { type ComponentProps, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { dayInBounds, formatDay, isCompleteDay, parseDay, shiftDay } from '../../lib/date-entry';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../ui/popover';

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  /** YYYY-MM-DD, or '' */
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  /** A day to come (appointment, task): « 3 » is the next 3rd, shortcuts are today and tomorrow */
  upcoming?: boolean;
  /** Month and year menus, two-digit years in the 1900s */
  birthDate?: boolean;
};

const today = () => format(new Date(), 'yyyy-MM-dd');

/**
 * A date typed the way she says it (« 26 », « 26/11 », « 261126 »), with the arrows to move by a
 * day (a week with Shift, a month with Page up/down), or picked in the calendar. The weekday shows
 * as soon as the date is understood.
 */
export function DatePicker({
  value, onChange, min, max, upcoming, birthDate, disabled, className, onBlur, onKeyDown, ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatDay(value));
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const bounds = { min, max, upcoming, birthDate };

  // What this field last sent: any other value comes from outside (reset, slot) and replaces the text
  const sent = useRef(value);
  const send = (day: string) => {
    sent.current = day;
    if (day !== value) onChange(day);
  };
  useEffect(() => {
    if (value === sent.current) return;
    sent.current = value;
    setText(formatDay(value));
    setInvalid(false);
  }, [value]);

  const take = (day: string) => {
    setText(formatDay(day));
    setInvalid(false);
    send(day);
  };

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false);
      send('');
      return;
    }
    const day = parseDay(text, bounds);
    if (day && dayInBounds(day, bounds)) take(day);
    else {
      setInvalid(true);
      send('');
    }
  };

  const type = (next: string, inserted: boolean) => {
    // « 26 » then « 2611 »: the slashes come by themselves while she types forward
    const auto = inserted && /^\d{2}$|^\d{1,2}\/\d{2}$/.test(next) ? `${next}/` : next;
    setText(auto);
    setInvalid(false);
    if (isCompleteDay(auto)) {
      const day = parseDay(auto, bounds);
      if (day && dayInBounds(day, bounds)) send(day);
    }
  };

  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') commit();
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      return;
    }
    const moves: Record<string, [number, 'day' | 'month']> = {
      ArrowUp: [e.shiftKey ? 7 : 1, 'day'],
      ArrowDown: [e.shiftKey ? -7 : -1, 'day'],
      PageUp: [1, 'month'],
      PageDown: [-1, 'month'],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const from = parseDay(text, bounds) ?? (value || today());
    const day = value || parseDay(text, bounds) ? shiftDay(from, ...move) : from;
    if (dayInBounds(day, bounds)) take(day);
  };

  const selected = value ? parseISO(value) : undefined;
  const outOfBounds = (day: Date) => !dayInBounds(format(day, 'yyyy-MM-dd'), bounds);
  const now = new Date();
  const shortcuts = upcoming
    ? [{ label: 'Aujourd’hui', day: now }, { label: 'Demain', day: addDays(now, 1) }, { label: 'Dans 1 semaine', day: addDays(now, 7) }]
    : [{ label: 'Hier', day: addDays(now, -1) }, { label: 'Aujourd’hui', day: now }];
  const choose = (day: Date) => {
    take(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative w-full min-w-0 max-w-56', className)}>
          <input
            {...props}
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="jj/mm/aaaa"
            value={text}
            disabled={disabled}
            aria-invalid={invalid || props['aria-invalid']}
            className={cn(
              'flex h-11 w-full rounded-lg border border-input bg-card py-2 pl-3 pr-20 text-base tabular-nums',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
            )}
            onChange={(e) => type(e.target.value, (e.nativeEvent as InputEvent).inputType === 'insertText')}
            onBlur={(e) => {
              commit();
              onBlur?.(e);
            }}
            onKeyDown={keys}
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-11 flex items-center text-sm text-muted-foreground">
            {selected && !invalid ? format(selected, 'EEE', { locale: fr }) : ''}
          </span>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 text-muted-foreground"
              aria-label="Ouvrir le calendrier"
            >
              <CalendarDays aria-hidden />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          input.current?.focus();
        }}
      >
        <Calendar
          mode="single"
          required
          autoFocus
          selected={selected}
          defaultMonth={selected}
          captionLayout={birthDate ? 'dropdown' : 'label'}
          startMonth={birthDate ? new Date(Math.min(1900, selected?.getFullYear() ?? 1900), 0) : undefined}
          endMonth={max ? parseISO(max) : undefined}
          disabled={outOfBounds}
          onSelect={choose}
        />
        {!birthDate && (
          <div className="flex flex-wrap justify-evenly gap-1 border-t p-1">
            {shortcuts.map(({ label, day }) => (
              <Button key={label} type="button" variant="ghost" size="sm" disabled={outOfBounds(day)} onClick={() => choose(day)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
