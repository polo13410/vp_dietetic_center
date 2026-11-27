import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import { type InvoiceDto, invoiceFilename, invoicePdf } from '../../lib/invoices';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

export function InvoicePreviewButton({ invoice, showLabel = false }: {
  invoice: Pick<InvoiceDto, 'id' | 'type' | 'number'>;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={showLabel ? 'outline' : 'ghost'} size={showLabel ? 'default' : 'icon'}
          aria-label={`Voir ${invoiceFilename(invoice)}`} title="Voir dans le navigateur">
          <Eye aria-hidden />{showLabel && 'Voir la facture'}
        </Button>
      </DialogTrigger>
      {open && (
        <DialogContent className="flex h-[90dvh] w-[95vw] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>{invoice.type === 'CREDIT_NOTE' ? 'Avoir' : 'Facture'} n° {invoice.number}</DialogTitle>
          </DialogHeader>
          <PdfPreview key={invoice.id} id={invoice.id} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function PdfPreview({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void invoicePdf(id, 'preview', controller.signal).then(({ blob }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (failed) return <p role="alert">Impossible d’afficher le PDF. Rouvrez l’aperçu pour réessayer.</p>;
  if (!url) return <p role="status">Préparation du PDF…</p>;
  return <iframe title="Aperçu du PDF" src={url} referrerPolicy="no-referrer" className="min-h-0 flex-1 rounded-lg border" />;
}
