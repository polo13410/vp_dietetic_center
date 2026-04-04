import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';

import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  dateOfBirth: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function PatientNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Form) => api.post('/patients', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Patient créé', description: `${res.data.firstName} ${res.data.lastName}` });
      navigate(`/patients/${res.data.id}`);
    },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/patients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold">Nouveau patient</h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
        <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
          <legend className="text-sm font-medium px-1">Identité</legend>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom *" error={errors.firstName?.message}>
              <input {...register('firstName')} placeholder="Marie" className={inputClass} />
            </Field>
            <Field label="Nom *" error={errors.lastName?.message}>
              <input {...register('lastName')} placeholder="Dupont" className={inputClass} />
            </Field>
          </div>
          <Field label="Date de naissance">
            <input type="date" {...register('dateOfBirth')} className={inputClass} />
          </Field>
        </fieldset>

        <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
          <legend className="text-sm font-medium px-1">Coordonnées</legend>
          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              {...register('email')}
              placeholder="patient@exemple.fr"
              className={inputClass}
            />
          </Field>
          <Field label="Téléphone">
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

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/patients">Annuler</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer le patient'}
          </Button>
        </div>
      </form>
    </div>
  );
}

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
