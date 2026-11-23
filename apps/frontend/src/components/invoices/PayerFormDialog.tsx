import type { CreatePayerDto } from '@vp/types';
import { type FormEvent, useEffect, useState } from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { type BillingRhythm, type PayerOverviewDto, RHYTHMS, useSavePayer } from '../../lib/invoices';
import { fieldClass } from '../patient-file/LifeEventForm';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/toaster';

type Form = {
  name: string;
  address: string;
  zipCode: string;
  city: string;
  contact: string;
  conventionReference: string;
  billingRhythm: BillingRhythm;
  rhythmMonths: string;
  notes: string;
};

const empty: Form = {
  name: '',
  address: '',
  zipCode: '',
  city: '',
  contact: '',
  conventionReference: '',
  billingRhythm: 'MONTHLY',
  rhythmMonths: '3',
  notes: '',
};

function formOf(payer: PayerOverviewDto | null): Form {
  if (!payer) return empty;
  return {
    name: payer.name,
    address: payer.address ?? '',
    zipCode: payer.zipCode ?? '',
    city: payer.city ?? '',
    contact: payer.contact ?? '',
    conventionReference: payer.conventionReference ?? '',
    billingRhythm: payer.billingRhythm,
    rhythmMonths: String(payer.rhythmMonths ?? 3),
    notes: payer.notes ?? '',
  };
}

/**
 * Adds or edits a payer (« Organismes »): who it is, where to send its invoices, its convention
 * and how often to bill it.
 */
export function PayerFormDialog({
  payer,
  open,
  onOpenChange,
}: {
  /** null: a new payer */
  payer: PayerOverviewDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSavePayer();
  const [form, setForm] = useState<Form>(() => formOf(payer));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(formOf(payer));
      setErrors({});
    }
  }, [open, payer]);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Donnez un nom à l’organisme.';
    if (form.zipCode.trim() && !/^\d{5}$/.test(form.zipCode.trim())) next.zipCode = 'Le code postal compte 5 chiffres.';
    const months = Number(form.rhythmMonths);
    if (form.billingRhythm === 'EVERY_N_MONTHS' && !(Number.isInteger(months) && months >= 2 && months <= 12)) {
      next.rhythmMonths = 'De 2 à 12 mois.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: CreatePayerDto = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      zipCode: form.zipCode.trim() || null,
      city: form.city.trim() || null,
      contact: form.contact.trim() || null,
      conventionReference: form.conventionReference.trim() || null,
      billingRhythm: form.billingRhythm,
      rhythmMonths: form.billingRhythm === 'EVERY_N_MONTHS' ? months : null,
      notes: form.notes.trim() || null,
    };
    save.mutate(
      { ...body, id: payer?.id },
      {
        onSuccess: () => {
          toast({ title: payer ? 'Organisme modifié' : `${body.name} ajouté aux organismes` });
          onOpenChange(false);
        },
        onError: (error) =>
          toast({ title: apiErrorMessage(error, 'L’organisme n’a pas pu être enregistré. Réessayez.'), variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{payer ? `Modifier ${payer.name}` : 'Ajouter un organisme'}</DialogTitle>
          <DialogDescription>
            Une mutuelle, un employeur, une association ou une convention qui paie tout ou partie de certaines séances.
          </DialogDescription>
        </DialogHeader>
        <form id="payer-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-6" noValidate>
          <Field className="sm:col-span-6" label="Nom" required error={errors.name}>
            <Input value={form.name} onChange={set('name')} maxLength={120} autoFocus />
          </Field>
          <Field className="sm:col-span-6" label="Adresse">
            <Input value={form.address} onChange={set('address')} maxLength={300} autoComplete="off" />
          </Field>
          <Field className="sm:col-span-2" label="Code postal" error={errors.zipCode}>
            <Input value={form.zipCode} onChange={set('zipCode')} inputMode="numeric" maxLength={5} autoComplete="off" />
          </Field>
          <Field className="sm:col-span-4" label="Ville">
            <Input value={form.city} onChange={set('city')} maxLength={100} autoComplete="off" />
          </Field>
          <Field className="sm:col-span-3" label="Contact" hint="Une personne, un e-mail, un téléphone.">
            <Input value={form.contact} onChange={set('contact')} maxLength={300} autoComplete="off" />
          </Field>
          <Field className="sm:col-span-3" label="Référence de la convention">
            <Input value={form.conventionReference} onChange={set('conventionReference')} maxLength={100} autoComplete="off" />
          </Field>
          <Field className="sm:col-span-4" label="Facturer">
            <select className={fieldClass} value={form.billingRhythm} onChange={set('billingRhythm')}>
              {(Object.keys(RHYTHMS) as BillingRhythm[]).map((r) => (
                <option key={r} value={r}>
                  {RHYTHMS[r]}
                </option>
              ))}
            </select>
          </Field>
          {form.billingRhythm === 'EVERY_N_MONTHS' && (
            <Field className="sm:col-span-2" label="Nombre de mois" error={errors.rhythmMonths}>
              <Input value={form.rhythmMonths} onChange={set('rhythmMonths')} inputMode="numeric" maxLength={2} />
            </Field>
          )}
          <Field className="sm:col-span-6" label="Notes">
            <Textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Annuler
          </Button>
          <Button type="submit" form="payer-form" disabled={save.isPending}>
            {payer ? 'Enregistrer' : 'Ajouter l’organisme'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
