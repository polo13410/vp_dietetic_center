import { FileSignature, PenLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { type GpReportDto, gpReportStatus, useCreateGpReport, useDeleteGpReport, useGpReports } from '../../lib/gp-reports';
import { formatLongDate } from '../../lib/utils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

export const gpReportPath = (patientId: string, id: string) => `/patients/${patientId}/gp-reports/${id}`;

/**
 * The reports to the GP, in the patient's file: « Rédiger un compte rendu » opens a draft pre-filled
 * from the file; each report can be reopened or deleted (with confirmation).
 */
export function GpReportsSection({ patientId, gpName }: { patientId: string; gpName?: string | null }) {
  const navigate = useNavigate();
  const { data: reports = [] } = useGpReports(patientId);
  const create = useCreateGpReport(patientId);
  const [toDelete, setToDelete] = useState<GpReportDto | null>(null);
  const remove = useDeleteGpReport(patientId);

  const write = () =>
    create.mutate(undefined, {
      onSuccess: (report) => navigate(gpReportPath(patientId, report.id)),
      onError: () => toast({ title: 'Le compte rendu n’a pas pu être préparé. Réessayez.', variant: 'destructive' }),
    });

  return (
    <Section
      icon={FileSignature}
      area="patients"
      title="Comptes rendus au médecin"
      description={gpName ? `Pour ${gpName}` : 'Médecin traitant non renseigné'}
      action={
        <Button variant="outline" onClick={write} disabled={create.isPending}>
          <PenLine aria-hidden /> {create.isPending ? 'Préparation…' : 'Rédiger un compte rendu'}
        </Button>
      }
    >
      {reports.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Aucun compte rendu pour l’instant. Le brouillon est pré-rempli avec le dossier : vous n’avez qu’à le relire.
        </p>
      ) : (
        <ul className="divide-y">
          {reports.map((report) => {
            const status = gpReportStatus(report);
            return (
              <li key={report.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 first:pt-0 last:pb-0">
                <Link
                  to={gpReportPath(patientId, report.id)}
                  className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Compte rendu du {formatLongDate(report.date, true)}
                  <StatusBadge status={`GP_REPORT_${report.status}`} tone={status.tone} label={status.label} />
                </Link>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={gpReportPath(patientId, report.id)}>Ouvrir</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer le compte rendu du ${formatLongDate(report.date)}`}
                    onClick={() => setToDelete(report)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer ce compte rendu ?"
        description={
          toDelete
            ? `Le compte rendu du ${formatLongDate(toDelete.date)} sera supprimé définitivement.`
            : ''
        }
        confirmLabel="Supprimer"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              setToDelete(null);
              toast({ title: 'Compte rendu supprimé' });
            },
            onError: () => toast({ title: 'Le compte rendu n’a pas été supprimé. Réessayez.', variant: 'destructive' }),
          })
        }
      />
    </Section>
  );
}
