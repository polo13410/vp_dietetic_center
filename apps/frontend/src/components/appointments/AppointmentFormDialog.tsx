import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useKeepFieldVisible } from '../../hooks/useKeepFieldVisible';
import api from '../../lib/api';
import { type IdentityDraft, identityFromSearch } from '../../lib/new-patient';
import { cn } from '../../lib/utils';
import { QuickPatientForm } from '../patients/QuickPatientForm';
import { PatientCombobox } from '../shared/PatientCombobox';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  // « Nouveau patient »: the short version replaces the form, then selects the new patient
  const [newPatient, setNewPatient] = useState<IdentityDraft | null>(null);
  const { ref, keyboardInset } = useKeepFieldVisible<HTMLDivElement>();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: '',
      startAt: '',
      duration: 45,
      type: 'IN_PERSON',
      reason: '',
      ...defaultValues,
    },
  });

  // Compared by content: a parent passing a new but equal object on each render must not wipe
  // what is being typed (or the patient just created)
  const defaultsKey = JSON.stringify(defaultValues ?? {});
  useEffect(() => {
    if (open) {
      setNewPatient(null);
      reset({
        patientId: '',
        startAt: '',
        duration: 45,
        type: 'IN_PERSON',
        reason: '',
        ...(JSON.parse(defaultsKey) as Partial<FormData>),
      });
    }
  }, [open, defaultsKey, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      // The field holds a local time ("2026-11-20T14:00"): send it as an exact instant, or a
      // server in another time zone would read it differently
      const payload = { ...data, startAt: new Date(data.startAt).toISOString() };
      return isEdit ? api.patch(`/appointments/${editId}`, payload) : api.post('/appointments', payload);
    },
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
      <DialogContent
        ref={ref}
        // The iPad keyboard covers the bottom half: move the window up and let it scroll above it
        className={cn(newPatient ? 'sm:max-w-xl' : 'sm:max-w-[500px]', keyboardInset > 0 && 'top-4 translate-y-0')}
        style={keyboardInset > 0 ? { maxHeight: `calc(100dvh - ${keyboardInset}px - 2rem)` } : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {newPatient ? 'Nouveau patient' : isEdit ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </DialogTitle>
          {newPatient && (
            <DialogDescription>
              Le prénom et le nom suffisent. Le reste se complète plus tard dans le dossier.
            </DialogDescription>
          )}
        </DialogHeader>

        {newPatient ? (
          <QuickPatientForm
            initial={newPatient}
            onCancel={() => setNewPatient(null)}
            onCreated={(patient) => {
              setValue('patientId', patient.id, { shouldValidate: true });
              setNewPatient(null);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
            {/* Patient */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Patient *</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Controller
                  control={control}
                  name="patientId"
                  render={({ field }) => (
                    <PatientCombobox
                      value={field.value}
                      onChange={(id) => field.onChange(id ?? '')}
                      disabled={isEdit}
                      onCreate={isEdit ? undefined : (search) => setNewPatient(identityFromSearch(search))}
                      className="min-w-0 flex-1"
                    />
                  )}
                />
                {!isEdit && (
                  <Button type="button" variant="outline" onClick={() => setNewPatient(identityFromSearch(''))}>
                    <UserPlus />
                    Nouveau patient
                  </Button>
                )}
              </div>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Enregistrer' : 'Creer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
