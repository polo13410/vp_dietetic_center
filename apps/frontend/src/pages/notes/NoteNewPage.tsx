import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { PatientCombobox } from '../../components/shared/PatientCombobox';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';

const schema = z.object({
  patientId: z.string().min(1, 'Patient requis'),
  appointmentId: z.string().optional(),
  type: z.enum(['FREE', 'STRUCTURED']),
  title: z.string().optional(),
  content: z.string().min(1, 'Contenu requis'),
  sessionObjectives: z.string().optional(),
  actionPlan: z.string().optional(),
  followUpItems: z.string().optional(),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NoteNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: searchParams.get('patientId') ?? '',
      appointmentId: searchParams.get('appointmentId') ?? '',
      type: 'FREE',
      title: '',
      content: '',
    },
  });

  const noteType = watch('type');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data };
      if (!payload.appointmentId) delete payload.appointmentId;
      return api.post('/notes', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Note creee' });
      navigate(`/notes/${res.data.id}`);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/notes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold">Nouvelle note clinique</h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
        {/* Patient + Type */}
        <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
          <legend className="text-sm font-medium px-1">Informations generales</legend>

          <div>
            <label className="block text-sm font-medium mb-1.5">Patient *</label>
            <Controller
              control={control}
              name="patientId"
              render={({ field }) => (
                <PatientCombobox value={field.value} onChange={(id) => field.onChange(id ?? '')} />
              )}
            />
            {errors.patientId && <p className="text-xs text-destructive mt-1">{errors.patientId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Type de note *</label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={field.value === 'FREE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => field.onChange('FREE')}
                  >
                    Libre
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === 'STRUCTURED' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => field.onChange('STRUCTURED')}
                  >
                    Structuree
                  </Button>
                </div>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Titre</label>
            <input {...register('title')} placeholder="Titre de la note..." className={inputClass} />
          </div>
        </fieldset>

        {/* Content */}
        <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
          <legend className="text-sm font-medium px-1">Contenu</legend>

          <div>
            <label className="block text-sm font-medium mb-1.5">Contenu principal *</label>
            <textarea
              {...register('content')}
              rows={6}
              placeholder="Ecrivez le contenu de la note..."
              className={`${inputClass} resize-none`}
            />
            {errors.content && <p className="text-xs text-destructive mt-1">{errors.content.message}</p>}
          </div>
        </fieldset>

        {/* Structured fields */}
        {noteType === 'STRUCTURED' && (
          <fieldset className="bg-card rounded-xl border border-border p-5 space-y-4">
            <legend className="text-sm font-medium px-1">Champs structures</legend>

            <div>
              <label className="block text-sm font-medium mb-1.5">Objectifs de seance</label>
              <textarea
                {...register('sessionObjectives')}
                rows={3}
                placeholder="Objectifs de la seance..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Plan d'action</label>
              <textarea
                {...register('actionPlan')}
                rows={3}
                placeholder="Plan d'action defini..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Points de suivi</label>
              <textarea
                {...register('followUpItems')}
                rows={3}
                placeholder="Points a suivre..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Observations</label>
              <textarea
                {...register('observations')}
                rows={3}
                placeholder="Observations cliniques..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/notes">Annuler</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Creer la note'}
          </Button>
        </div>
      </form>
    </div>
  );
}
