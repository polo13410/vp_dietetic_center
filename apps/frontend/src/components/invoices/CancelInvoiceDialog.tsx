import { useState } from 'react';

import { apiErrorMessage } from '../../hooks/useMe';
import { type InvoiceDto, useCancelInvoice } from '../../lib/invoices';
import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { toast } from '../ui/toaster';

/** « Annuler la facture »: a credit note cancels it, with an optional reason. */
export function CancelInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelInvoice();
  const [reason, setReason] = useState('');

  const run = () =>
    cancel.mutate(
      { id: invoice.id, reason },
      {
        onSuccess: (creditNote) => {
          onOpenChange(false);
          setReason('');
          toast({ title: `Facture n° ${invoice.number} annulée`, description: `Avoir n° ${creditNote.number}.` });
        },
        onError: (error) =>
          toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être annulée. Réessayez.'), variant: 'destructive' }),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Annuler la facture n° {invoice.number} ?</DialogTitle>
          <DialogDescription>
            Un avoir est fait pour l’annuler ; la facture et l’avoir restent dans vos factures.{' '}
            {invoice.recipient === 'PAYER'
              ? 'Ses séances pourront être facturées à nouveau à l’organisme.'
              : 'La séance n’aura plus de facture.'}
          </DialogDescription>
        </DialogHeader>
        <Field
          label="Motif"
          hint={invoice.recipient === 'PAYER' ? 'Facultatif, par exemple « erreur de période ».' : 'Facultatif, par exemple « séance offerte ».'}
        >
          <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending}>
            Garder la facture
          </Button>
          <Button variant="destructive" onClick={run} disabled={cancel.isPending}>
            Annuler la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
