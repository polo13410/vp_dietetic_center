import { subDays } from 'date-fns';

import { Button } from '../ui/button';

import { DatePicker } from './DatePicker';

interface DateRangePickerProps {
  from?: Date;
  to?: Date;
  onChange: (from: Date | undefined, to: Date | undefined) => void;
}

const PRESETS = [
  { label: '7j', days: 7 },
  { label: '30j', days: 30 },
  { label: '3 mois', days: 90 },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            onClick={() => onChange(subDays(new Date(), p.days), new Date())}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <DatePicker value={from} onChange={(d) => onChange(d, to)} placeholder="Du..." className="w-40" />
        <DatePicker value={to} onChange={(d) => onChange(from, d)} placeholder="Au..." className="w-40" />
      </div>
      {(from || to) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined, undefined)}>
          Reinitialiser
        </Button>
      )}
    </div>
  );
}
