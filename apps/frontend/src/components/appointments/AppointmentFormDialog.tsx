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
import { Field } from '../shared/Field';
import { PatientCombobox } from '../shared/PatientCombobox';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/toaster';

const schema = z.object({
  patientId: z.string().min(1, 'Choisissez le patient.'),
  startAt: z.string().min(1, 'Choisissez la date et l’heure.'),
  duration: z.number({ message: 'Indiquez la durée en minutes.' }).min(15, 'Comptez au moins 15 minutes.'),
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const DURATIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 h' },
] as const;

const TYPES = [
  { value: 'IN_PERSON', label: 'En cabinet' },
  { value: 'VIDEO', label: 'Vidéo' },
  { value: 'PHONE', label: 'Téléphone' },
] as const;

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
      toast({ title: isEdit ? 'Rendez-vous modifié' : 'Rendez-vous pris' });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={ref}
        // The iPad keyboard covers the bottom half: move the window up and let it scroll above it
        className={cn('sm:max-w-xl', keyboardInset > 0 && 'top-4 translate-y-0')}
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
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
            <Field label="Patient" required error={errors.patientId?.message}>
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
                    <UserPlus aria-hidden />
                    Nouveau patient
                  </Button>
                )}
              </div>
            </Field>

            <Field label="Date et heure" required error={errors.startAt?.message}>
              <Input type="datetime-local" {...register('startAt')} />
            </Field>

            <Field label="Durée" required error={errors.duration?.message}>
              <div className="flex flex-wrap items-center gap-3">
                <Controller
                  control={control}
                  name="duration"
                  render={({ field }) => (
                    <SegmentedControl
                      label="Durée habituelle"
                      options={DURATIONS}
                      value={String(field.value)}
                      onChange={(value) => field.onChange(Number(value))}
                    />
                  )}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={15}
                    step={5}
                    aria-label="Durée en minutes"
                    {...register('duration', { valueAsNumber: true })}
                    className="w-24 text-center"
                  />
                  <span className="text-base text-muted-foreground">min</span>
                </div>
              </div>
            </Field>

            <Field label="Lieu">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SegmentedControl label="Lieu" options={TYPES} value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>

            <Field label="Motif">
              <Textarea {...register('reason')} rows={2} className="min-h-20" placeholder="Bilan, suivi…" />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" aria-hidden />}
                {isEdit ? 'Enregistrer les modifications' : 'Prendre le rendez-vous'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
