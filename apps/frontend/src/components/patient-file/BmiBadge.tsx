import { BMI_CATEGORIES, type Bmi } from '../../lib/patient-file';
import { cn, formatNumber } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';

/** « IMC 27,3 · Surpoids », coloured by category; `short` shows the category only. */
export function BmiBadge({ bmi, className, short }: { bmi: Bmi | null | undefined; className?: string; short?: boolean }) {
  if (!bmi) return null;
  const { label, tone } = BMI_CATEGORIES[bmi.category];
  return (
    <StatusBadge
      status={bmi.category}
      tone={tone}
      label={short ? label : `IMC ${formatNumber(bmi.value, 1)} · ${label}`}
      className={cn('whitespace-nowrap', className)}
    />
  );
}
