import { AlertTriangle, Download, FilePen, Receipt, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatAmount, formatLongDay } from '../../lib/invoice-document';
import {
  downloadInvoicePdf,
  type InvoiceDto,
  type InvoiceMismatch,
  linksText,
  mismatchText,
  useCorrectInvoice,
  patientBilling,
  useIssueInvoice,
  useSessionInvoices,
} from '../../lib/invoices';
import type { Consultation } from '../../lib/patient-file';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

import { CancelInvoiceDialog } from './CancelInvoiceDialog';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

/**
 * The session's invoice: « Faire la facture » with what the séance's header line says (date,
 * formula, payment). Once issued: download, correct (credit note + new invoice) or cancel.
 * When the session no longer matches its invoice, a banner says so and offers the correction.
 */
export function SessionInvoice({ session }: { session: Consultation }) {
  const { data, isLoading } = useSessionInvoices(session.id);
  const current = data?.current ?? null;

  return (
    <Section icon={Receipt} area="invoices" title="Facture">
      <div className="space-y-5">
        {isLoading ? null : current ? (
          <IssuedInvoice invoice={current} mismatches={data?.mismatches ?? []} />
        ) : (
          <NotInvoiced session={session} />
        )}
        {data?.payerInvoice && (
          <p className="text-base text-muted-foreground">
            La part de {data.payerInvoice.payerName ?? 'l’organisme'} est sur sa facture n° {data.payerInvoice.number}.
          </p>
        )}
        {data && data.history.length > 0 && <History invoices={data.history} />}
      </div>
    </Section>
  );
}

// ─── Before issue ─────────────────────────────────────────────────────────────

function NotInvoiced({ session }: { session: Consultation }) {
  const issue = useIssueInvoice();
  const billing = patientBilling(session);
  const ready = billing.state === 'ready';

  const run = () =>
    issue.mutate(session.id, {
      onSuccess: (invoice) => toast({ title: `Facture n° ${invoice.number} faite` }),
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être faite. Réessayez.'), variant: 'destructive' }),
    });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
      <p className="text-base">
        {billing.state === 'ready' ? (
          <>Pas encore de facture pour cette séance ({formatAmount(billing.cents)}).</>
        ) : billing.state === 'free' ? (
          'Séance offerte : pas de facture à faire.'
        ) : billing.state === 'payer' ? (
          `Prise en charge en totalité par ${session.payer?.name ?? 'l’organisme'} : pas de facture au patient.`
        ) : (
          'Choisissez la formule de la séance (avec son prix) pour faire la facture.'
        )}
      </p>
      {billing.state !== 'free' && billing.state !== 'payer' && (
        <Button onClick={run} disabled={!ready || issue.isPending}>
          <Receipt aria-hidden /> Faire la facture
        </Button>
      )}
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
