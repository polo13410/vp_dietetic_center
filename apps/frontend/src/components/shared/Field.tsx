import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from 'react';

import { cn } from '../../lib/utils';

interface FieldProps {
  label: ReactNode;
  /** Help shown under the label (format, example, why we ask) */
  hint?: ReactNode;
  /** Shows "obligatoire" next to the label, spelled out rather than an asterisk */
  required?: boolean;
  error?: string;
  /** Id of the control; generated when the child has none */
  id?: string;
  className?: string;
  /** A single control (Input, Textarea, SelectTrigger…): it receives id and aria attributes */
  children: ReactNode;
}

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};

/** A form field: label, help, "obligatoire" mention and error, wired to the control for screen readers. */
export function Field({ label, hint, required, error, id, className, children }: FieldProps) {
  const generatedId = useId();
  const child = isValidElement<ControlProps>(children) ? children : null;
  const controlId = id ?? child?.props.id ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy =
    [child?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = child
    ? cloneElement(child as ReactElement<ControlProps>, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : child.props['aria-invalid'],
        'aria-required': required || child.props['aria-required'],
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={controlId} className="flex flex-wrap items-baseline gap-x-2 text-base font-medium">
        {label}
        {required && <span className="text-sm font-normal text-muted-foreground">obligatoire</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
