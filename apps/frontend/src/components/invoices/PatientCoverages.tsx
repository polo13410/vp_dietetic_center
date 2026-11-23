import type { CreateCoverageDto } from '@vp/types';
import { HandCoins, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { apiErrorMessage } from '../../hooks/useMe';
import {
  coverageTerms,
  eurosInput,
  parseEuros,
  type PatientCoverageDto,
  type ShareKind,
  usePatientCoverages,
  usePayers,
  useSaveCoverage,
} from '../../lib/invoices';
import { FILE_ANCHORS } from '../../lib/patient-file';
import { fieldClass } from '../patient-file/LifeEventForm';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { SegmentedControl } from '../shared/SegmentedControl';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

const KINDS: { value: ShareKind; label: string }[] = [
  { value: 'AMOUNT', label: 'En euros' },
  { value: 'PERCENT', label: 'En %' },
];

/**
 * « Prise en charge »: what a payer (mutuelle, employer, association…) pays of each séance of
 * the patient, an amount or a percentage, for a number of séances and a period when they are
 * limited (docs/REFONTE.md lot 16). Edited here, in the Factures tab; the summary shows it.
 * A change applies to the séances not billed yet from today on: earlier ones keep their split.
 */
export function PatientCoverages({ patientId }: { patientId: string }) {
  const { data: coverages = [] } = usePatientCoverages(patientId);
  const [editing, setEditing] = useState<PatientCoverageDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<PatientCoverageDto | null>(null);
  const save = useSaveCoverage(patientId);

  const remove = () =>
    removing &&
    save.mutate(
      { id: removing.id, remove: true },
      {
        onSuccess: () => {
          setRemoving(null);
          toast({ title: 'Prise en charge retirée' });
        },
        onError: (error) => toast({ title: apiErrorMessage(error, 'Réessayez.'), variant: 'destructive' }),
      },
    );

  return (
    <Section
      id={FILE_ANCHORS.coverage}
      icon={HandCoins}
      area="invoices"
      title="Prise en charge"
      description="Un organisme qui paie tout ou partie de ses séances."
      action={
        editing === null && (
          <Button variant="outline" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Ajouter une prise en charge
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {coverages.length === 0 && editing === null && (
          <p className="text-base text-muted-foreground">Aucune : le patient paie ses séances.</p>
        )}
        {coverages.length > 0 && (
          <ul className="divide-y">
            {coverages.map((coverage) =>
              editing !== 'new' && editing?.id === coverage.id ? (
                <li key={coverage.id} className="py-3">
                  <CoverageForm patientId={patientId} coverage={coverage} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={coverage.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <CoverageSummary coverage={coverage} />
                  <div className="flex">
                    <Button variant="ghost" onClick={() => setEditing(coverage)}>
                      <Pencil aria-hidden /> Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer la prise en charge de ${coverage.payer.name}`}
                      onClick={() => setRemoving(coverage)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {editing === 'new' && <CoverageForm patientId={patientId} onDone={() => setEditing(null)} />}
      </div>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Retirer la prise en charge de ${removing?.payer.name ?? 'l’organisme'} ?`}
        description="Les séances déjà facturées ou passées gardent ce qui était pris en charge. Les prochaines séances seront payées par le patient."
        confirmLabel="Retirer"
        variant="destructive"
        loading={save.isPending}
        onConfirm={remove}
      />
    </Section>
  );
}

/** « Mutuelle Horizon : 60 % de chaque séance, 10 séances au plus · N° PEC-0042 · 3 séances prises en charge » */
export function CoverageSummary({ coverage }: { coverage: PatientCoverageDto }) {
  const used =
    coverage.maxSessions !== null
      ? `${coverage.coveredSessions} séance${coverage.coveredSessions > 1 ? 's' : ''} sur ${coverage.maxSessions} prise${coverage.maxSessions > 1 ? 's' : ''} en charge`
      : `${coverage.coveredSessions} séance${coverage.coveredSessions > 1 ? 's' : ''} prise${coverage.coveredSessions > 1 ? 's' : ''} en charge`;
  const over = coverage.maxSessions !== null && coverage.coveredSessions >= coverage.maxSessions;
  const ended = !!coverage.endDate && coverage.endDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="flex flex-wrap items-center gap-2 text-base font-medium">
        {coverage.payer.name}
        {coverage.payer.archivedAt && <StatusBadge status="PAYER_ARCHIVED" tone="neutral" label="Organisme archivé" />}
        {(over || ended) && <StatusBadge status="COVERAGE_OVER" tone="warning" label="Terminée" />}
      </p>
      <p className="text-base">{coverageTerms(coverage)}</p>
      <p className="text-sm text-muted-foreground">
        {[coverage.coverageNumber && `N° de prise en charge ${coverage.coverageNumber}`, used].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

function CoverageForm({
  patientId,
  coverage,
  onDone,
}: {
  patientId: string;
  coverage?: PatientCoverageDto;
  onDone: () => void;
}) {
  const { data: payers } = usePayers();
  const offered = (payers ?? []).filter((p) => !p.archivedAt || p.id === coverage?.payerId);
  const save = useSaveCoverage(patientId);
  const [payerId, setPayerId] = useState(coverage?.payerId ?? '');
  const [kind, setKind] = useState<ShareKind>(coverage?.kind ?? 'AMOUNT');
  const [value, setValue] = useState(
    coverage ? (coverage.kind === 'AMOUNT' ? eurosInput(coverage.value) : String(coverage.value)) : '',
  );
  const [maxSessions, setMaxSessions] = useState(coverage?.maxSessions ? String(coverage.maxSessions) : '');
  const [startDate, setStartDate] = useState(coverage?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(coverage?.endDate?.slice(0, 10) ?? '');
  const [number, setNumber] = useState(coverage?.coverageNumber ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!payerId) next.payerId = 'Choisissez l’organisme.';
    const amount =
      kind === 'AMOUNT'
        ? parseEuros(value)
        : /^\d{1,3}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 100
          ? Number(value)
          : null;
    if (!amount) next.value = kind === 'AMOUNT' ? 'Un montant en euros, par exemple 30 ou 22,50.' : 'Un pourcentage entier, de 1 à 100.';
    const max = maxSessions.trim() ? Number(maxSessions) : null;
    if (max !== null && !(Number.isInteger(max) && max >= 1)) next.maxSessions = 'Un nombre de séances, ou rien.';
    if (startDate && endDate && startDate > endDate) next.endDate = 'La fin est avant le début.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: CreateCoverageDto = {
      payerId,
      kind,
      value: amount!,
      maxSessions: max,
      startDate: startDate || null,
      endDate: endDate || null,
      coverageNumber: number.trim() || null,
    };
    save.mutate(
      { ...body, id: coverage?.id },
      {
        onSuccess: () => {
          toast({ title: coverage ? 'Prise en charge modifiée' : 'Prise en charge ajoutée' });
          onDone();
        },
        onError: (error) =>
          toast({ title: apiErrorMessage(error, 'La prise en charge n’a pas pu être enregistrée. Réessayez.'), variant: 'destructive' }),
      },
    );
  };

  if (payers && offered.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
        <p className="text-base">Ajoutez d’abord l’organisme, dans Factures &gt; Organismes.</p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/invoices?vue=organismes">Ajouter un organisme</Link>
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-6">
      <Field className="sm:col-span-6" label="Organisme" required error={errors.payerId}>
        <select className={fieldClass} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          <option value="">Choisir…</option>
          {offered.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-1.5 sm:col-span-6">
        <label htmlFor="coverage-value" className="block text-base font-medium">
          Part prise en charge, par séance <span className="text-sm font-normal text-muted-foreground">obligatoire</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl label="En euros ou en pourcentage" options={KINDS} value={kind} onChange={setKind} />
          <input
            id="coverage-value"
            inputMode="decimal"
            autoComplete="off"
            className={`${fieldClass} w-32 text-right tabular-nums`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!errors.value}
            aria-describedby={errors.value ? 'coverage-value-error' : 'coverage-value-hint'}
          />
          <span className="text-base text-muted-foreground">{kind === 'AMOUNT' ? '€' : '% du prix, après remise'}</span>
        </div>
        {errors.value ? (
          <p id="coverage-value-error" className="text-sm font-medium text-destructive">
            {errors.value}
          </p>
        ) : (
          <p id="coverage-value-hint" className="text-sm text-muted-foreground">
            Jamais plus que le prix de la séance : le patient paie le reste.
          </p>
        )}
      </div>
      <Field className="sm:col-span-2" label="Nombre de séances" hint="Facultatif" error={errors.maxSessions}>
        <input
          inputMode="numeric"
          className={fieldClass}
          value={maxSessions}
          onChange={(e) => setMaxSessions(e.target.value)}
          maxLength={3}
        />
      </Field>
      <Field className="sm:col-span-2" label="Du" hint="Facultatif">
        <input type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <Field className="sm:col-span-2" label="Au" hint="Facultatif" error={errors.endDate}>
        <input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </Field>
      <Field className="sm:col-span-6" label="Numéro de prise en charge" hint="Facultatif, repris sur la facture de l’organisme.">
        <input className={fieldClass} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={100} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-6">
        <Button variant="ghost" type="button" onClick={onDone} disabled={save.isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {coverage ? 'Enregistrer' : 'Ajouter la prise en charge'}
        </Button>
      </div>
    </form>
  );
}
