import { Download, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatAmount } from '../../lib/invoice-document';
import {
  downloadInvoicePdf,
  type InvoiceDto,
  type PayerOverviewDto,
  periodText,
  useIssuePayerInvoice,
  usePayerPreview,
} from '../../lib/invoices';
import { formatLongDate } from '../../lib/utils';
import { InvoicePreviewButton } from '../invoices/InvoicePreviewButton';
import { DatePicker } from '../shared/DatePicker';
import { EmptyState } from '../shared/EmptyState';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { LoadingSpinner } from '../ui/loading-screen';
import { toast } from '../ui/toaster';

/**
 * « Préparer la facture » of a payer: the period its rhythm proposes (both dates can be
 * changed), the sessions it includes (date, patient, service, covered amount: nothing medical),
 * then « Émettre la facture ». Once issued, it offers the PDF.
 */
export function PrepareInvoiceDialog({
  payer,
  open,
  onOpenChange,
}: {
  payer: PayerOverviewDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [from, setFrom] = useState(payer.nextPeriod.from);
  const [to, setTo] = useState(payer.nextPeriod.to);
  const [issued, setIssued] = useState<InvoiceDto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const valid = !!from && !!to && from <= to;
  const { data, isLoading } = usePayerPreview(open && !issued ? payer.id : undefined, valid ? { from, to } : null);
  const issue = useIssuePayerInvoice();

  useEffect(() => {
    if (open) {
      setFrom(payer.nextPeriod.from);
      setTo(payer.nextPeriod.to);
      setIssued(null);
    }
  }, [open, payer.nextPeriod.from, payer.nextPeriod.to]);

  const run = () =>
    issue.mutate(
      { payerId: payer.id, from, to },
      {
        onSuccess: (invoice) => {
          setIssued(invoice);
          toast({ title: `Facture n° ${invoice.number} faite pour ${payer.name}` });
        },
        onError: (error) =>
          toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être faite. Réessayez.'), variant: 'destructive' }),
      },
    );

  const download = async () => {
    if (!issued) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(issued.id);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const sessions = data?.sessions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Facture de {payer.name}</DialogTitle>
          <DialogDescription>
            {issued
              ? `La facture n° ${issued.number} est faite : ${formatAmount(issued.amountCents)}, en attente de règlement.`
              : 'Les séances de la période qu’il prend en charge et qui ne sont pas encore facturées.'}
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-soft px-4 py-3">
            <p className="text-base text-success">
              {periodText(from, to)} · {issued.lines?.length ?? sessions.length} séance
              {(issued.lines?.length ?? sessions.length) > 1 ? 's' : ''}
            </p>
            <InvoicePreviewButton invoice={issued} showLabel />
            <Button variant="outline" onClick={download} disabled={downloading}>
              <Download aria-hidden /> Télécharger la facture
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Du">
                <DatePicker value={from} max={to} onChange={setFrom} />
              </Field>
              <Field label="Au" error={from && to && from > to ? 'La fin est avant le début.' : undefined}>
                <DatePicker value={to} min={from} onChange={setTo} />
              </Field>
            </div>

            {!valid ? null : isLoading ? (
              <LoadingSpinner />
            ) : sessions.length === 0 ? (
              <EmptyState
                illustration="pear-calm"
                className="py-6"
                title="Aucune séance à facturer sur cette période"
                description="Seules les séances prises en charge par cet organisme, et pas encore sur une de ses factures, apparaissent ici."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[30rem] text-base">
                  <caption className="sr-only">Séances de la facture</caption>
                  <thead className="bg-muted text-left text-sm text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 pl-4 font-medium">
                        Date
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Patient
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Prestation
                      </th>
                      <th scope="col" className="px-3 py-2 pr-4 text-right font-medium">
                        Pris en charge
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2.5 pl-4">{formatLongDate(s.date, true)}</td>
                        <td className="px-3 py-2.5">
                          {s.patient.firstName} {s.patient.lastName}
                          {s.coverage?.coverageNumber && (
                            <span className="block text-sm text-muted-foreground">N° {s.coverage.coverageNumber}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{s.formulaLabel ?? 'Séance'}</td>
                        <td className="px-3 py-2.5 pr-4 text-right tabular-nums">{formatAmount(s.payerCents ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td className="px-3 py-3 pl-4" colSpan={3}>
                        Total · {sessions.length} séance{sessions.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-3 pr-4 text-right tabular-nums">{formatAmount(data?.totalCents ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {issued ? (
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={issue.isPending}>
                Plus tard
              </Button>
              <Button onClick={run} disabled={!valid || sessions.length === 0 || issue.isPending}>
                <Receipt aria-hidden /> Émettre la facture
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
