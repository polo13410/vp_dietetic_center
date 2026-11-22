import { useId } from 'react';

import type { IdentityDraft, IdentityErrors } from '../../lib/new-patient';
import { todayISO } from '../../lib/utils';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const BMR_HINT = 'Pour calculer le MB';

interface IdentityFieldsProps {
  value: IdentityDraft;
  onChange: (value: IdentityDraft) => void;
  /** Shown once she has tried to go on */
  errors: IdentityErrors;
  autoFocus?: boolean;
}

/**
 * « Qui est-ce ? »: first and last name (required), then sex and birth date or age, which the BMR
 * needs. Shared by the new patient wizard and the short version opened from the agenda.
 */
export function IdentityFields({ value, onChange, errors, autoFocus }: IdentityFieldsProps) {
  const set = (patch: Partial<IdentityDraft>) => onChange({ ...value, ...patch });
  const sexLabel = useId();

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.firstName}>
          <Input
            value={value.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            autoFocus={autoFocus}
          />
        </Field>
        <Field label="Nom" required error={errors.lastName}>
          <Input
            value={value.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p id={sexLabel} className="text-base font-medium">
            Sexe
          </p>
          <p className="text-sm text-muted-foreground">{BMR_HINT}</p>
          <div role="group" aria-labelledby={sexLabel} className="flex gap-2">
            {(['F', 'M'] as const).map((sex) => (
              <Button
                key={sex}
                type="button"
                variant={value.sex === sex ? 'default' : 'outline'}
                aria-pressed={value.sex === sex}
                // Touching the chosen one again clears it
                onClick={() => set({ sex: value.sex === sex ? '' : sex })}
                className="flex-1"
              >
                {sex === 'F' ? 'Femme' : 'Homme'}
              </Button>
            ))}
          </div>
        </div>

        <div>
          {value.ageOnly ? (
            <Field label="Âge" hint={`${BMR_HINT}, si la date de naissance est inconnue`} error={errors.age}>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={value.age}
                onChange={(e) => set({ age: e.target.value.replace(/\D/g, '') })}
                enterKeyHint="next"
                className="max-w-[8rem]"
              />
            </Field>
          ) : (
            <Field label="Date de naissance" hint={BMR_HINT} error={errors.dateOfBirth}>
              <Input
                type="date"
                max={todayISO()}
                value={value.dateOfBirth}
                onChange={(e) => set({ dateOfBirth: e.target.value })}
              />
            </Field>
          )}
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-11 px-0"
            onClick={() => set({ ageOnly: !value.ageOnly })}
          >
            {value.ageOnly ? 'Saisir la date de naissance' : 'Je ne connais que son âge'}
          </Button>
        </div>
      </div>
    </div>
  );
}
