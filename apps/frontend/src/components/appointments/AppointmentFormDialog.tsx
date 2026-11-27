import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useKeepFieldVisible } from '../../hooks/useKeepFieldVisible';
import api from '../../lib/api';
import { formulaOption, useBookingOptions } from '../../lib/appointments';
import { type IdentityDraft, identityFromSearch } from '../../lib/new-patient';
import { addressLine } from '../../lib/settings-format';
import { cn, formatDate, todayISO } from '../../lib/utils';
import { fieldClass } from '../patient-file/LifeEventForm';
import { QuickPatientForm } from '../patients/QuickPatientForm';
import { DatePicker } from '../shared/DatePicker';
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
  formulaId: z.string(),
  day: z.iso.date('Choisissez la date.'),
  time: z.iso.time({ precision: -1, error: 'Choisissez l’heure.' }),
  duration: z
    .number({ message: 'Indiquez la durée en minutes.' })
    .min(15, 'Comptez au moins 15 minutes.')
    .max(480, 'La durée ne peut pas dépasser 8 heures.'),
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']),
  practiceId: z.string(),
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

const EMPTY: FormData = {
  patientId: '',
  formulaId: '',
  day: '',
  time: '',
  duration: 45,
  type: 'IN_PERSON',
  practiceId: '',
  reason: '',
};

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<Omit<FormData, 'day' | 'time'> & { startAt: string }>;
  editId?: string;
  /** Edited appointment: its type and practice, still shown if no longer offered */
  booked?: { formula?: { id: string; label: string } | null; practice?: { id: string; name: string } | null };
}

function bookingDefaults(defaults: AppointmentFormDialogProps['defaultValues']): FormData {
  const { startAt, ...fields } = defaults ?? {};
  const [day, time] = startAt?.split('T') ?? [];
  return { ...EMPTY, ...fields, day: day || todayISO(), time: time?.slice(0, 5) ?? '' };
}

/**
 * Booking in three choices (docs/REFONTE.md lot 15): the patient, the type of appointment (one
 * of her formulas, which fills the duration, still editable) and the slot. In person, it takes
 * place in her default practice; the « Cabinet » choice only shows when she has several.
 */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  defaultValues,
  editId,
  booked,
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
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: bookingDefaults(defaultValues),
  });

  const [patientId, type, formulaId] = useWatch({ control, name: ['patientId', 'type', 'formulaId'] });
  const { data: options, isFetching, isError, refetch } = useBookingOptions(patientId || undefined, open);
  const formulas = useMemo(() => options?.formulas ?? [], [options]);
  const practices = useMemo(() => options?.practices ?? [], [options]);
  const formulaGone = !!booked?.formula && !formulas.some((f) => f.id === booked.formula?.id);
  const practiceGone = !!booked?.practice && !practices.some((p) => p.id === booked.practice?.id);
  const showPractice = type === 'IN_PERSON' && practices.length + (practiceGone ? 1 : 0) > 1;

  // Compared by content: a parent passing a new but equal object on each render must not wipe
  // what is being typed (or the patient just created)
  const defaultsKey = JSON.stringify(defaultValues ?? {});
  useEffect(() => {
    if (open) {
      setNewPatient(null);
      reset(bookingDefaults(JSON.parse(defaultsKey)));
    }
  }, [open, defaultsKey, reset]);

  // In person: her default practice unless one is chosen; another practitioner's patient (an
  // assistant booking) brings that practitioner's types and practices. Runs again on opening,
  // after resetting the form, including when options are already cached.
  useEffect(() => {
    if (!open || !options || getValues('patientId') !== patientId) return;
    const { formulaId: chosen, practiceId } = getValues();
    if (chosen && !formulas.some((f) => f.id === chosen) && chosen !== booked?.formula?.id) {
      setValue('formulaId', '');
    }
    if (!practices.some((p) => p.id === practiceId) && practiceId !== booked?.practice?.id) {
      setValue('practiceId', practices.find((p) => p.isDefault)?.id ?? practices[0]?.id ?? '');
    }
  }, [open, options, formulas, practices, getValues, setValue, booked, patientId]);

  useEffect(() => {
    if (!open || isEdit || isFetching || !patientId || !options?.suggestedFormulaId) return;
    if (getValues('patientId') !== patientId || getValues('formulaId')) return;
    const suggested = formulas.find((f) => f.id === options.suggestedFormulaId);
    if (suggested) {
      setValue('formulaId', suggested.id);
      setValue('duration', suggested.durationMinutes);
    }
  }, [open, isEdit, isFetching, patientId, options, formulas, getValues, setValue]);

  const changePatient = (id: string) => {
    if (id === patientId) return;
    setValue('formulaId', '');
    setValue('duration', EMPTY.duration);
    setValue('patientId', id, { shouldValidate: true });
  };

  const chooseFormula = (id: string) => {
    setValue('formulaId', id, { shouldValidate: true });
    const formula = formulas.find((f) => f.id === id);
    // The type gives the duration; it can still be changed below
    if (formula) setValue('duration', formula.durationMinutes, { shouldValidate: true });
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        patientId: data.patientId,
        // The field holds a local time ("2026-11-20T14:00"): send it as an exact instant, or a
        // server in another time zone would read it differently
        startAt: new Date(`${data.day}T${data.time}`).toISOString(),
        duration: data.duration,
        type: data.type,
        formulaId: data.formulaId || null,
        // The API puts an in-person appointment in her default practice when none is given
        ...(data.type === 'IN_PERSON' && data.practiceId ? { practiceId: data.practiceId } : {}),
        reason: data.reason?.trim() || null,
      };
      return isEdit ? api.patch(`/appointments/${editId}`, payload) : api.post('/appointments', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: isEdit ? 'Rendez-vous modifié' : 'Rendez-vous pris' });
      onOpenChange(false);
    },
  });

  const submit = (data: FormData) => {
    // A new appointment says what it is, when she has types to choose from
    if (!isEdit && !data.formulaId && formulas.length > 0) {
      setError('formulaId', { message: 'Choisissez le type de rendez-vous.' });
      return;
    }
    const local = `${data.day}T${data.time}`;
    if (formatDate(new Date(local), 'yyyy-MM-ddTHH:mm') !== local) {
      setError('time', { message: 'Cette heure n’existe pas ce jour-là. Choisissez une autre heure.' });
      return;
    }
    mutate(data);
  };

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
              changePatient(patient.id);
              setNewPatient(null);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit(submit)} className="space-y-5">
            <Field label="Patient" required error={errors.patientId?.message}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Controller
                  control={control}
                  name="patientId"
                  render={({ field }) => (
                    <PatientCombobox
                      value={field.value}
                      onChange={(id) => changePatient(id ?? '')}
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

            {isError && (
              <p role="alert" className="text-sm text-destructive">
                Impossible de charger les types de rendez-vous.{' '}
                <button type="button" className="underline" onClick={() => void refetch()}>Réessayer</button>
              </p>
            )}
            {(formulas.length > 0 || formulaGone) && (
              <Field
                label="Type de rendez-vous"
                required={!isEdit}
                hint="Il donne la durée, que vous pouvez changer."
                error={errors.formulaId?.message}
              >
                <select
                  className={fieldClass}
                  value={formulaId}
                  onChange={(e) => chooseFormula(e.target.value)}
                >
                  <option value="">Choisir le type…</option>
                  {formulaGone && booked?.formula && <option value={booked.formula.id}>{booked.formula.label}</option>}
                  {formulas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {formulaOption(f)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="flex flex-wrap items-start gap-3">
              <Controller control={control} name="day" render={({ field }) => (
                <Field label="Date du rendez-vous" required error={errors.day?.message}>
                  <DatePicker value={field.value} onChange={field.onChange} onBlur={field.onBlur} upcoming />
                </Field>
              )} />
              <Field label="Heure" required error={errors.time?.message}>
                <Input type="time" className="w-32 tabular-nums" {...register('time')} />
              </Field>
            </div>

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

            {showPractice && (
              <Field label="Cabinet">
                <select className={fieldClass} {...register('practiceId')}>
                  {practiceGone && booked?.practice && <option value={booked.practice.id}>{booked.practice.name}</option>}
                  {practices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.name, addressLine(p)].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Note" hint="Facultatif. Par exemple : apporter ses analyses.">
              <Textarea {...register('reason')} rows={2} className="min-h-20" />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || (!!patientId && !options)}>
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
