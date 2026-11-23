import { Receipt } from 'lucide-react';

import { formatAmount } from '../../lib/invoice-document';
import { usePatientInvoices } from '../../lib/invoices';
import { EmptyState } from '../shared/EmptyState';
import { Section } from '../shared/Section';
import { LoadingSpinner } from '../ui/loading-screen';

import { InvoicesTable } from './InvoicesTable';
import { PatientCoverages } from './PatientCoverages';

/**
 * The « Factures » tab of the patient file: their coverage by a payer (lot 16), then their
 * invoices, latest first, and the total.
 */
export function PatientInvoices({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientInvoices(patientId);
  if (isLoading) return <LoadingSpinner />;
  const invoices = data?.invoices ?? [];
  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <PatientCoverages patientId={patientId} />
      <Section
        icon={Receipt}
        area="invoices"
        title="Factures"
        description={
          totals && totals.count > 0
            ? [
                `Réglé : ${formatAmount(totals.collectedCents)}`,
                totals.unpaidCents > 0 && `Non réglé : ${formatAmount(totals.unpaidCents)}`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        flush
      >
        {invoices.length === 0 ? (
          <EmptyState
            illustration="pear-calm"
            title="Aucune facture pour l’instant"
            description="Les factures se font depuis la séance, avec « Faire la facture »."
          />
        ) : (
          <InvoicesTable invoices={invoices} />
        )}
      </Section>
    </div>
  );
}
