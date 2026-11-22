import { Download, MoreHorizontal, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { PageHeader } from '../../components/shared/PageHeader';
import { SaveIndicator } from '../../components/shared/SaveIndicator';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { useAutosave } from '../../hooks/useAutosave';
import {
  downloadGpReportPdf,
  type GpReportDocumentDto,
  gpReportStatus,
  useDeleteGpReport,
  useGpReport,
  useRegenerateGpReport,
  useUpdateGpReport,
} from '../../lib/gp-reports';
import { formatLongDate } from '../../lib/utils';

/**
 * Writing the report to the GP (docs/REFONTE.md lot 10): the draft pre-filled from the file, edited
 * as plain text on the practice's letterhead, saved as she types; then the PDF and « Marquer comme
 * envoyé ».
 */
export default function GpReportPage() {
  const { id: patientId, reportId } = useParams<{ id: string; reportId: string }>();
  const { data: report, isLoading } = useGpReport(patientId, reportId);

  if (isLoading) return <LoadingSpinner />;
  if (!report || !patientId) return <p className="text-base text-muted-foreground">Ce compte rendu est introuvable.</p>;
  return <GpReportEditor key={report.id} patientId={patientId} report={report} />;
}

function GpReportEditor({ patientId, report }: { patientId: string; report: GpReportDocumentDto }) {
  const navigate = useNavigate();
  const [content, setContent] = useState(report.content);
  const [confirm, setConfirm] = useState<'regenerate' | 'delete' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const update = useUpdateGpReport(patientId, report.id);
  const statusChange = useUpdateGpReport(patientId, report.id);
  const regenerate = useRegenerateGpReport(patientId, report.id);
  const remove = useDeleteGpReport(patientId);
  const autosave = useAutosave((text: string) => update.mutateAsync({ content: text }));
  const textarea = useRef<HTMLTextAreaElement>(null);

  const draft = report.status === 'DRAFT';
  const status = gpReportStatus(report);
  const patientName = `${report.patient.firstName} ${report.patient.lastName}`;
  const filePath = `/patients/${patientId}`;
  const [practiceName, ...practiceLines] = report.letterhead;

  // The text grows with its content: the page scrolls, not the field
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [content]);

  const download = async () => {
    setDownloading(true);
    try {
      await autosave.flush();
      await downloadGpReportPdf(patientId, report.id);
      if (draft) toast({ title: 'PDF téléchargé', description: 'Une fois envoyé, marquez le compte rendu comme envoyé.' });
    } catch {
      toast({ title: 'Le PDF n’a pas pu être créé. Réessayez.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const setStatus = async (next: 'DRAFT' | 'SENT') => {
    try {
      await autosave.flush();
      const saved = await statusChange.mutateAsync({ status: next });
      toast({
        title: next === 'SENT' ? `Compte rendu marqué comme envoyé le ${formatLongDate(saved.sentAt, true)}` : 'Compte rendu repassé en brouillon',
      });
    } catch {
      toast({ title: 'Le changement n’a pas été enregistré. Réessayez.', variant: 'destructive' });
    }
  };

  const pdfButton = (
    <Button variant={draft ? 'outline' : 'default'} onClick={download} disabled={downloading}>
      <Download aria-hidden /> {downloading ? 'Préparation du PDF…' : 'Télécharger le PDF'}
    </Button>
  );

  return (
    <div>
      <PageHeader
        area="patients"
        back={{ to: filePath, label: patientName }}
        title="Compte rendu au médecin"
        subtitle={[report.patient.gpName && `Pour ${report.patient.gpName}`, `daté du ${formatLongDate(report.date)}`]
          .filter(Boolean)
          .join(', ')}
        actions={
          <>
            {pdfButton}
            {draft && (
              <Button onClick={() => setStatus('SENT')} disabled={statusChange.isPending}>
                <Send aria-hidden /> Marquer comme envoyé
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Plus d’actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {draft ? (
                  <DropdownMenuItem onSelect={() => setConfirm('regenerate')}>
                    <RefreshCw aria-hidden /> Régénérer à partir du dossier
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setStatus('DRAFT')}>
                    <Undo2 aria-hidden /> Repasser en brouillon
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setConfirm('delete')} className="text-destructive focus:text-destructive">
                  <Trash2 aria-hidden /> Supprimer le compte rendu
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <StatusBadge status={`GP_REPORT_${report.status}`} tone={status.tone} label={status.label} />
        <SaveIndicator state={autosave.state} />
      </div>
      {!draft && (
        <p className="mb-3 text-base text-muted-foreground">
          Vous pouvez encore corriger le texte : pensez alors à renvoyer le PDF.
        </p>
      )}

      {/* The paper: the letterhead printed on the PDF, then her text */}
      <article className="rounded-xl border bg-card px-5 py-6 shadow-sm sm:px-10 sm:py-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-primary pb-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-primary">{practiceName}</p>
            {practiceLines.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <Link
            to="/settings"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Modifier l’en-tête
          </Link>
        </header>
        <textarea
          ref={textarea}
          aria-label="Texte du compte rendu"
          value={content}
          spellCheck
          lang="fr"
          onChange={(e) => {
            setContent(e.target.value);
            autosave.schedule(e.target.value);
          }}
          onBlur={() => void autosave.flush()}
          className="block min-h-96 w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-foreground focus-visible:outline-none"
        />
      </article>

      <ConfirmDialog
        open={confirm === 'regenerate'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Régénérer le compte rendu ?"
        description="Le texte est remplacé par un nouveau brouillon tiré du dossier d’aujourd’hui. Les modifications que vous y avez faites seront perdues."
        confirmLabel="Remplacer le texte"
        variant="destructive"
        loading={regenerate.isPending}
        onConfirm={() => {
          autosave.cancel();
          regenerate.mutate(undefined, {
            onSuccess: (fresh) => {
              setContent(fresh.content);
              setConfirm(null);
              toast({ title: 'Le compte rendu a été régénéré' });
            },
            onError: () => toast({ title: 'Le compte rendu n’a pas été régénéré. Réessayez.', variant: 'destructive' }),
          });
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Supprimer ce compte rendu ?"
        description={`Le compte rendu du ${formatLongDate(report.date)} sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          autosave.cancel();
          remove.mutate(report.id, {
            onSuccess: () => {
              toast({ title: 'Compte rendu supprimé' });
              navigate(filePath, { replace: true });
            },
            onError: () => toast({ title: 'Le compte rendu n’a pas été supprimé. Réessayez.', variant: 'destructive' }),
          });
        }}
      />
    </div>
  );
}
