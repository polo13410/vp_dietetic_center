import { AlertTriangle, CalendarCheck, Download, FilePen, MoreHorizontal, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatAmount } from '../../lib/invoice-document';
import {
  countsInTotals,
  downloadInvoicePdf,
  invoiceFilename,
  linksText,
  type PayerInvoiceListItemDto,
  payerMismatchText,
  periodText,
  useCorrectInvoice,
  useSetPayerInvoicePaid,
} from '../../lib/invoices';
import { cn, formatLongDate, todayISO } from '../../lib/utils';
import { fieldClass } from '../patient-file/LifeEventForm';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { toast } from '../ui/toaster';

import { CancelInvoiceDialog } from './CancelInvoiceDialog';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

type Action = { kind: 'paid' | 'correct' | 'cancel'; invoice: PayerInvoiceListItemDto } | null;

/**
 * The payers' invoices and their credit notes, latest first: « en attente » until « réglée le
 * … » is set. An invoice whose sessions changed since says so, with « Corriger la facture ».
 */
export function PayerInvoicesTable({ invoices }: { invoices: PayerInvoiceListItemDto[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const close = () => setAction(null);

  const download = async (invoice: PayerInvoiceListItemDto) => {
    setPending(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[46rem] text-base">
          <thead className="bg-muted text-left text-sm text-muted-foreground">
            <tr>
              {['N°', 'Date', 'Organisme', 'Période', 'Montant', 'Statut'].map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn('whitespace-nowrap px-3 py-3 font-medium', i === 0 && 'pl-5', c === 'Montant' && 'text-right')}
                >
                  {c}
                </th>
              ))}
              <th scope="col" className="w-28 pr-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const counted = countsInTotals(invoice);
              const struck = !counted && 'line-through decoration-1';
              return (
                <tr key={invoice.id} className={cn('border-t align-top', !counted && 'text-muted-foreground')}>
                  <td className="min-w-[12rem] py-3 pl-5 pr-3">
                    <span className={cn('whitespace-nowrap font-medium', struck)}>{invoice.number}</span>
                    {linksText(invoice).map((line) => (
                      <span key={line} className="block text-sm">
                        {line}
                      </span>
                    ))}
                    {invoice.mismatches && (
                      <button
                        type="button"
                        onClick={() => setAction({ kind: 'correct', invoice })}
                        className="mt-1 flex min-h-11 items-start gap-1.5 text-left text-sm font-medium text-warning underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        Ne correspond plus aux séances : {payerMismatchText(invoice.mismatches)}. Corriger
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{formatLongDate(invoice.issuedAt, true)}</td>
                  <td className="px-3 py-3">{invoice.payerName}</td>
                  <td className="px-3 py-3">
                    {invoice.periodStart && invoice.periodEnd ? periodText(invoice.periodStart, invoice.periodEnd) : '—'}
                    <span className="block text-sm text-muted-foreground">
                      {invoice._count.lines} séance{invoice._count.lines > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <span className={cn('tabular-nums', struck)}>{formatAmount(invoice.amountCents)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <InvoiceStatusBadge invoice={invoice} />
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Télécharger ${invoiceFilename(invoice)}`}
                        onClick={() => download(invoice)}
                        disabled={pending === invoice.id}
                      >
                        <Download aria-hidden />
                      </Button>
                      {counted && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions de la facture n° ${invoice.number}`}>
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setAction({ kind: 'paid', invoice })}>
                              <CalendarCheck aria-hidden /> {invoice.paidAt ? 'Changer la date de règlement' : 'Indiquer le règlement'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setAction({ kind: 'correct', invoice })}>
                              <FilePen aria-hidden /> Corriger la facture
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setAction({ kind: 'cancel', invoice })}>
                              <Undo2 aria-hidden /> Annuler la facture
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {action?.kind === 'paid' && <PaidDialog invoice={action.invoice} onClose={close} />}
      {action?.kind === 'correct' && <CorrectDialog invoice={action.invoice} onClose={close} />}
      {action?.kind === 'cancel' && (
        <CancelInvoiceDialog invoice={action.invoice} open onOpenChange={(open) => !open && close()} />
      )}
    </>
  );
}

/** « Réglée le … »: the day the payer paid (today by default), or back « en attente ». */
function PaidDialog({ invoice, onClose }: { invoice: PayerInvoiceListItemDto; onClose: () => void }) {
  const setPaid = useSetPayerInvoicePaid();
  const [day, setDay] = useState(invoice.paidAt?.slice(0, 10) ?? todayISO());
  const issuedOn = invoice.issuedAt.slice(0, 10);

  const run = (paidOn: string | null) =>
    setPaid.mutate(
      { id: invoice.id, paidOn },
      {
        onSuccess: () => {
          toast({ title: paidOn ? `Facture n° ${invoice.number} réglée` : `Facture n° ${invoice.number} de nouveau en attente` });
          onClose();
        },
        onError: (error) =>
          toast({ title: apiErrorMessage(error, 'Le règlement n’a pas pu être enregistré. Réessayez.'), variant: 'destructive' }),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Règlement de la facture n° {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.payerName} · {formatAmount(invoice.amountCents)}
          </DialogDescription>
        </DialogHeader>
        <Field label="Réglée le">
          <input type="date" className={fieldClass} value={day} min={issuedOn} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <DialogFooter>
          {invoice.paidAt && (
            <Button variant="ghost" onClick={() => run(null)} disabled={setPaid.isPending}>
              Remettre en attente
            </Button>
          )}
          <Button onClick={() => run(day)} disabled={!day || day < issuedOn || setPaid.isPending}>
            <CalendarCheck aria-hidden /> Enregistrer le règlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** « Corriger la facture »: a credit note, then a new invoice over the same period. */
function CorrectDialog({ invoice, onClose }: { invoice: PayerInvoiceListItemDto; onClose: () => void }) {
  const correct = useCorrectInvoice();
  const run = () =>
    correct.mutate(invoice.id, {
      onSuccess: (replacement) => {
        toast({ title: `Facture n° ${replacement.number} faite`, description: `Elle remplace la n° ${invoice.number}.` });
        onClose();
      },
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être corrigée. Réessayez.'), variant: 'destructive' }),
    });
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Corriger la facture n° ${invoice.number} ?`}
      description={`Un avoir l’annule et une nouvelle facture est faite pour ${invoice.payerName ?? 'l’organisme'}, sur la même période, avec les séances telles qu’elles sont maintenant. Les deux restent dans vos factures.`}
      confirmLabel="Corriger la facture"
      cancelLabel="Ne rien changer"
      loading={correct.isPending}
      onConfirm={run}
    />
  );
}
