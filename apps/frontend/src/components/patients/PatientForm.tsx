import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const patientSchema = z.object({
  firstName: z.string().min(1, 'Prenom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  sex: z.enum(['F', 'M']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  /** Declared age, when the birth date is unknown */
  age: z.string().regex(/^\d{0,3}$/, 'Âge en années').optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  familySituation: z.string().optional(),
  profession: z.string().optional(),
  gpName: z.string().optional(),
  referralSource: z.string().optional(),
  consultationReason: z.string().optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

interface PatientFormProps {
  defaultValues?: Partial<PatientFormData>;
  onSubmit: (data: PatientFormData) => void;
  isPending: boolean;
  submitLabel: string;
}

export function PatientForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: PatientFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      ...defaultValues,
    },
  });

  const handleFormSubmit = (data: PatientFormData) => {
    const { age, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };

    // An empty field means "no value": the API refuses "" for dates and emails
    for (const [key, value] of Object.entries(payload)) {
      if (value === '') payload[key] = null;
    }
    // Only the age is known: the API stores an estimated birth year
    if (age && !data.dateOfBirth) payload.age = Number(age);

    onSubmit(payload as PatientFormData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Identity */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Identite</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prenom *" error={errors.firstName?.message}>
            <input {...register('firstName')} placeholder="Marie" className={inputClass} />
          </Field>
          <Field label="Nom *" error={errors.lastName?.message}>
            <input {...register('lastName')} placeholder="Dupont" className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Sexe">
            <Controller
              control={control}
              name="sex"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Femme</SelectItem>
                    <SelectItem value="M">Homme</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Date de naissance">
            <input type="date" {...register('dateOfBirth')} className={inputClass} />
          </Field>
          <Field label="Ou âge" error={errors.age?.message}>
            <input inputMode="numeric" {...register('age')} placeholder="56" className={inputClass} />
          </Field>
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Coordonnees</legend>
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            {...register('email')}
            placeholder="patient@exemple.fr"
            className={inputClass}
          />
        </Field>
        <Field label="Telephone">
          <input {...register('phone')} placeholder="06 12 34 56 78" className={inputClass} />
        </Field>
        <Field label="Adresse">
          <input {...register('address')} placeholder="12 rue des Lilas" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code postal">
            <input {...register('zipCode')} placeholder="75011" className={inputClass} />
          </Field>
          <Field label="Ville">
            <input {...register('city')} placeholder="Paris" className={inputClass} />
          </Field>
        </div>
      </fieldset>

      {/* Situation */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Situation</legend>
        <Field label="Situation familiale">
          <input {...register('familySituation')} placeholder="Mariée, deux enfants" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Profession">
            <input {...register('profession')} className={inputClass} />
          </Field>
          <Field label="Médecin traitant">
            <input {...register('gpName')} placeholder="Dr Martin" className={inputClass} />
          </Field>
        </div>
      </fieldset>

      {/* Profile: shown at the top of the summary before each session */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Profil</legend>
        <Field label="Motif de consultation">
          <textarea
            {...register('consultationReason')}
            rows={2}
            placeholder="Pourquoi le patient consulte, ce qu'il attend du suivi..."
            className={cn(inputClass, 'resize-none')}
          />
        </Field>
        <Field label="Adressé par">
          <input
            {...register('referralSource')}
            placeholder="Medecin traitant, bouche-a-oreille..."
            className={inputClass}
          />
        </Field>
      </fieldset>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
