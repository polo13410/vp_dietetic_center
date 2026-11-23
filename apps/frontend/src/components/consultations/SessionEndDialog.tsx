import { CalendarPlus, Check, Download, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatAmount } from '../../lib/invoice-document';
import { downloadInvoicePdf, patientBilling, useIssueInvoice, useSessionInvoices } from '../../lib/invoices';
import { sessionName, useConsultation } from '../../lib/patient-file';
import { AppointmentFormDialog } from '../appointments/AppointmentFormDialog';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../ui/toaster';

import { endedSession } from './session-route';

/**
 * After « Terminer la séance », on the patient's file: the two natural next steps, « Faire la
 * facture » and « Prendre le prochain rendez-vous ». Shown once (the route state is cleared).
 */
export function SessionEndDialog({ patientId }: { patientId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionId] = useState(() => endedSession(location.state));
  const [open, setOpen] = useState(!!sessionId);
  const [booking, setBooking] = useState(false);
  const bookingDefaults = useMemo(() => ({ patientId }), [patientId]);

  const close = () => {
    setOpen(false);
    // A reload or « back » does not bring the window again
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  };

  if (!sessionId) return null;
  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-md">
          <EndChoices
            sessionId={sessionId}
            onBook={() => {
              close();
              setBooking(true);
            }}
            onClose={close}
          />
        </DialogContent>
      </Dialog>
      <AppointmentFormDialog open={booking} onOpenChange={setBooking} defaultValues={bookingDefaults} />
    </>
  );
}

function EndChoices({ sessionId, onBook, onClose }: { sessionId: string; onBook: () => void; onClose: () => void }) {
  const { data: session } = useConsultation(sessionId);
  const { data: invoices, isLoading } = useSessionInvoices(sessionId);
  const issue = useIssueInvoice();
  const [downloading, setDownloading] = useState(false);
  const invoice = invoices?.current ?? null;
  const billing = session ? patientBilling(session) : null;
  const ready = billing?.state === 'ready';
  // A free séance, or one the payer pays in full, has no patient invoice
  const noInvoice = billing?.state === 'free' || billing?.state === 'payer';

  const makeInvoice = () =>
    issue.mutate(sessionId, {
      onSuccess: (made) => toast({ title: `Facture n° ${made.number} faite` }),
      onError: (error) =>
        toast({ title: apiErrorMessage(error, 'La facture n’a pas pu être faite. Réessayez.'), variant: 'destructive' }),
    });
  const download = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Check className="size-6 text-success" aria-hidden /> Séance terminée
        </DialogTitle>
        <DialogDescription>
          {session
            ? `${sessionName(session.sequence)} de ${session.patient?.firstName ?? ''} ${session.patient?.lastName ?? ''} : tout est enregistré.`
            : 'Tout est enregistré.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {invoice ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-soft px-4 py-3">
            <p className="text-base text-success">
              Facture n° {invoice.number} faite ({formatAmount(invoice.amountCents)}).
            </p>
            <Button variant="outline" onClick={download} disabled={downloading}>
              <Download aria-hidden /> Télécharger la facture
            </Button>
          </div>
        ) : noInvoice ? (
          <p className="rounded-lg bg-muted px-4 py-3 text-base">
            {billing?.state === 'free'
              ? 'Séance offerte : pas de facture à faire.'
              : `Prise en charge en totalité par ${session?.payer?.name ?? 'l’organisme'} : pas de facture au patient.`}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Button
              size="lg"
              className="w-full justify-start"
              onClick={makeInvoice}
              disabled={isLoading || !session || !ready || issue.isPending}
            >
              <Receipt aria-hidden /> Faire la facture
              {ready && <span className="ml-auto text-base font-normal">{formatAmount(billing.cents)}</span>}
            </Button>
            {session && !ready && (
              <p className="text-sm text-muted-foreground">
                Choisissez d’abord la formule de la séance (avec son prix) :{' '}
                <Link to={`/consultations/${sessionId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  revenir à la séance
                </Link>
                .
              </p>
            )}
          </div>
        )}
        <Button
          size="lg"
          variant={invoice || noInvoice ? 'default' : 'outline'}
          className="w-full justify-start"
          onClick={onBook}
        >
          <CalendarPlus aria-hidden /> Prendre le prochain rendez-vous
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </>
  );
}
