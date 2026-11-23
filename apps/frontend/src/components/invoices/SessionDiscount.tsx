import { HandCoins, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useAutosave } from '../../hooks/useAutosave';
import { apiErrorMessage } from '../../hooks/useMe';
import api from '../../lib/api';
import { formatAmount } from '../../lib/invoice-document';
import { eurosInput, parseEuros, type ShareKind } from '../../lib/invoices';
import { type Consultation, useInvalidatePatientFile } from '../../lib/patient-file';
import { fieldClass } from '../patient-file/LifeEventForm';
import { SaveIndicator } from '../shared/SaveIndicator';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Button } from '../ui/button';

const KINDS: { value: ShareKind; label: string }[] = [
  { value: 'AMOUNT', label: '€' },
  { value: 'PERCENT', label: '%' },
];

type DiscountBody = { discountKind: ShareKind | null; discountValue: number | null; discountReason: string | null };

/** What is typed in the value box: euros with a comma, or a percentage. */
const shown = (kind: ShareKind | null, value: number | null) =>
  value === null ? '' : kind === 'PERCENT' ? String(value) : eurosInput(value);

/**
 * The séance's discount (« remise », docs/REFONTE.md lot 16): in euros or in %, with an optional
 * reason. Prefilled with the patient's previous séance, saved as she types. Without one, a
 * discreet « Ajouter une remise ».
 */
export function SessionDiscount({ session }: { session: Consultation }) {
  const invalidate = useInvalidatePatientFile();
  const [open, setOpen] = useState(session.discountKind !== null);
  const [kind, setKind] = useState<ShareKind>(session.discountKind ?? 'AMOUNT');
  const [value, setValue] = useState(shown(session.discountKind, session.discountValue));
  const [reason, setReason] = useState(session.discountReason ?? '');
  const [error, setError] = useState<string>();
  const autosave = useAutosave(async (body: DiscountBody) => {
    try {
      await api.patch(`/consultations/${session.id}`, body);
      setError(undefined);
    } catch (e) {
      setError(apiErrorMessage(e, 'La remise n’a pas été enregistrée. Réessayez.'));
      throw e;
    }
    invalidate(session.patientId);
  });

  const parse = (k: ShareKind, text: string): number | null | undefined => {
    if (text.trim() === '') return null;
    if (k === 'AMOUNT') return parseEuros(text) ?? undefined;
    const n = Number(text.replace(',', '.'));
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : undefined;
  };

  const change = (next: { kind?: ShareKind; value?: string; reason?: string }) => {
    const k = next.kind ?? kind;
    const v = next.value ?? value;
    const r = next.reason ?? reason;
    if (next.kind) setKind(next.kind);
    if (next.value !== undefined) setValue(next.value);
    if (next.reason !== undefined) setReason(next.reason);
    const cents = parse(k, v);
    if (cents === undefined) {
      setError(k === 'PERCENT' ? 'Un pourcentage entier, de 0 à 100.' : 'Un montant en euros, par exemple 10 ou 12,50.');
      autosave.cancel();
      return;
    }
    setError(undefined);
    autosave.schedule(
      cents === null
        ? { discountKind: null, discountValue: null, discountReason: null }
        : { discountKind: k, discountValue: cents, discountReason: r.trim() || null },
    );
  };

  const remove = () => {
    setOpen(false);
    setValue('');
    setReason('');
    setError(undefined);
    autosave.schedule({ discountKind: null, discountValue: null, discountReason: null });
    void autosave.flush();
  };

  if (!open) {
    return (
      <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Ajouter une remise
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`discount-${session.id}`} className="block text-base font-medium">
            Remise
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`discount-${session.id}`}
              inputMode="decimal"
              autoComplete="off"
              className={`${fieldClass} w-28 text-right tabular-nums`}
              value={value}
              placeholder="0"
              aria-invalid={!!error}
              onChange={(e) => change({ value: e.target.value })}
              onBlur={() => void autosave.flush()}
            />
            <SegmentedControl
              label="Remise en euros ou en pourcentage"
              options={KINDS}
              value={kind}
              onChange={(k) => change({ kind: k })}
            />
          </div>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <label htmlFor={`discount-reason-${session.id}`} className="block text-base font-medium">
            Motif <span className="text-sm font-normal text-muted-foreground">facultatif</span>
          </label>
          <input
            id={`discount-reason-${session.id}`}
            className={fieldClass}
            value={reason}
            maxLength={200}
            placeholder="geste, tarif solidaire…"
            onChange={(e) => change({ reason: e.target.value })}
            onBlur={() => void autosave.flush()}
          />
        </div>
        <Button variant="ghost" onClick={remove} aria-label="Retirer la remise">
          <X aria-hidden /> Retirer
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : (
        <SaveIndicator state={autosave.state} />
      )}
    </div>
  );
}

/**
 * What the séance costs and who pays it, next to its price: price, discount, net, the payer's
 * part and the patient's. Says when the séance is free, paid in full by the payer, or no longer
 * covered.
 */
export function SessionSplit({ session }: { session: Consultation }) {
  const { priceCents, discountCents, netCents, payerCents, patientCents } = session;
  if (priceCents === null || netCents === null) return null;
  const discount = discountCents ?? 0;
  const payer = payerCents ?? 0;
  const patient = patientCents ?? netCents;
  const payerName = session.payer?.name ?? 'l’organisme';
  const uncovered = !!session.coverage && payer === 0 && netCents > 0;
  if (discount === 0 && payer === 0 && !uncovered) return null;

  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-base">
      <HandCoins className="mt-0.5 size-5 shrink-0 text-area-invoices" aria-hidden />
      <div className="min-w-0 space-y-1">
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          <SplitItem label="Prix" cents={priceCents} />
          {discount > 0 && <SplitItem label="Remise" cents={-discount} />}
          {discount > 0 && <SplitItem label="Net" cents={netCents} />}
          {payer > 0 && <SplitItem label={`Pris en charge par ${payerName}`} cents={payer} />}
          <SplitItem label="À payer par le patient" cents={patient} strong />
        </dl>
        {netCents === 0 ? (
          <p className="text-sm text-muted-foreground">Séance offerte : pas de facture à faire.</p>
        ) : patient === 0 ? (
          <p className="text-sm text-muted-foreground">
            Prise en charge en totalité par {payerName} : pas de facture au patient, elle sera sur la facture de l’organisme.
          </p>
        ) : uncovered ? (
          <p className="text-sm text-muted-foreground">
            Pas de prise en charge par {session.coverage!.payer.name} pour cette séance : le nombre de séances ou la période
            prévus sont dépassés.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SplitItem({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{formatAmount(cents)}</dd>
    </div>
  );
}
