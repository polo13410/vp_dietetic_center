import { BMI_CATEGORIES, type Bmi } from '../../lib/patient-file';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

/** "IMC 27,3 · Surpoids", colored by category. */
export function BmiBadge({ bmi, className, short }: { bmi: Bmi | null | undefined; className?: string; short?: boolean }) {
  if (!bmi) return null;
  const { label, className: color } = BMI_CATEGORIES[bmi.category];
  const value = bmi.value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return (
    <Badge variant="outline" className={cn(color, 'whitespace-nowrap', className)} title={`IMC ${value}`}>
      {short ? label : `IMC ${value} · ${label}`}
    </Badge>
  );
}
