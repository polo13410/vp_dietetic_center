import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const patientSchema = z.object({
  firstName: z.string().min(1, 'Prenom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  referralSource: z.string().optional(),
  privateNote: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface PatientFormProps {
  defaultValues?: Partial<PatientFormData>;
  onSubmit: (data: PatientFormData) => void;
  isPending: boolean;
  submitLabel: string;
  showStatus?: boolean;
}

export function PatientForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  showStatus = false,
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
      tagIds: [],
      ...defaultValues,
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get('/patients/tags');
      return res.data as Tag[];
    },
  });

  const handleFormSubmit = (data: PatientFormData) => {
    // Transform to match backend DTO
    const { emergencyContactName, emergencyContactPhone, emergencyContactRelationship, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };

    if (emergencyContactName || emergencyContactPhone) {
      payload.emergencyContact = {
        name: emergencyContactName || '',
        phone: emergencyContactPhone || '',
        relationship: emergencyContactRelationship,
      };
    }

    // Clean up fields that shouldn't be sent
    delete payload.emergencyContactName;
    delete payload.emergencyContactPhone;
    delete payload.emergencyContactRelationship;

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
        <Field label="Date de naissance">
          <input type="date" {...register('dateOfBirth')} className={inputClass} />
        </Field>
        {showStatus && (
          <Field label="Statut">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Actif</SelectItem>
                    <SelectItem value="INACTIVE">Inactif</SelectItem>
                    <SelectItem value="ARCHIVED">Archive</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
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

      {/* Emergency Contact */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Contact d'urgence</legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom">
            <input
              {...register('emergencyContactName')}
              placeholder="Jean Dupont"
              className={inputClass}
            />
          </Field>
          <Field label="Telephone">
            <input
              {...register('emergencyContactPhone')}
              placeholder="06 12 34 56 78"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Lien de parente">
          <input
            {...register('emergencyContactRelationship')}
            placeholder="Conjoint, parent..."
            className={inputClass}
          />
        </Field>
      </fieldset>

      {/* Additional info */}
      <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
        <legend className="text-sm font-medium px-1">Informations complementaires</legend>
        <Field label="Source de reference">
          <input
            {...register('referralSource')}
            placeholder="Medecin traitant, bouche-a-oreille..."
            className={inputClass}
          />
        </Field>

        {/* Tags */}
        <Field label="Tags">
          <Controller
            control={control}
            name="tagIds"
            render={({ field }) => (
              <TagMultiSelect
                tags={tags}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </Field>

        <Field label="Note privee">
          <textarea
            {...register('privateNote')}
            rows={3}
            placeholder="Notes internes (non visibles par le patient)..."
            className={cn(inputClass, 'resize-none')}
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

// ─── Tag multi-select ────────────────────────────────────────────────────────

function TagMultiSelect({
  tags,
  value,
  onChange,
}: {
  tags: Tag[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedTags = tags.filter((t) => value.includes(t.id));

  const toggle = (tagId: string) => {
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId]);
  };

  return (
    <div className="space-y-2">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1"
              style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            {selectedTags.length > 0
              ? `${selectedTags.length} tag(s) selectionne(s)`
              : 'Ajouter des tags...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher un tag..." />
            <CommandList>
              <CommandEmpty>Aucun tag trouve.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(tag.id)}>
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(tag.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span
                      className="mr-2 h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
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
