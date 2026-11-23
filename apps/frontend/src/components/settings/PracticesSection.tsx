import type { PracticeDto } from '@vp/types';
import { Archive, Building2, ChevronDown, Plus, Star, Undo2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { useCreatePractice, useUpdatePractice } from '../../hooks/useMe';
import { addressLine, digitsOnly, phoneError, siretError, zipCodeError } from '../../lib/settings-format';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Input } from '../ui/input';

import { AutosaveField, SaveIndicator, type Track, useSaveTracker } from './autosave';

const NAME_REQUIRED = 'Donnez un nom au cabinet.';

/**
 * Where she consults (lot 15). Each practice's address, and its own SIRET if it has one, goes on
 * the invoices of the séances held there. The default one is prefilled on new appointments.
 */
export function PracticesSection({ practices }: { practices: PracticeDto[] }) {
  const { state, track } = useSaveTracker();
  const { mutateAsync: update, isPending: archiving } = useUpdatePractice();
  const [toArchive, setToArchive] = useState<PracticeDto | null>(null);

  const active = practices.filter((p) => !p.archivedAt);
  const archived = practices.filter((p) => p.archivedAt);

  const confirmArchive = async () => {
    if (!toArchive) return;
    await track(() => update({ id: toArchive.id, dto: { archived: true } }));
    setToArchive(null);
  };

  return (
    <Section
      icon={Building2}
      area="settings"
      title="Mes cabinets"
      description="Les lieux où vous consultez. L’adresse du cabinet de la séance figure sur sa facture."
      action={<SaveIndicator state={state} />}
    >
      <div className="space-y-5">
        <ul className="space-y-3" aria-label="Cabinets">
          {active.map((practice) => (
            <PracticeRow
              key={practice.id}
              practice={practice}
              track={track}
              // At least one practice stays: the last one cannot be archived
              onArchive={active.length > 1 ? () => setToArchive(practice) : undefined}
            />
          ))}
        </ul>

        <NewPractice track={track} />

        {archived.length > 0 && <ArchivedPractices practices={archived} track={track} />}
      </div>

      <ConfirmDialog
        open={!!toArchive}
        onOpenChange={(open) => !open && setToArchive(null)}
        title={`Archiver le cabinet « ${toArchive?.name ?? ''} » ?`}
        description={
          toArchive?.isDefault
            ? 'Il ne sera plus proposé pour les rendez-vous. Le cabinet suivant deviendra celui par défaut. Les séances passées gardent leur cabinet.'
            : 'Il ne sera plus proposé pour les rendez-vous. Les séances passées gardent leur cabinet.'
        }
        confirmLabel="Archiver le cabinet"
        loading={archiving}
        onConfirm={() => void confirmArchive()}
      />
    </Section>
  );
}

interface PracticeRowProps {
  practice: PracticeDto;
  track: Track;
  onArchive?: () => void;
}

function PracticeRow({ practice, track, onArchive }: PracticeRowProps) {
  const { mutateAsync: update } = useUpdatePractice();
  const save = (field: 'name' | 'address' | 'zipCode' | 'city' | 'phone') => (value: string | null) =>
    update({ id: practice.id, dto: { [field]: field === 'name' ? (value ?? '') : value } });

  return (
    <li className="rounded-lg border border-border p-4" aria-label={practice.name}>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-6">
        <AutosaveField
          className="sm:col-span-4"
          label="Nom du cabinet"
          value={practice.name}
          requiredMessage={NAME_REQUIRED}
          onSave={save('name')}
          track={track}
        />
        <div className="flex items-end sm:col-span-2 sm:justify-end">
          {practice.isDefault ? (
            <p className="flex min-h-11 items-center gap-2">
              <StatusBadge status="DEFAULT" />
            </p>
          ) : (
            <Button
              variant="outline"
              onClick={() => void track(() => update({ id: practice.id, dto: { isDefault: true } }))}
            >
              <Star aria-hidden /> Choisir par défaut
            </Button>
          )}
        </div>
        <AutosaveField
          className="sm:col-span-6"
          label="Adresse"
          hint="Numéro et rue."
          value={practice.address}
          onSave={save('address')}
          track={track}
          inputProps={{ autoComplete: 'street-address' }}
        />
        <AutosaveField
          className="sm:col-span-2"
          label="Code postal"
          value={practice.zipCode}
          validate={zipCodeError}
          onSave={save('zipCode')}
          track={track}
          inputProps={{ inputMode: 'numeric', autoComplete: 'postal-code' }}
        />
        <AutosaveField
          className="sm:col-span-4"
          label="Ville"
          value={practice.city}
          onSave={save('city')}
          track={track}
          inputProps={{ autoComplete: 'address-level2' }}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="Téléphone du cabinet"
          hint="Facultatif."
          value={practice.phone}
          validate={phoneError}
          onSave={save('phone')}
          track={track}
          inputProps={{ type: 'tel', inputMode: 'tel' }}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="SIRET de ce cabinet"
          hint="Seulement s’il diffère de celui de votre activité."
          value={practice.siret}
          validate={siretError}
          onSave={(siret) => update({ id: practice.id, dto: { siret: siret && digitsOnly(siret) } })}
          track={track}
          inputProps={{ inputMode: 'numeric' }}
        />
      </div>
      {onArchive && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={onArchive}>
            <Archive aria-hidden /> Archiver
          </Button>
        </div>
      )}
    </li>
  );
}

function NewPractice({ track }: { track: Track }) {
  const { mutateAsync: create, isPending } = useCreatePractice();
  const empty = { name: '', address: '', zipCode: '', city: '' };
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<{ name?: string; zipCode?: string }>({});
  const set = (field: keyof typeof empty) => (value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const zip = draft.zipCode.trim();
    const found = {
      name: draft.name.trim() ? undefined : NAME_REQUIRED,
      zipCode: zip ? (zipCodeError(zip) ?? undefined) : undefined,
    };
    setErrors(found);
    if (found.name || found.zipCode) return;
    const value = (text: string) => text.trim() || null;
    const ok = await track(() =>
      create({
        name: draft.name.trim(),
        address: value(draft.address),
        zipCode: value(draft.zipCode),
        city: value(draft.city),
      }),
    );
    if (ok) setDraft(empty);
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="grid gap-x-4 gap-y-4 rounded-lg border border-dashed border-input p-4 sm:grid-cols-6"
      aria-label="Ajouter un cabinet"
    >
      <Field className="sm:col-span-6" label="Nouveau cabinet" error={errors.name}>
        <Input
          value={draft.name}
          onChange={(e) => set('name')(e.target.value)}
          placeholder="Par exemple : Maison de santé de Marseille"
        />
      </Field>
      <Field className="sm:col-span-6" label="Adresse">
        <Input value={draft.address} onChange={(e) => set('address')(e.target.value)} autoComplete="street-address" />
      </Field>
      <Field className="sm:col-span-2" label="Code postal" error={errors.zipCode}>
        <Input
          value={draft.zipCode}
          onChange={(e) => set('zipCode')(e.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </Field>
      <Field className="sm:col-span-4" label="Ville">
        <Input value={draft.city} onChange={(e) => set('city')(e.target.value)} autoComplete="address-level2" />
      </Field>
      <div className="sm:col-span-6">
        <Button type="submit" variant="outline" disabled={isPending}>
          <Plus aria-hidden /> Ajouter le cabinet
        </Button>
      </div>
    </form>
  );
}

function ArchivedPractices({ practices, track }: { practices: PracticeDto[]; track: Track }) {
  const { mutateAsync: update } = useUpdatePractice();

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group -ml-3">
          <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          Cabinets archivés ({practices.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mb-3 text-sm text-muted-foreground">Ils ne sont plus proposés pour les rendez-vous.</p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {practices.map((practice) => (
            <li key={practice.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <span className="text-base">
                {practice.name}
                {addressLine(practice) && <span className="text-muted-foreground"> · {addressLine(practice)}</span>}
              </span>
              <Button
                variant="outline"
                onClick={() => void track(() => update({ id: practice.id, dto: { archived: false } }))}
              >
                <Undo2 aria-hidden /> Proposer à nouveau
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
