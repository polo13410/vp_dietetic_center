import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import api from '../../lib/api';
import { DatePicker } from '../shared/DatePicker';
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
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  patientId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueAt: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormData>;
  editId?: string;
}

export function TaskFormDialog({ open, onOpenChange, defaultValues, editId }: TaskFormDialogProps) {
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
      title: '',
      description: '',
      patientId: '',
      priority: 'MEDIUM',
      dueAt: '',
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: '',
        description: '',
        patientId: '',
        priority: 'MEDIUM',
        dueAt: '',
        ...defaultValues,
      });
    }
  }, [open, defaultValues, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data };
      if (!payload.patientId) delete payload.patientId;
      if (!payload.dueAt) delete payload.dueAt;
      return isEdit ? api.patch(`/tasks/${editId}`, payload) : api.post('/tasks', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: isEdit ? 'Tache modifiee' : 'Tache creee' });
      onOpenChange(false);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la tache' : 'Nouvelle tache'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Titre *</label>
            <input {...register('title')} placeholder="Titre de la tache..." className={inputClass} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea {...register('description')} rows={3} className={`${inputClass} resize-none`} placeholder="Details..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Priorite</label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Basse</SelectItem>
                      <SelectItem value="MEDIUM">Moyenne</SelectItem>
                      <SelectItem value="HIGH">Haute</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Echeance</label>
              <Controller
                control={control}
                name="dueAt"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(d) => field.onChange(d?.toISOString() ?? '')}
                    placeholder="Date limite..."
                  />
                )}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Patient</label>
            <Controller
              control={control}
              name="patientId"
              render={({ field }) => (
                <PatientCombobox value={field.value} onChange={(id) => field.onChange(id ?? '')} />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Enregistrer' : 'Creer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
