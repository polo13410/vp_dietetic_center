import { cn } from '../../lib/utils';

interface PearMascotProps {
  /** happy: open eyes and smile (default); calm: closed eyes, for "nothing to do" moments */
  mood?: 'happy' | 'calm';
  /** Accessible description; leave empty when the illustration is decorative */
  title?: string;
  className?: string;
}

/** Simple vector take on the logo's pear, for empty states, home and the end of wizards. */
export function PearMascot({ mood = 'happy', title, className }: PearMascotProps) {
  return (
    <svg
      viewBox="0 0 120 140"
      className={cn('h-28 w-auto', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-testid="pear-mascot"
    >
      {/* stem and leaf */}
      <path
        d="M60 26 C60 18 57 11 52 6"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-brand-ink"
      />
      <path
        d="M61 19 C66 7 81 3 92 7 C88 20 73 25 61 19 Z"
        strokeWidth="3"
        strokeLinejoin="round"
        className="fill-brand-leaf stroke-brand-ink"
      />
      {/* body */}
      <path
        d="M60 24 C45 24 39 37 39 50 C39 63 23 73 23 97 C23 121 41 135 60 135 C79 135 97 121 97 97 C97 73 81 63 81 50 C81 37 75 24 60 24 Z"
        strokeWidth="4"
        strokeLinejoin="round"
        className="fill-brand-pear stroke-brand-ink"
      />
      <ellipse cx="46" cy="58" rx="4" ry="7" className="fill-card opacity-50" />
      {/* face */}
      <circle cx="41" cy="95" r="5" className="fill-brand-blush opacity-80" />
      <circle cx="79" cy="95" r="5" className="fill-brand-blush opacity-80" />
      {mood === 'happy' ? (
        <>
          <circle cx="48" cy="86" r="4" className="fill-brand-ink" />
          <circle cx="72" cy="86" r="4" className="fill-brand-ink" />
        </>
      ) : (
        <path
          d="M43 87 Q48 91 53 87 M67 87 Q72 91 77 87"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-brand-ink"
        />
      )}
      <path
        d="M52 97 Q60 105 68 97"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-brand-ink"
      />
    </svg>
  );
}
