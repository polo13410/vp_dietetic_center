import { type InvoiceDto, invoiceStatus } from '../../lib/invoices';
import { StatusBadge } from '../shared/StatusBadge';

/** « Acquittée », « Non réglée », « Annulée » or « Avoir ». */
export function InvoiceStatusBadge({ invoice, className }: { invoice: InvoiceDto; className?: string }) {
  const { label, tone } = invoiceStatus(invoice);
  return <StatusBadge status={label} label={label} tone={tone} className={className} />;
}
