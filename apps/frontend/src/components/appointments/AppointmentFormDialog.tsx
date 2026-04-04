import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import api from '../../lib/api';
import { PatientCombobox } from '../shared/PatientCombobox';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '../ui/toaster';

const schema = z.object({
  patientId: z.string().min(1, 'Patient requis'),
  startAt: z.string().min(1, 'Date requise'),
  duration: z.number().min(15, 'Minimum 15 minutes'),
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']),
  reason: z.string().optional(),
  preNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormData>;
  editId?: string;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  defaultValues,
  editId,
}: AppointmentFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editId;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: '',
      startAt: '',
      duration: 45,
      type: 'IN_PERSON',
      reason: '',
      preNotes: '',
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        patientId: '',
        startAt: '',
        duration: 45,
        type: 'IN_PERSON',
        reason: '',
        preNotes: '',
        ...defaultValues,
      });
    }
  }, [open, defaultValues, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? api.patch(`/appointments/${editId}`, data) : api.post('/appointments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast({ title: isEdit ? 'Rendez-vous modifie' : 'Rendez-vous cree' });
      onOpenChange(false);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Patient *</label>
            <Controller
              control={control}
              name="patientId"
              render={({ field }) => (
                <PatientCombobox
                  value={field.value}
                  onChange={(id) => field.onChange(id ?? '')}
                  disabled={isEdit}
                />
              )}
            />
            {errors.patientId && (
              <p className="text-xs text-destructive mt-1">{errors.patientId.message}</p>
            )}
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Date et heure *</label>
            <input type="datetime-local" {...register('startAt')} className={inputClass} />
            {errors.startAt && (
              <p className="text-xs text-destructive mt-1">{errors.startAt.message}</p>
            )}
          </div>

          {/* Duration & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Duree (min) *</label>
              <div className="flex gap-1.5">
                {[30, 45, 60].map((d) => (
                  <Controller
                    key={d}
                    control={control}
                    name="duration"
                    render={({ field }) => (
                      <Button
                        type="button"
                        variant={field.value === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => field.onChange(d)}
                      >
                        {d}
                      </Button>
                    )}
                  />
                ))}
                <input
                  type="number"
                  min={15}
                  {...register('duration', { valueAsNumber: true })}
                  className={`${inputClass} w-16 text-center`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type *</label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN_PERSON">En cabinet</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="PHONE">Telephone</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Motif</label>
            <textarea {...register('reason')} rows={2} className={`${inputClass} resize-none`} placeholder="Motif de la consultation..." />
          </div>

          {/* Pre-notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes pre-consultation</label>
            <textarea {...register('preNotes')} rows={2} className={`${inputClass} resize-none`} placeholder="Notes preparatoires..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Enregistrer' : 'Creer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
