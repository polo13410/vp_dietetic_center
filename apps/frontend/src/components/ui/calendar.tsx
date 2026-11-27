import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';

import { cn } from '../../lib/utils';

import { buttonVariants } from './button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  const navButton = buttonVariants({ variant: 'ghost', size: 'icon' });
  return (
    <DayPicker
      locale={fr}
      showOutsideDays
      className={cn('relative p-2', className)}
      classNames={{
        month_caption: 'flex h-11 items-center justify-center font-medium capitalize',
        nav: 'absolute inset-x-2 top-2 flex justify-between pointer-events-none',
        button_previous: cn(navButton, 'pointer-events-auto'),
        button_next: cn(navButton, 'pointer-events-auto'),
        chevron: 'fill-current',
        dropdowns: 'flex items-center gap-2',
        dropdown_root: 'relative rounded focus-within:ring-2 focus-within:ring-ring',
        dropdown: 'absolute inset-0 w-full cursor-pointer opacity-0',
        caption_label: 'flex items-center gap-1',
        weekday: 'h-8 text-sm font-normal text-muted-foreground',
        day: 'p-0 text-center',
        day_button: cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-10 font-normal sm:size-11'),
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        today: '[&>button]:underline [&>button]:underline-offset-4',
        outside: 'text-muted-foreground',
        disabled: 'opacity-40',
        ...classNames,
      }}
      {...props}
    />
  );
}
