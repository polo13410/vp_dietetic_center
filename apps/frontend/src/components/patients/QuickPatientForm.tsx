import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { focusNextOnEnter } from '../../hooks/useKeepFieldVisible';
import api from '../../lib/api';
import { EMPTY_IDENTITY, type IdentityDraft, identityErrors, identityPayload } from '../../lib/new-patient';
import type { Patient } from '../../lib/patient-file';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from '../ui/toaster';

import { IdentityFields } from './IdentityFields';

interface QuickPatientFormProps {
  /** Prefilled from what was typed in the patient search */
  initial?: IdentityDraft;
  onCreated: (patient: Patient) => void;
  onCancel: () => void;
}

/**
 * The short version of « Nouveau patient », opened from appointment booking without leaving the
 * agenda: the first step of the wizard plus the phone. The rest is completed in the file later.
 */
export function QuickPatientForm({ initial = EMPTY_IDENTITY, onCreated, onCancel }: QuickPatientFormProps) {
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState(initial);
  const [phone, setPhone] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const errors = identityErrors(identity);

  const create = useMutation({
    mutationFn: async () =>
      (await api.post<Patient>('/patients', { ...identityPayload(identity), phone: phone.trim() || undefined })).data,
    onSuccess: (patient) => {
      queryClient.setQueryData(['patient', patient.id], patient);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({
        title: `Le dossier de ${patient.firstName} ${patient.lastName} est créé`,
        description: 'Vous pourrez le compléter depuis sa fiche.',
      });
      onCreated(patient);
    },
    onError: () =>
      toast({
        title: 'Impossible de créer le dossier',
        description: 'Vérifiez la connexion et réessayez.',
        variant: 'destructive',
      }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) return setShowErrors(true);
    create.mutate();
  };

  return (
    <form onSubmit={submit} onKeyDown={focusNextOnEnter} noValidate className="space-y-5">
      <IdentityFields value={identity} onChange={setIdentity} errors={showErrors ? errors : {}} autoFocus />
      <Field label="Téléphone">
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          enterKeyHint="done"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onCancel} disabled={create.isPending}>
          <ArrowLeft />
          Retour au rendez-vous
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Créer le patient
        </Button>
      </div>
    </form>
  );
}
