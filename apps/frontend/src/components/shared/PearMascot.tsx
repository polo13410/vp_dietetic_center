import { cn } from '../../lib/utils';

interface PearMascotProps {
  /** Accessible description; leave empty when the illustration is decorative */
  title?: string;
  className?: string;
}

/** The site's official pear logo, for empty states, home and the end of wizards. */
export function PearMascot({ title, className }: PearMascotProps) {
  return (
    <img
      src="/logo_small.png"
      alt={title ?? ''}
      width={530}
      height={581}
      className={cn('h-28 w-auto object-contain', className)}
      aria-hidden={title ? undefined : true}
      data-testid="pear-mascot"
    />
  );
}
