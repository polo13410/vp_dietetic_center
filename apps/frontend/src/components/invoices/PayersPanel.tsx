import { Archive, ArchiveRestore, Building2, CalendarClock, Pencil, Plus, Receipt, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { apiErrorMessage } from '../../hooks/useMe';
import { formatAmount } from '../../lib/invoice-document';
import {
  type PayerOverviewDto,
  periodText,
  rhythmLabel,
  usePayerInvoices,
  usePayers,
  useSavePayer,
} from '../../lib/invoices';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-screen';
import { toast } from '../ui/toaster';

import { PayerFormDialog } from './PayerFormDialog';
import { PayerInvoicesTable } from './PayerInvoicesTable';
import { PrepareInvoiceDialog } from './PrepareInvoiceDialog';

/** The address parameter that opens « Préparer la facture » of a payer (from the dashboard). */
export const PREPARE_PARAM = 'preparer';

/**
 * « Organismes » (docs/REFONTE.md lot 16): the payers, each with its next period to bill from its
 * rhythm and « Préparer la facture », then their invoices and the follow-up of their payment.
 */
export function PayersPanel() {
  const { data: payers, isLoading } = usePayers();
  const { data: invoices } = usePayerInvoices();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<PayerOverviewDto | null | undefined>(undefined);
  const [preparing, setPreparing] = useState<PayerOverviewDto | null>(null);
  const [archiving, setArchiving] = useState<PayerOverviewDto | null>(null);
  const save = useSavePayer();

  // « Préparer la facture » asked from the dashboard
  const requested = params.get(PREPARE_PARAM);
  useEffect(() => {
    if (!requested || !payers) return;
    const payer = payers.find((p) => p.id === requested);
    if (payer) setPreparing(payer);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PREPARE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [requested, payers, setParams]);

  if (isLoading || !payers) return <LoadingSpinner />;
  const active = payers.filter((p) => !p.archivedAt);
  const archived = payers.filter((p) => p.archivedAt);

  const setArchived = (payer: PayerOverviewDto, value: boolean) =>
    save.mutate(
      { id: payer.id, archived: value },
      {
        onSuccess: () => {
          setArchiving(null);
          toast({ title: value ? `${payer.name} archivé` : `${payer.name} proposé à nouveau` });
        },
        onError: (error) => toast({ title: apiErrorMessage(error, 'Réessayez.'), variant: 'destructive' }),
      },
    );

  return (
    <div className="space-y-6">
      <Section
        icon={Building2}
        area="invoices"
        title="Organismes"
        description="Mutuelles, employeurs, associations, conventions : ce qu’ils prennent en charge est facturé par période."
        action={
          <Button onClick={() => setEditing(null)}>
            <Plus aria-hidden /> Ajouter un organisme
          </Button>
        }
      >
        {active.length === 0 ? (
          <EmptyState
            icon={Building2}
            area="invoices"
            className="py-6"
            title="Aucun organisme pour l’instant"
            description="Ajoutez la mutuelle ou l’association d’un patient, puis indiquez sa prise en charge dans l’onglet Factures de sa fiche."
            action={
              <Button onClick={() => setEditing(null)}>
                <Plus aria-hidden /> Ajouter un organisme
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {active.map((payer) => (
              <PayerCard
                key={payer.id}
                payer={payer}
                onEdit={() => setEditing(payer)}
                onPrepare={() => setPreparing(payer)}
                onArchive={() => setArchiving(payer)}
              />
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <div className="mt-5 space-y-2 border-t pt-4">
            <h3 className="text-base font-medium text-muted-foreground">Archivés</h3>
            <ul className="divide-y">
              {archived.map((payer) => (
                <li key={payer.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-base text-muted-foreground">{payer.name}</span>
                  <Button variant="ghost" onClick={() => setArchived(payer, false)} disabled={save.isPending}>
                    <ArchiveRestore aria-hidden /> Proposer à nouveau
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section
        icon={Receipt}
        area="invoices"
        title="Factures des organismes"
        description="En attente jusqu’à ce que vous indiquiez la date du règlement."
        flush
      >
        {!invoices?.length ? (
          <EmptyState
            illustration="pear-calm"
            title="Aucune facture d’organisme pour l’instant"
            description="Elles se font ici, avec « Préparer la facture »."
          />
        ) : (
          <PayerInvoicesTable invoices={invoices} />
        )}
      </Section>

      <PayerFormDialog
        payer={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
      />
      {preparing && (
        <PrepareInvoiceDialog payer={preparing} open onOpenChange={(open) => !open && setPreparing(null)} />
      )}
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archiver ${archiving?.name ?? 'cet organisme'} ?`}
        description="Il ne sera plus proposé pour une nouvelle prise en charge, et ses prises en charge ne s’appliqueront plus aux nouvelles séances. Ses factures restent, et vous pourrez le proposer à nouveau."
        confirmLabel="Archiver"
        loading={save.isPending}
        onConfirm={() => archiving && setArchived(archiving, true)}
      />
    </div>
  );
}

function PayerCard({
  payer,
  onEdit,
  onPrepare,
  onArchive,
}: {
  payer: PayerOverviewDto;
  onEdit: () => void;
  onPrepare: () => void;
  onArchive: () => void;
}) {
  const { nextPeriod: period } = payer;
  const due = period.ended && period.sessionCount > 0;
  const place = [payer.zipCode, payer.city].filter(Boolean).join(' ');

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{payer.name}</h3>
          <p className="text-sm text-muted-foreground">
            {[place, `facturé ${rhythmLabel(payer)}`, payer.conventionReference && `convention ${payer.conventionReference}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {payer._count.coverages === 0
              ? 'Aucun patient pris en charge'
              : `${payer._count.coverages} prise${payer._count.coverages > 1 ? 's' : ''} en charge`}
          </p>
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon" aria-label={`Modifier ${payer.name}`} onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Archiver ${payer.name}`} onClick={onArchive}>
            <Archive aria-hidden />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3',
          due ? 'border border-warning/30 bg-warning-soft' : 'bg-muted',
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium">
            <CalendarClock className="size-5 text-area-invoices" aria-hidden />
            {payer.billingRhythm === 'ON_DEMAND' ? 'À facturer' : 'Prochaine période'} : {periodText(period.from, period.to)}
            {due && <StatusBadge status="PAYER_PERIOD_DUE" tone="warning" label="Terminée, à facturer" />}
          </p>
          <p className="text-sm text-muted-foreground">
            {period.sessionCount === 0
              ? 'Aucune séance à facturer pour l’instant.'
              : `${period.sessionCount} séance${period.sessionCount > 1 ? 's' : ''} · ${formatAmount(period.totalCents)}`}
          </p>
        </div>
        <Button onClick={onPrepare} variant={due ? 'default' : 'outline'}>
          <Receipt aria-hidden /> Préparer la facture
        </Button>
      </div>

      {payer.pending.count > 0 && (
        <p className="text-sm text-muted-foreground">
          {payer.pending.count} facture{payer.pending.count > 1 ? 's' : ''} en attente de règlement ·{' '}
          {formatAmount(payer.pending.totalCents)}
        </p>
      )}
    </li>
  );
}
