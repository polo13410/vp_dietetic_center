import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export interface StepperStep {
  label: ReactNode;
  description?: ReactNode;
}

interface StepperProps {
  steps: StepperStep[];
  /** Index of the current step (0-based) */
  current: number;
  /** Lets the user go back to a finished step; steps are not clickable without it */
  onStepClick?: (index: number) => void;
  className?: string;
}

const STATE_LABELS = { done: 'terminée', current: 'en cours', todo: 'à venir' } as const;

/** Progress of a wizard: numbered steps, finished ones ticked, the current one highlighted. */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn('flex flex-wrap items-start gap-x-3 gap-y-4', className)}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        const clickable = !!onStepClick && state === 'done';

        const content = (
          <>
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold',
                state === 'done' && 'border-primary bg-primary text-primary-foreground',
                state === 'current' && 'border-primary bg-accent text-primary',
                state === 'todo' && 'border-border bg-card text-muted-foreground',
              )}
              aria-hidden
            >
              {state === 'done' ? <Check className="size-5" /> : index + 1}
            </span>
            <span className="min-w-0 text-left">
              <span
                className={cn(
                  'block text-base font-medium leading-snug',
                  state === 'todo' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.description && (
                <span className="block text-sm text-muted-foreground">{step.description}</span>
              )}
              <span className="sr-only">
                {`Étape ${index + 1} sur ${steps.length}, ${STATE_LABELS[state]}`}
              </span>
            </span>
          </>
        );

        return (
          <li
            key={index}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex min-w-[10rem] flex-1 items-center gap-3"
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-3">{content}</span>
            )}
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'hidden h-0.5 min-w-6 flex-1 rounded-full sm:block',
                  state === 'done' ? 'bg-primary' : 'bg-border',
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
