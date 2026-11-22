import { ChevronLeft, ChevronRight, FileSpreadsheet, ListOrdered, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { InvoicesTable } from '../../components/invoices/InvoicesTable';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { formatAmount } from '../../lib/invoice-document';
import {
  currentPeriod,
  downloadInvoicesCsv,
  type InvoiceListDto,
  monthLabel,
  type Period,
  type PeriodKind,
  periodLabel,
  periodRange,
  shiftPeriod,
  useInvoiceList,
} from '../../lib/invoices';
import { PAYMENT_METHODS, type PaymentMethod } from '../../lib/patient-file';
import { cn } from '../../lib/utils';

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];

const PAID_METHODS: Exclude<PaymentMethod, 'NONE'>[] = ['CASH', 'CHECK', 'CARD', 'TRANSFER'];

/** The period shown, kept in the address so a reload (or a bookmark) shows the same one. */
function usePeriod(): [Period, (period: Period) => void] {
  const [params, setParams] = useSearchParams();
  const kind = (KINDS.find((k) => k.value === params.get('periode'))?.value ?? 'month') as PeriodKind;
  const fallback = currentPeriod(kind);
  const year = Number(params.get('annee')) || fallback.year;
  const index = params.has('n') ? Number(params.get('n')) : fallback.index;
  const period = { kind, year, index: Number.isInteger(index) && index >= 0 ? index : fallback.index };
  const set = (next: Period) =>
    setParams({ periode: next.kind, annee: String(next.year), n: String(next.index) }, { replace: true });
  return [period, set];
}

/**
 * « Factures »: what was invoiced and collected over a month, a quarter or a year, by payment
 * method, and the export for the accountant. Cancelled invoices and credit notes are listed,
 * struck through, but not counted.
 */
export default function InvoicesPage() {
  const [period, setPeriod] = usePeriod();
  const range = periodRange(period);
  const { data, isLoading } = useInvoiceList(range);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadInvoicesCsv(range);
    } catch {
      toast({ title: 'L’export n’a pas pu être préparé. Réessayez.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        area="invoices"
        title="Factures"
        subtitle="Ce que vous avez facturé et encaissé, et l’export pour votre comptable."
        actions={
          <Button onClick={exportCsv} disabled={exporting || !data || data.invoices.length === 0}>
            <FileSpreadsheet aria-hidden /> Exporter pour le comptable
          </Button>
        }
      />

      <div className="space-y-6">
      <PeriodBar period={period} onChange={setPeriod} />

      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <>
          <Totals totals={data.totals} />
          {period.kind !== 'month' && data.totals.byMonth.length > 1 && <ByMonth totals={data.totals} />}
          <Section
            icon={Receipt}
            area="invoices"
            title="Factures et avoirs"
            description={`${data.invoices.length} document${data.invoices.length > 1 ? 's' : ''} · ${periodLabel(period)}`}
            flush
          >
            {data.invoices.length === 0 ? (
              <EmptyState
                illustration="pear-calm"
                title={`Aucune facture en ${periodLabel(period)}`}
                description="Les factures se font depuis la séance, avec « Faire la facture »."
              />
            ) : (
              <InvoicesTable invoices={data.invoices} showPatient />
            )}
          </Section>
        </>
      )}
      </div>
    </div>
  );
}

function PeriodBar({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const now = currentPeriod(period.kind);
  const isCurrent = now.year === period.year && now.index === period.index;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <SegmentedControl
        label="Période"
        options={KINDS}
        value={period.kind}
        onChange={(kind) => onChange(currentPeriod(kind))}
      />
      <div className="flex flex-1 items-center justify-center gap-1 sm:justify-start">
        <Button variant="ghost" size="icon" aria-label="Période précédente" onClick={() => onChange(shiftPeriod(period, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <p className="min-w-[12rem] text-center text-xl font-semibold first-letter:uppercase" aria-live="polite">
          {periodLabel(period)}
        </p>
        <Button variant="ghost" size="icon" aria-label="Période suivante" onClick={() => onChange(shiftPeriod(period, 1))}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      {!isCurrent && (
        <Button variant="outline" onClick={() => onChange(now)}>
          Revenir à aujourd’hui
        </Button>
      )}
    </div>
  );
}

function Totals({ totals }: { totals: InvoiceListDto['totals'] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:col-span-2">
        <p className="text-base text-muted-foreground">Encaissé</p>
        <p className="text-3xl font-semibold tabular-nums">{formatAmount(totals.collectedCents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.count} facture{totals.count > 1 ? 's' : ''} en vigueur
        </p>
      </div>
      {PAID_METHODS.map((method) => (
        <Tile key={method} label={PAYMENT_METHODS[method]} cents={totals.byPaymentMethod[method]} />
      ))}
      {totals.unpaidCents > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-warning sm:col-span-2 lg:col-span-6">
          <p className="text-base font-medium">
            Non réglé : {formatAmount(totals.unpaidCents)} — pas compté dans l’encaissé.
          </p>
        </div>
      )}
    </div>
  );
}

function Tile({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums', cents === 0 && 'text-muted-foreground')}>
        {formatAmount(cents)}
      </p>
    </div>
  );
}

function ByMonth({ totals }: { totals: InvoiceListDto['totals'] }) {
  return (
    <Section icon={ListOrdered} area="invoices" title="Par mois" flush>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[32rem] text-base">
          <thead className="bg-muted text-left text-sm text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3 pl-5 font-medium">
                Mois
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Encaissé
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Non réglé
              </th>
              <th scope="col" className="px-3 py-3 pr-5 text-right font-medium">
                Factures
              </th>
            </tr>
          </thead>
          <tbody>
            {totals.byMonth.map((m) => (
              <tr key={m.month} className="h-14 border-t">
                <td className="px-3 py-2 pl-5 first-letter:uppercase">{monthLabel(m.month)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatAmount(m.collectedCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatAmount(m.unpaidCents)}</td>
                <td className="px-3 py-2 pr-5 text-right tabular-nums">{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
