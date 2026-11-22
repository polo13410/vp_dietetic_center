import { useMutation } from '@tanstack/react-query';
import { Check, MoreHorizontal, Play, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { RecallPanel } from '../../components/consultations/RecallPanel';
import { SessionTextField } from '../../components/consultations/SessionInputs';
import {
  AversionsAndTastes,
  SessionFurther,
  SessionHeaderFields,
  WeightSection,
} from '../../components/consultations/SessionSections';
import {
  isJustStarted,
  type PatientRouteState,
  panelRemembered,
  rememberPanel,
} from '../../components/consultations/session-route';
import { SessionInvoice } from '../../components/invoices/SessionInvoice';
import { PatientRecap } from '../../components/patient-file/PatientRecap';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useKeepFieldVisible } from '../../hooks/useKeepFieldVisible';
import { apiErrorMessage } from '../../hooks/useMe';
import api from '../../lib/api';
import { useSessionInvoices } from '../../lib/invoices';
import { type Consultation, sessionName, useConsultation, useInvalidatePatientFile } from '../../lib/patient-file';
import { cn, formatLongDate } from '../../lib/utils';

/** iPad landscape and wider: the « Rappel » pushes the séance; narrower, it goes over it. */
const PUSH_PANEL = '(min-width: 1024px)';

/**
 * A séance: one row of her follow-up sheet, in two times. Time 1, « Avant de commencer », when a
 * séance has just been started: the patient's summary in big, and « Commencer la séance ». Time 2:
 * the summary slides into the narrow « Rappel » panel and the séance's fields come, in the order
 * of her sheet, saved as she types. A reopened séance goes straight to time 2, panel closed, and
 * is corrected like today's.
 */
export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useConsultation(id);

  if (isLoading) return <LoadingSpinner />;
  if (!session) return <p className="text-base text-muted-foreground">Cette séance est introuvable.</p>;
  return <SessionScreen key={session.id} session={session} />;
}

function SessionScreen({ session }: { session: Consultation }) {
  const location = useLocation();
  const navigate = useNavigate();
  const drawer = !useMediaQuery(PUSH_PANEL);
  const [started, setStarted] = useState(() => !isJustStarted(location.state, session.id));
  const [entering, setEntering] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const start = () => {
    // Beside the séance (iPad landscape, computer) the panel stays as she left it last time; over
    // it (iPad portrait), it slides away and waits behind its handle
    setPanelOpen(!drawer && panelRemembered());
    setEntering(true);
    setStarted(true);
    // « Back » or a reload now lands on the séance, not on time 1 again
    navigate(location.pathname, { replace: true, state: null });
    const main = rootRef.current?.closest('main');
    if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0 });
  };

  const changePanel = (open: boolean) => {
    setPanelOpen(open);
    if (!drawer) rememberPanel(open);
  };

  return (
    <div ref={rootRef}>
      {started ? (
        <>
          <SessionTitle session={session} />
          <div className="flex items-stretch gap-4 lg:gap-6">
            <RecallPanel
              patientId={session.patientId}
              sessionId={session.id}
              open={panelOpen}
              onOpenChange={changePanel}
              drawer={drawer}
              // The page's root exists since time 1 (the row's ref is not attached yet when the panel measures)
              enterFrom={entering ? rootRef : undefined}
            />
            <SessionFields session={session} entering={entering} />
          </div>
        </>
      ) : (
        <BeforeStarting session={session} onStart={start} />
      )}
    </div>
  );
}

const patientName = (session: Consultation) =>
  session.patient ? `${session.patient.firstName} ${session.patient.lastName}` : '';

// ─── Time 1: before starting ──────────────────────────────────────────────────

function BeforeStarting({ session, onStart }: { session: Consultation; onStart: () => void }) {
  return (
    <div>
      <PageHeader
        area="patients"
        back={{ to: `/patients/${session.patientId}`, label: `Dossier de ${patientName(session)}` }}
        title="Avant de commencer"
        subtitle={`${sessionName(session.sequence)} · ${patientName(session)}`}
      />
      <PatientRecap patientId={session.patientId} size="page" beforeSessionId={session.id} />
      <div className="sticky bottom-4 z-10 mt-8 flex justify-center">
        <Button size="lg" className="h-14 px-10 text-lg shadow-lg" onClick={onStart}>
          <Play aria-hidden /> Commencer la séance
        </Button>
      </div>
    </div>
  );
}

// ─── Time 2: the séance ───────────────────────────────────────────────────────

function SessionTitle({ session }: { session: Consultation }) {
  const navigate = useNavigate();
  const finish = () =>
    navigate(`/patients/${session.patientId}`, { state: { endedSession: session.id } satisfies PatientRouteState });

  return (
    <PageHeader
      area="patients"
      className="mb-4 sm:mb-6"
      back={{ to: `/patients/${session.patientId}`, label: `Dossier de ${patientName(session)}` }}
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          {sessionName(session.sequence)}
          <span className="text-lg font-normal text-muted-foreground">{patientName(session)}</span>
        </span>
      }
      subtitle={formatLongDate(session.date)}
      actions={
        <>
          <Button onClick={finish}>
            <Check aria-hidden /> Terminer la séance
          </Button>
          <SessionMenu session={session} />
        </>
      }
    />
  );
}

/** Secondary actions: delete the séance (with its invoice cancelled by a credit note first). */
function SessionMenu({ session }: { session: Consultation }) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePatientFile();
  const [confirm, setConfirm] = useState(false);
  const invoice = useSessionInvoices(session.id).data?.current;

  const remove = useMutation({
    mutationFn: () => api.delete(`/consultations/${session.id}`),
    onSuccess: () => {
      invalidate(session.patientId);
      toast({ title: 'Séance supprimée' });
      navigate(`/patients/${session.patientId}`);
    },
    onError: (error) =>
      toast({ title: apiErrorMessage(error, 'La séance n’a pas pu être supprimée. Réessayez.'), variant: 'destructive' }),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Plus d’actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirm(true)}>
            <Trash2 aria-hidden /> Supprimer la séance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer cette séance (${sessionName(session.sequence)}) ?`}
        description={
          (invoice
            ? `La facture n° ${invoice.number} sera annulée par un avoir ; la facture et l’avoir restent dans vos factures. `
            : '') +
          'La séance et ses mesures seront supprimées. Ce qui a été écrit dans le dossier médical est conservé.'
        }
        confirmLabel="Supprimer la séance"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

/** Her columns, in the order of her sheet. */
function SessionFields({ session, entering }: { session: Consultation; entering: boolean }) {
  const { ref, keyboardInset } = useKeepFieldVisible<HTMLDivElement>();
  const previousAdvice = session.sequence > 0 ? session.previousAdvice : null;

  return (
    <div
      ref={ref}
      // Its blocks lay out by its own width (the « Rappel » open or closed), not the screen's
      className={cn('@container min-w-0 flex-1 space-y-6', entering && 'motion-safe:animate-session-enter')}
      style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}
    >
      <SessionHeaderFields session={session} />
      <WeightSection session={session} />
      <SessionTextField
        session={session}
        field="habits"
        label="Habitudes et évolution"
        placeholder="Ce que le patient rapporte depuis la dernière fois"
        before={
          previousAdvice && (
            <div className="rounded-lg border-l-4 border-area-patients bg-muted px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">Conseils donnés à la dernière séance</p>
              <p className="whitespace-pre-line leading-relaxed">{previousAdvice}</p>
            </div>
          )
        }
      />
      <SessionTextField
        session={session}
        field="sessionWork"
        label="Travail en consultation"
        placeholder="Ce qui a été travaillé pendant la séance"
      />
      <AversionsAndTastes session={session} />
      <SessionTextField
        session={session}
        field="advice"
        label="Conseils diététiques"
        placeholder="Ce que vous lui conseillez pour la suite"
      />
      <SessionFurther session={session} />
      <IssuedInvoice session={session} />
    </div>
  );
}

/**
 * The séance's invoice once there is one (download, correct, cancel; a banner when the séance no
 * longer matches it). Before, « Faire la facture » is offered by « Terminer la séance ».
 */
function IssuedInvoice({ session }: { session: Consultation }) {
  const { data } = useSessionInvoices(session.id);
  if (!data?.current && !data?.history.length) return null;
  return <SessionInvoice session={session} />;
}
