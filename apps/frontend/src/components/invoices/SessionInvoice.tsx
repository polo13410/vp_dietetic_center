import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Download, FilePen, Receipt, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { apiErrorMessage, useFormulas } from '../../hooks/useMe';
import api from '../../lib/api';
import { formatAmount, formatLongDay } from '../../lib/invoice-document';
import {
  downloadInvoicePdf,
  type InvoiceDto,
  type InvoiceMismatch,
  linksText,
  mismatchText,
  useCorrectInvoice,
  useIssueInvoice,
  useSessionInvoices,
} from '../../lib/invoices';
import {
  type Consultation,
  PAYMENT_METHODS,
  type PaymentMethod,
  useInvalidatePatientFile,
} from '../../lib/patient-file';
import { fieldClass } from '../patient-file/LifeEventsPanel';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

import { CancelInvoiceDialog } from './CancelInvoiceDialog';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

/**
 * The session's invoice: what will be invoiced (date, formula, payment, editable at any time),
 * then « Faire la facture ». Once issued: download, correct (credit note + new invoice) or cancel.
 * When the session no longer matches its invoice, a banner says so and offers the correction.
 * Self-contained so the session screen (lot 7) can place it where it wants.
 */
export function SessionInvoice({ session }: { session: Consultation }) {
  const { data, isLoading } = useSessionInvoices(session.id);
  const current = data?.current ?? null;

  return (
    <Section icon={Receipt} area="invoices" title="Facture">
      <div className="space-y-5">
        <BillingFields session={session} />
        {isLoading ? null : current ? (
          <IssuedInvoice invoice={current} mismatches={data?.mismatches ?? []} />
        ) : (
          <NotInvoiced session={session} />
        )}
        {data && data.history.length > 0 && <History invoices={data.history} />}
      </div>
    </Section>
  );
}

// ─── What is invoiced ─────────────────────────────────────────────────────────

/** "2026-11-20" in local time, for a date input. */
const dayValue = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function BillingFields({ session }: { session: Consultation }) {
  const invalidate = useInvalidatePatientFile();
  const { data: formulas = [] } = useFormulas();
  const offered = formulas.filter((f) => !f.archivedAt);
  const save = useMutation({
    mutationFn: (body: { date?: string; formulaId?: string | null; paymentMethod?: PaymentMethod }) =>
      api.patch(`/consultations/${session.id}`, body),
    onSuccess: () => invalidate(session.patientId),
    onError: (error) =>
      toast({ title: apiErrorMessage(error, 'Le changement n’a pas été enregistré. Réessayez.'), variant: 'destructive' }),
  });

  const changeDay = (day: string) => {
    if (!day) return;
    // Keeps the session's time, changes its day
    const previous = new Date(session.date);
    const [year, month, date] = day.split('-').map(Number);
    const next = new Date(previous);
    next.setFullYear(year, month - 1, date);
    save.mutate({ date: next.toISOString() });
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
      <Field label="Date de la séance">
        <input
          type="date"
          className={fieldClass}
          value={dayValue(session.date)}
          onChange={(e) => changeDay(e.target.value)}
        />
      </Field>
      <Field label="Formule">
        <select
          className={fieldClass}
          value={session.formulaId ?? ''}
          onChange={(e) => save.mutate({ formulaId: e.target.value || null })}
        >
          <option value="">Choisir…</option>
          {session.formulaId && !offered.some((f) => f.id === session.formulaId) && (
            <option value={session.formulaId}>{session.formulaLabel}</option>
          )}
          {offered.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
              {f.priceCents !== null && ` · ${formatAmount(f.priceCents)}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Moyen de paiement">
        <select
          className={fieldClass}
          value={session.paymentMethod}
          onChange={(e) => save.mutate({ paymentMethod: e.target.value as PaymentMethod })}
        >
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHODS[m]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ─── Before issue ─────────────────────────────────────────────────────────────

function NotInvoiced({ session }: { session: Consultation }) {
  const issue = useIssueInvoice();
  const ready = !!session.formulaLabel && session.priceCents !== null;

  const run = () =>
    issue.mutate(session.id, {
      onSuccess: (invoice) => toast({ title: `Facture n° ${invoice.number} faite` }),
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être faite. Réessayez.'), variant: 'destructive' }),
    });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
      <p className="text-base">
        {ready ? (
          <>
            Pas encore de facture pour cette séance
            {session.priceCents !== null && <> ({formatAmount(session.priceCents)})</>}.
          </>
        ) : (
          'Choisissez la formule de la séance (avec son prix) pour faire la facture.'
        )}
      </p>
      <Button onClick={run} disabled={!ready || issue.isPending}>
        <Receipt aria-hidden /> Faire la facture
      </Button>
    </div>
  );
}

// ─── After issue ──────────────────────────────────────────────────────────────

function useDownload() {
  const [pending, setPending] = useState<string | null>(null);
  const run = async (invoice: InvoiceDto) => {
    setPending(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setPending(null);
    }
  };
  return { run, pending };
}

function IssuedInvoice({ invoice, mismatches }: { invoice: InvoiceDto; mismatches: InvoiceMismatch[] }) {
  const download = useDownload();
  const correct = useCorrectInvoice();
  const [confirmCorrect, setConfirmCorrect] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const runCorrect = () =>
    correct.mutate(invoice.id, {
      onSuccess: (replacement) => {
        setConfirmCorrect(false);
        toast({ title: `Facture n° ${replacement.number} faite`, description: `Elle remplace la n° ${invoice.number}.` });
      },
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être corrigée. Réessayez.'), variant: 'destructive' }),
    });

  return (
    <div className="space-y-4">
      {mismatches.length > 0 && (
        <div role="status" className="space-y-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-warning">
          <p className="flex gap-2 text-base font-medium">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              La facture n° {invoice.number} ne correspond plus à la séance : {mismatchText(mismatches)}{' '}
              {mismatches.length > 1 ? 'ont changé' : 'a changé'}.
            </span>
          </p>
          <Button onClick={() => setConfirmCorrect(true)}>
            <FilePen aria-hidden /> Corriger la facture
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-lg font-semibold">Facture n° {invoice.number}</p>
        <InvoiceStatusBadge invoice={invoice} />
        <p className="text-base text-muted-foreground">
          {formatAmount(invoice.amountCents)} · faite le {formatLongDay(invoice.issuedAt)}
        </p>
      </div>
      {invoice.replaces && (
        <p className="text-sm text-muted-foreground">Remplace la facture n° {invoice.replaces.number}.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => download.run(invoice)} disabled={download.pending === invoice.id}>
          <Download aria-hidden /> Télécharger la facture
        </Button>
        {mismatches.length === 0 && (
          <Button variant="outline" onClick={() => setConfirmCorrect(true)}>
            <FilePen aria-hidden /> Corriger la facture
          </Button>
        )}
        <Button variant="ghost" onClick={() => setCancelling(true)}>
          <Undo2 aria-hidden /> Annuler la facture
        </Button>
      </div>

      <ConfirmDialog
        open={confirmCorrect}
        onOpenChange={setConfirmCorrect}
        title={`Corriger la facture n° ${invoice.number} ?`}
        description="Un avoir l’annule et une nouvelle facture est faite avec la séance, votre cabinet et le patient tels qu’ils sont maintenant. Les deux restent dans vos factures."
        confirmLabel="Corriger la facture"
        cancelLabel="Ne rien changer"
        loading={correct.isPending}
        onConfirm={runCorrect}
      />
      <CancelInvoiceDialog invoice={invoice} open={cancelling} onOpenChange={setCancelling} />
    </div>
  );
}

/** Cancelled invoices and credit notes of the session, struck through, still downloadable. */
function History({ invoices }: { invoices: InvoiceDto[] }) {
  const download = useDownload();
  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-base font-medium text-muted-foreground">Factures annulées et avoirs</h3>
      <ul className="divide-y">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base text-muted-foreground line-through decoration-1">
                  {invoice.type === 'CREDIT_NOTE' ? 'Avoir' : 'Facture'} n° {invoice.number}
                </span>
                <InvoiceStatusBadge invoice={invoice} />
              </p>
              <p className="text-sm text-muted-foreground">
                {[formatAmount(invoice.amountCents), ...linksText(invoice)].join(' · ')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Télécharger ${invoice.type === 'CREDIT_NOTE' ? 'l’avoir' : 'la facture'} n° ${invoice.number}`}
              onClick={() => download.run(invoice)}
              disabled={download.pending === invoice.id}
            >
              <Download aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
