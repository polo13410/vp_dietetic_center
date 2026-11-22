import type { FormulaDto } from '@vp/types';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Euro, Plus, Undo2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import {
  useCreateFormula,
  useRemoveFormula,
  useReorderFormulas,
  useUpdateFormula,
} from '../../hooks/useMe';
import {
  centsToInput,
  formatEuros,
  parseEuros,
  priceError,
} from '../../lib/settings-format';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Input } from '../ui/input';

import { AutosaveField, SaveIndicator, type Track, useSaveTracker } from './autosave';

const LABEL_REQUIRED = 'Donnez un nom à la formule.';

/** Her prices ("Bilan 60 €"): chosen for each session, and printed on its invoice. */
export function FormulasSection({ formulas }: { formulas: FormulaDto[] }) {
  const { state, track } = useSaveTracker();
  const { mutateAsync: reorder } = useReorderFormulas();
  const { mutateAsync: remove, isPending: removing } = useRemoveFormula();
  const [toRemove, setToRemove] = useState<FormulaDto | null>(null);

  const offered = formulas.filter((f) => !f.archivedAt);
  const archived = formulas.filter((f) => f.archivedAt);
  const missingPrice = offered.filter((f) => f.priceCents === null);

  const move = (index: number, by: -1 | 1) => {
    const ids = offered.map((f) => f.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void track(() => reorder(ids));
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    await track(() => remove(toRemove.id));
    setToRemove(null);
  };

  return (
    <Section
      icon={Euro}
      area="settings"
      title="Mes tarifs"
      description="Les formules proposées pour vos séances, dans l’ordre où elles apparaissent."
      action={<SaveIndicator state={state} />}
    >
      <div className="space-y-5">
        {missingPrice.length > 0 && (
          <div
            role="note"
            className="flex items-start gap-3 rounded-lg bg-warning-soft p-4 text-base text-warning"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              {missingPrice.length === 1
                ? `Indiquez le prix de la formule « ${missingPrice[0].label} ».`
                : `Indiquez le prix des formules ${missingPrice.map((f) => `« ${f.label} »`).join(', ')}.`}{' '}
              Il est repris dans vos séances et sur vos factures.
            </p>
          </div>
        )}

        {offered.length === 0 ? (
          <EmptyState
            icon={Euro}
            area="settings"
            title="Aucune formule pour l’instant."
            description="Ajoutez vos tarifs ci-dessous, par exemple « Bilan » et « Suivi »."
          />
        ) : (
          <ol className="space-y-3" aria-label="Formules proposées">
            {offered.map((formula, index) => (
              <FormulaRow
                key={formula.id}
                formula={formula}
                track={track}
                onUp={index > 0 ? () => move(index, -1) : undefined}
                onDown={index < offered.length - 1 ? () => move(index, 1) : undefined}
                onRemove={() => setToRemove(formula)}
              />
            ))}
          </ol>
        )}

        <NewFormula track={track} />

        {archived.length > 0 && <ArchivedFormulas formulas={archived} track={track} />}
      </div>

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={`Retirer la formule « ${toRemove?.label ?? ''} » ?`}
        description="Elle ne sera plus proposée pour les nouvelles séances. Les séances passées gardent leur formule et leur prix."
        confirmLabel="Retirer la formule"
        loading={removing}
        onConfirm={() => void confirmRemove()}
      />
    </Section>
  );
}

interface FormulaRowProps {
  formula: FormulaDto;
  track: Track;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}

function FormulaRow({ formula, track, onUp, onDown, onRemove }: FormulaRowProps) {
  const { mutateAsync: update } = useUpdateFormula();

  return (
    <li className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border p-4">
      <AutosaveField
        className="min-w-[12rem] flex-1"
        label="Nom de la formule"
        value={formula.label}
        requiredMessage={LABEL_REQUIRED}
        onSave={(label) => update({ id: formula.id, dto: { label: label ?? '' } })}
        track={track}
      />
      <AutosaveField
        className="w-40"
        label={
          <>
            Prix en euros
            {formula.priceCents === null && (
              <StatusBadge status="price-missing" label="À compléter" tone="warning" />
            )}
          </>
        }
        value={centsToInput(formula.priceCents)}
        validate={priceError}
        onSave={(price) =>
          update({ id: formula.id, dto: { priceCents: parseEuros(price ?? '') ?? null } })
        }
        track={track}
        inputProps={{ inputMode: 'decimal', placeholder: '60' }}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onUp}
          disabled={!onUp}
          aria-label={`Monter « ${formula.label} »`}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onDown}
          disabled={!onDown}
          aria-label={`Descendre « ${formula.label} »`}
        >
          <ArrowDown />
        </Button>
        <Button variant="ghost" onClick={onRemove}>
          Retirer
        </Button>
      </div>
    </li>
  );
}

function NewFormula({ track }: { track: Track }) {
  const { mutateAsync: create, isPending } = useCreateFormula();
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<{ label?: string; price?: string }>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      label: label.trim() ? undefined : LABEL_REQUIRED,
      price: priceError(price) ?? undefined,
    };
    setErrors(found);
    if (found.label || found.price) return;
    const ok = await track(() => create({ label: label.trim(), priceCents: parseEuros(price) ?? null }));
    if (ok) {
      setLabel('');
      setPrice('');
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-dashed border-input p-4"
      aria-label="Ajouter une formule"
    >
      <Field className="min-w-[12rem] flex-1" label="Nouvelle formule" error={errors.label}>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Par exemple : Séance de groupe"
        />
      </Field>
      <Field className="w-40" label="Prix en euros" error={errors.price}>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="50"
        />
      </Field>
      <Button type="submit" variant="outline" disabled={isPending}>
        <Plus /> Ajouter la formule
      </Button>
    </form>
  );
}

function ArchivedFormulas({ formulas, track }: { formulas: FormulaDto[]; track: Track }) {
  const { mutateAsync: update } = useUpdateFormula();

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group -ml-3">
          <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          Formules retirées ({formulas.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Elles ne sont plus proposées pour les nouvelles séances.
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {formulas.map((formula) => (
            <li key={formula.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <span className="text-base">
                {formula.label}
                {formula.priceCents !== null && (
                  <span className="text-muted-foreground"> · {formatEuros(formula.priceCents)}</span>
                )}
              </span>
              <Button
                variant="outline"
                onClick={() => void track(() => update({ id: formula.id, dto: { archived: false } }))}
              >
                <Undo2 /> Proposer à nouveau
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
