import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { formatAmount } from '../../lib/invoice-document';
import {
  countsInTotals,
  downloadInvoicePdf,
  type InvoiceDto,
  invoiceFilename,
  linksText,
  recipientName,
} from '../../lib/invoices';
import { PAYMENT_METHODS } from '../../lib/patient-file';
import { cn, formatLongDate } from '../../lib/utils';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

import { InvoicePreviewButton } from './InvoicePreviewButton';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

/**
 * Invoices and credit notes, one per row. Cancelled invoices and credit notes are struck through
 * with their links (« Annulée par l’avoir n° … »): they are not counted in the totals.
 */
export function InvoicesTable({ invoices, showPatient = false }: { invoices: InvoiceDto[]; showPatient?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const download = async (invoice: InvoiceDto) => {
    setPending(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setPending(null);
    }
  };

  const columns = ['N°', 'Date', ...(showPatient ? ['Patient'] : []), 'Prestation', 'Montant', 'Statut'];

  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full min-w-[44rem] text-base">
        <thead className="bg-muted text-left text-sm text-muted-foreground">
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={cn('whitespace-nowrap px-3 py-3 font-medium', i === 0 && 'pl-5', c === 'Montant' && 'text-right')}
              >
                {c}
              </th>
            ))}
            <th scope="col" className="w-24 pr-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const counted = countsInTotals(invoice);
            const struck = !counted && 'line-through decoration-1';
            const links = linksText(invoice);
            return (
              <tr key={invoice.id} className={cn('h-14 border-t align-top', !counted && 'text-muted-foreground')}>
                <td className="min-w-[14rem] py-3 pl-5 pr-3">
                  <span className={cn('whitespace-nowrap font-medium', struck)}>{invoice.number}</span>
                  {links.map((line) => (
                    <span key={line} className="block text-sm">
                      {line}
                    </span>
                  ))}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{formatLongDate(invoice.issuedAt, true)}</td>
                {showPatient && (
                  <td className="whitespace-nowrap px-3 py-3">
                    {invoice.patientId ? (
                      <Link
                        to={`/patients/${invoice.patientId}?onglet=factures`}
                        className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {recipientName(invoice)}
                      </Link>
                    ) : (
                      recipientName(invoice)
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  {invoice.serviceLabel}
                  <span className="block whitespace-nowrap text-sm text-muted-foreground">
                    séance du {formatLongDate(invoice.serviceDate, true)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <span className={cn('tabular-nums', struck)}>{formatAmount(invoice.amountCents)}</span>
                  <span className="block text-sm text-muted-foreground">{PAYMENT_METHODS[invoice.paymentMethod]}</span>
                  {!!invoice.payerCents && invoice.payerCents > 0 && (
                    <span className="block min-w-[9rem] whitespace-normal text-sm text-muted-foreground">
                      + {formatAmount(invoice.payerCents)} {invoice.payerName ?? 'organisme'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <InvoiceStatusBadge invoice={invoice} />
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3">
                  <InvoicePreviewButton invoice={invoice} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Télécharger ${invoiceFilename(invoice)}`}
                    onClick={() => download(invoice)}
                    disabled={pending === invoice.id}
                  >
                    <Download aria-hidden />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
