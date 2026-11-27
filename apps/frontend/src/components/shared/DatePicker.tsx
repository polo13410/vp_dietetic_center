import { addDays, format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { type ComponentProps, useState } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  upcoming?: boolean;
  birthDate?: boolean;
};

/** Local calendar days stay YYYY-MM-DD throughout keyboard entry and calendar selection. */
export function DatePicker({ value, onChange, min, max, upcoming, birthDate, disabled, className, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const choose = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  };
  const today = new Date();
  const selected = value ? parseISO(value) : undefined;
  const outOfBounds = (day: Date) => {
    const iso = format(day, 'yyyy-MM-dd');
    return !!((min && iso < min) || (max && iso > max));
  };
  const shortcuts = upcoming
    ? [{ label: 'Aujourd’hui', day: today }, { label: 'Demain', day: addDays(today, 1) }]
    : [{ label: 'Hier', day: addDays(today, -1) }, { label: 'Aujourd’hui', day: today }];

  return (
    <div className={cn('relative w-full min-w-0 max-w-52', className)}>
      <Input
        {...props}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        className="min-w-0 pr-11 tabular-nums [&::-webkit-calendar-picker-indicator]:hidden"
        onChange={(e) => onChange(e.target.value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute inset-y-0 right-0 text-muted-foreground"
            aria-label="Ouvrir le calendrier"
          >
            <CalendarDays aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
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
            <div className="flex justify-evenly gap-1 border-t p-1">
              {shortcuts.map(({ label, day }) => (
                <Button key={label} type="button" variant="ghost" size="sm" disabled={outOfBounds(day)} onClick={() => choose(day)}>
                  {label}
                </Button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
