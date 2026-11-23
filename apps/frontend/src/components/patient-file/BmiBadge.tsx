import { BMI_CATEGORIES, type Bmi, type Bmr, IOTF_CLASSES } from '../../lib/patient-file';
import { cn, formatNumber } from '../../lib/utils';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * « IMC 27,3 · Surpoids », coloured by category; `short` shows the category only. Under 18 there is
 * no adult category: the badge gives the place on the IOTF curves (« Surpoids (IOTF) »), and nothing
 * when it cannot be placed (before 2 years, or sex unknown).
 */
export function BmiBadge({ bmi, className, short }: { bmi: Bmi | null | undefined; className?: string; short?: boolean }) {
  if (!bmi) return null;
  const childClass = bmi.child?.class;
  const shown = bmi.category ? BMI_CATEGORIES[bmi.category] : childClass ? IOTF_CLASSES[childClass] : null;
  if (!shown) return null;
  const label = bmi.category ? shown.label : `${shown.label} (IOTF)`;
  return (
    <StatusBadge
      status={bmi.category ?? childClass ?? 'BMI'}
      tone={shown.tone}
      label={short ? label : `IMC ${formatNumber(bmi.value, 1)} · ${label}`}
      className={cn('whitespace-nowrap', className)}
    />
  );
}

/** « Formule adulte » beside a BMR computed for someone under 18 (§ 3.1). */
export function AdultFormulaNote({ bmr, className }: { bmr: Bmr | null | undefined; className?: string }) {
  if (!bmr?.adultFormulaForMinor) return null;
  return <span className={cn('text-sm font-normal text-muted-foreground', className)}>formule adulte</span>;
}
