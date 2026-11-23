import { ChevronLeft, ChevronRight, FileSpreadsheet, ListOrdered, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { InvoicesTable } from '../../components/invoices/InvoicesTable';
import { PayersPanel } from '../../components/invoices/PayersPanel';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from '../../components/ui/toaster';
import { formatAmount } from '../../lib/invoice-document';
import {
  currentPeriod,
  downloadInvoicesCsv,
  type InvoiceListDto,
  isPayerInvoice,
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

type View = 'patients' | 'organismes';

/** The tab shown, kept in the address (« ?vue=organismes »). */
function useView(): [View, (view: string) => void] {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vue') === 'organismes' ? 'organismes' : 'patients';
  const set = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'organismes') p.set('vue', 'organismes');
        else p.delete('vue');
        return p;
      },
      { replace: true },
    );
  return [view, set];
}

/**
 * « Factures », in two tabs. « Factures patients »: what was invoiced and collected over a month,
 * a quarter or a year, by patients and by payers, by payment method, and the export for the
 * accountant; cancelled invoices and credit notes are listed, struck through, but not counted.
 * « Organismes »: the payers, their next period to bill, their invoices and their payment
 * (docs/REFONTE.md lot 16).
 */
export default function InvoicesPage() {
  const [view, setView] = useView();
  return (
    <div>
      <PageHeader
        area="invoices"
        title="Factures"
        subtitle="Ce que vous avez facturé et encaissé, et l’export pour votre comptable."
      />
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="patients">Factures patients</TabsTrigger>
          <TabsTrigger value="organismes">Organismes</TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="mt-4">
          <PatientInvoicesView />
        </TabsContent>
        <TabsContent value="organismes" className="mt-4">
          <PayersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatientInvoicesView() {
  const [period, setPeriod] = usePeriod();
  const range = periodRange(period);
  const { data, isLoading } = useInvoiceList(range);
  const [exporting, setExporting] = useState(false);
  const patientInvoices = data?.invoices.filter((invoice) => !isPayerInvoice(invoice)) ?? [];

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-stretch gap-3">
        <PeriodBar period={period} onChange={setPeriod} />
        <Button
          className="h-auto min-h-11 self-center"
          onClick={exportCsv}
          disabled={exporting || !data || data.invoices.length === 0}
        >
          <FileSpreadsheet aria-hidden /> Exporter pour le comptable
        </Button>
      </div>

      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <>
          <Totals totals={data.totals} />
          {period.kind !== 'month' && data.totals.byMonth.length > 1 && <ByMonth totals={data.totals} />}
          <Section
            icon={Receipt}
            area="invoices"
            title="Factures et avoirs des patients"
            description={`${patientInvoices.length} document${patientInvoices.length > 1 ? 's' : ''} · ${periodLabel(period)}`}
            flush
          >
            {patientInvoices.length === 0 ? (
              <EmptyState
                illustration="pear-calm"
                title={`Aucune facture patient en ${periodLabel(period)}`}
                description="Les factures se font depuis la séance, avec « Faire la facture »."
              />
            ) : (
              <InvoicesTable invoices={patientInvoices} showPatient />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function PeriodBar({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const now = currentPeriod(period.kind);
  const isCurrent = now.year === period.year && now.index === period.index;
  return (
    <div className="flex flex-1 flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
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
  const { patients, payers } = totals;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:col-span-2">
        <p className="text-base text-muted-foreground">Encaissé</p>
        <p className="text-3xl font-semibold tabular-nums">{formatAmount(totals.collectedCents)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {totals.count} facture{totals.count > 1 ? 's' : ''} en vigueur
          {payers.count > 0 &&
            ` · patients ${formatAmount(patients.collectedCents)}, organismes ${formatAmount(payers.collectedCents)}`}
        </p>
      </div>
      {PAID_METHODS.map((method) => (
        <Tile key={method} label={PAYMENT_METHODS[method]} cents={totals.byPaymentMethod[method]} />
      ))}
      {payers.count > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-6">
          <p className="text-sm text-muted-foreground">Facturé aux organismes</p>
          <p className="text-base">
            <span className="text-xl font-semibold tabular-nums">{formatAmount(payers.invoicedCents)}</span>
            <span className="text-muted-foreground">
              {' '}
              · {payers.count} facture{payers.count > 1 ? 's' : ''} · réglé {formatAmount(payers.collectedCents)}
              {payers.unpaidCents > 0 && `, en attente ${formatAmount(payers.unpaidCents)}`}
            </span>
          </p>
        </div>
      )}
      {totals.unpaidCents > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-warning sm:col-span-2 lg:col-span-6">
          <p className="text-base font-medium">
            {patients.unpaidCents > 0 && `Non réglé par les patients : ${formatAmount(patients.unpaidCents)}`}
            {patients.unpaidCents > 0 && payers.unpaidCents > 0 && ' · '}
            {payers.unpaidCents > 0 &&
              `${patients.unpaidCents > 0 ? 'e' : 'E'}n attente des organismes : ${formatAmount(payers.unpaidCents)}`}
            {' — pas compté dans l’encaissé.'}
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
                dont organismes
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
                <td className="px-3 py-2 text-right tabular-nums">{formatAmount(m.payers.collectedCents)}</td>
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
