import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import api from '../../lib/api';
import { DatePicker } from '../shared/DatePicker';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '../ui/toaster';

const schema = z.object({
  date: z.string().min(1, 'Date requise'),
  weight: z.number().positive().optional().or(z.nan().transform(() => undefined)),
  mood: z.number().min(1).max(10).optional().or(z.nan().transform(() => undefined)),
  energyLevel: z.number().min(1).max(10).optional().or(z.nan().transform(() => undefined)),
  stressLevel: z.number().min(1).max(10).optional().or(z.nan().transform(() => undefined)),
  sleepHours: z.number().min(0).max(24).optional().or(z.nan().transform(() => undefined)),
  sleepQuality: z.number().min(1).max(10).optional().or(z.nan().transform(() => undefined)),
  waterIntake: z.number().min(0).optional().or(z.nan().transform(() => undefined)),
  physicalActivity: z.string().optional(),
  mealNotes: z.string().optional(),
  behaviorNotes: z.string().optional(),
  practitionerComment: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface NutritionalEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  defaultValues?: Partial<FormData>;
}

export function NutritionalEntryFormDialog({
  open,
  onOpenChange,
  patientId,
  defaultValues,
}: NutritionalEntryFormDialogProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (open) reset({ date: format(new Date(), 'yyyy-MM-dd'), ...defaultValues });
  }, [open, defaultValues, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => api.post('/nutritional/entries', { ...data, patientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutritional-entries'] });
      toast({ title: 'Entree enregistree' });
      onOpenChange(false);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle entree nutritionnelle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Date *</label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePicker
                  value={field.value ? new Date(field.value) : undefined}
                  onChange={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')}
                />
              )}
            />
            {errors.date && <p className="text-xs text-destructive mt-1">{errors.date.message}</p>}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Poids (kg)</label>
              <input type="number" step="0.1" {...register('weight', { valueAsNumber: true })} className={inputClass} placeholder="72.5" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Humeur (1-10)</label>
              <input type="number" min={1} max={10} {...register('mood', { valueAsNumber: true })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Energie (1-10)</label>
              <input type="number" min={1} max={10} {...register('energyLevel', { valueAsNumber: true })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stress (1-10)</label>
              <input type="number" min={1} max={10} {...register('stressLevel', { valueAsNumber: true })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Sommeil (h)</label>
              <input type="number" step="0.5" min={0} max={24} {...register('sleepHours', { valueAsNumber: true })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Qualite sommeil (1-10)</label>
              <input type="number" min={1} max={10} {...register('sleepQuality', { valueAsNumber: true })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Eau (L)</label>
              <input type="number" step="0.1" min={0} {...register('waterIntake', { valueAsNumber: true })} className={inputClass} placeholder="1.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Activite physique</label>
            <input {...register('physicalActivity')} className={inputClass} placeholder="30 min marche, yoga..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes repas</label>
            <textarea {...register('mealNotes')} rows={2} className={`${inputClass} resize-none`} placeholder="Details des repas..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Notes comportement</label>
            <textarea {...register('behaviorNotes')} rows={2} className={`${inputClass} resize-none`} placeholder="Observations comportementales..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Commentaire praticienne</label>
            <textarea {...register('practitionerComment')} rows={2} className={`${inputClass} resize-none`} placeholder="Votre commentaire..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
