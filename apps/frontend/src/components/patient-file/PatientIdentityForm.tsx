import { type InputHTMLAttributes, useRef, useState } from 'react';

import { useAutosave } from '../../hooks/useAutosave';
import api from '../../lib/api';
import { type Patient, useInvalidatePatientFile } from '../../lib/patient-file';
import { Field } from '../shared/Field';
import { SaveIndicator } from '../shared/SaveIndicator';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type Key =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'address'
  | 'zipCode'
  | 'city'
  | 'familySituation'
  | 'profession'
  | 'gpName'
  | 'referralSource'
  | 'consultationReason';

interface FieldDef {
  key: Key;
  label: string;
  required?: boolean;
  multiline?: boolean;
  input?: InputHTMLAttributes<HTMLInputElement>;
  validate?: (value: string) => string | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Identity and contact, in the order of her « Récapitulatif » sheet. */
const FIELDS: FieldDef[] = [
  { key: 'firstName', label: 'Prénom', required: true, input: { autoComplete: 'off' } },
  { key: 'lastName', label: 'Nom', required: true, input: { autoComplete: 'off' } },
  { key: 'phone', label: 'Téléphone', input: { type: 'tel', inputMode: 'tel' } },
  {
    key: 'email',
    label: 'E-mail',
    input: { type: 'email', inputMode: 'email' },
    validate: (v) => (v && !EMAIL.test(v) ? 'L’adresse e-mail n’est pas valide.' : undefined),
  },
  { key: 'familySituation', label: 'Situation familiale' },
  { key: 'profession', label: 'Profession' },
  { key: 'gpName', label: 'Médecin traitant' },
  { key: 'referralSource', label: 'Adressé par' },
  { key: 'address', label: 'Adresse' },
  { key: 'zipCode', label: 'Code postal', input: { inputMode: 'numeric' } },
  { key: 'city', label: 'Ville' },
  { key: 'consultationReason', label: 'Motif de consultation', multiline: true },
];

/**
 * Edits the identity and contact fields in place (no edit page): each field is saved shortly after
 * typing and when leaving it, with one indicator for the card.
 */
export function PatientIdentityForm({ patient }: { patient: Patient }) {
  const invalidate = useInvalidatePatientFile();
  const patch = useRef<Partial<Record<Key, string | null>>>({});
  const { state, schedule, flush } = useAutosave(async (body: Partial<Record<Key, string | null>>) => {
    patch.current = {};
    await api.patch(`/patients/${patient.id}`, body);
    invalidate(patient.id);
  });

  const change = (key: Key, value: string | null) => {
    patch.current = { ...patch.current, [key]: value };
    schedule(patch.current);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((def) => (
          <IdentityField
            key={def.key}
            def={def}
            initial={(patient[def.key] as string | null | undefined) ?? ''}
            onChange={change}
            onBlur={flush}
          />
        ))}
      </div>
      <SaveIndicator state={state} />
    </div>
  );
}

function IdentityField({
  def,
  initial,
  onChange,
  onBlur,
}: {
  def: FieldDef;
  initial: string;
  onChange: (key: Key, value: string | null) => void;
  onBlur: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();

  const update = (next: string) => {
    setValue(next);
    const trimmed = next.trim();
    const problem = def.required && !trimmed ? `Le ${def.label.toLowerCase()} est obligatoire.` : def.validate?.(trimmed);
    setError(problem);
    // An empty optional field clears it; a field in error waits to be corrected
    if (!problem) onChange(def.key, trimmed || null);
  };

  return (
    <Field
      label={def.label}
      required={def.required}
      error={error}
      className={def.multiline ? 'sm:col-span-2 lg:col-span-3' : undefined}
    >
      {def.multiline ? (
        <Textarea rows={2} value={value} onChange={(e) => update(e.target.value)} onBlur={onBlur} />
      ) : (
        <Input {...def.input} value={value} onChange={(e) => update(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  );
}
