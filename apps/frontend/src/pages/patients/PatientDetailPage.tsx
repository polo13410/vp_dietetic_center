import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, CalendarPlus, Download, MoreHorizontal, Play, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { AppointmentFormDialog } from '../../components/appointments/AppointmentFormDialog';
import { SessionEndDialog } from '../../components/consultations/SessionEndDialog';
import { GpReportsSection } from '../../components/gp-reports/GpReportsSection';
import { PatientInvoices } from '../../components/invoices/PatientInvoices';
import { FilePanel } from '../../components/patient-file/FilePanel';
import { MeasuresPanel } from '../../components/patient-file/MeasuresPanel';
import { PatientRecap } from '../../components/patient-file/PatientRecap';
import { SessionsPanel } from '../../components/patient-file/SessionsPanel';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { PatientAccessLog } from '../../components/patients/PatientAccessLog';
import { PatientAppointments } from '../../components/patients/PatientAppointments';
import { PatientContactCard } from '../../components/patients/PatientContactCard';
import { PatientDocuments } from '../../components/patients/PatientDocuments';
import { PatientTasks } from '../../components/patients/PatientTasks';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from '../../components/ui/toaster';
import { useIsRole } from '../../hooks/useAuth';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import api from '../../lib/api';
import {
  type Patient,
  type PatientAppointment,
  PATIENT_TABS,
  type PatientTab,
  todaysAppointment,
  useConsultations,
  usePatient,
  usePatientAppointments,
} from '../../lib/patient-file';
import { ageInYears } from '../../lib/utils';

/**
 * The patient's file, built on her Numbers sheet. The « Récapitulatif » is read only: each of its
 * blocks leads to the tab that owns the data (« ?onglet=mesures#poids »), where it is edited in
 * place, without an edit page or window.
 */
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Assistants get the administrative side only: no clinical data
  const isAssistant = useIsRole('ASSISTANTE');
  const { data: patient, isLoading } = usePatient(id);
  const { data: appointments = [] } = usePatientAppointments(id);

  if (isLoading) return <LoadingSpinner />;
  if (!patient || !id) return <p className="text-base text-muted-foreground">Ce patient est introuvable.</p>;

  return (
    <div>
      <PatientHeader patient={patient} appointments={appointments} isAssistant={isAssistant} />
      {isAssistant ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PatientContactCard patient={patient} />
          <PatientAppointments appointments={appointments} />
        </div>
      ) : (
        <PatientTabs patient={patient} appointments={appointments} />
      )}
      {!isAssistant && <SessionEndDialog patientId={id} />}
    </div>
  );
}

function PatientTabs({ patient, appointments }: { patient: Patient; appointments: PatientAppointment[] }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('onglet');
  const tab: PatientTab = PATIENT_TABS.some((t) => t.value === requested) ? (requested as PatientTab) : 'recapitulatif';
  const setTab = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'recapitulatif') next.delete('onglet');
        else next.set('onglet', value);
        return next;
      },
      { replace: true },
    );
  useScrollToHash();
  const { data: sessions = [] } = useConsultations(patient.id);
  const start = useStartNow(patient.id, appointments);
  const counts: Partial<Record<PatientTab, number | undefined>> = {
    suivi: sessions.length,
    documents: patient._count?.documents,
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList>
          {PATIENT_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {!!counts[t.value] && <span className="ml-1.5 text-sm text-muted-foreground">{counts[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="recapitulatif" className="mt-3">
        <PatientRecap patientId={patient.id} size="page" links>
          <GpReportsSection patientId={patient.id} gpName={patient.gpName} />
        </PatientRecap>
      </TabsContent>
      <TabsContent value="dossier" className="mt-3">
        <FilePanel patientId={patient.id} />
      </TabsContent>
      <TabsContent value="mesures" className="mt-3">
        <MeasuresPanel patientId={patient.id} />
      </TabsContent>
      <TabsContent value="suivi" className="mt-3 space-y-4">
        <SessionsPanel patientId={patient.id} onStart={start.run} starting={start.isPending} />
        <div className="grid gap-4 lg:grid-cols-2">
          <PatientTasks patientId={patient.id} />
          <PatientAppointments appointments={appointments} />
        </div>
      </TabsContent>
      <TabsContent value="factures" className="mt-3">
        <PatientInvoices patientId={patient.id} />
      </TabsContent>
      <TabsContent value="documents" className="mt-3">
        <PatientDocuments patientId={patient.id} />
      </TabsContent>
    </Tabs>
  );
}

/** Starts today's appointment's session if there is one, a session without appointment otherwise. */
function useStartNow(patientId: string, appointments: PatientAppointment[]) {
  const start = useStartSession(patientId);
  const appointment = todaysAppointment(appointments);
  return {
    appointment,
    isPending: start.isPending,
    run: () => start.mutate(appointment ? { appointmentId: appointment.id } : {}),
  };
}

function PatientHeader({
  patient,
  appointments,
  isAssistant,
}: {
  patient: Patient;
  appointments: PatientAppointment[];
  isAssistant: boolean;
}) {
  const start = useStartNow(patient.id, appointments);
  const [booking, setBooking] = useState(false);
  const bookingDefaults = useMemo(() => ({ patientId: patient.id }), [patient.id]);
  const age = ageInYears(patient.dateOfBirth);

  return (
    <>
      <PageHeader
        className="mb-3 sm:mb-4"
        area="patients"
        hideIcon
        back={{ to: '/patients', label: 'Patients' }}
        title={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {patient.firstName} {patient.lastName}
            {age !== null && (
              <span className="text-lg font-normal text-muted-foreground">
                {age} ans{patient.birthDateEstimated && ' (âge déclaré)'}
              </span>
            )}
            {patient.archivedAt && <StatusBadge status="ARCHIVED" tone="neutral" label="Archivé" className="self-center" />}
          </span>
        }
        actions={
          <>
            {!isAssistant && (
              <Button onClick={start.run} disabled={start.isPending}>
                <Play aria-hidden /> {start.appointment ? 'Démarrer la séance du jour' : 'Nouvelle séance'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setBooking(true)}>
              <CalendarPlus aria-hidden /> Prendre rendez-vous
            </Button>
            {!isAssistant && <MoreMenu patient={patient} appointments={appointments} />}
          </>
        }
      />
      <AppointmentFormDialog open={booking} onOpenChange={setBooking} defaultValues={bookingDefaults} />
    </>
  );
}

/** Secondary actions: the access history, the PDF export, archive or unarchive (confirmed). */
function MoreMenu({ patient, appointments }: { patient: Patient; appointments: PatientAppointment[] }) {
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useConsultations(patient.id);
  const [confirm, setConfirm] = useState(false);
  const [accessLog, setAccessLog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const archived = !!patient.archivedAt;
  const name = `${patient.firstName} ${patient.lastName}`;
  const toggle = useMutation({
    mutationFn: () => api.post(`/patients/${patient.id}/${archived ? 'unarchive' : 'archive'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setConfirm(false);
      toast({ title: archived ? `${name} est de nouveau suivi(e)` : `${name} est archivé(e)` });
    },
    onError: () => toast({ title: 'Le changement n’a pas été enregistré. Réessayez.', variant: 'destructive' }),
  });

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { exportPatientPdf } = await import('../../lib/pdf-export');
      await exportPatientPdf(patient, appointments, sessions);
    } catch {
      toast({ title: 'Le PDF n’a pas pu être créé. Réessayez.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Plus d’actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAccessLog(true)}>
            <ShieldCheck aria-hidden /> Historique des accès
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportPdf()} disabled={exporting}>
            <Download aria-hidden /> {exporting ? 'Création du PDF…' : 'Exporter le dossier en PDF'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)}>
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? 'Désarchiver le patient' : 'Archiver le patient'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={accessLog} onOpenChange={setAccessLog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historique des accès</DialogTitle>
          </DialogHeader>
          {accessLog && <PatientAccessLog patientId={patient.id} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={archived ? `Désarchiver ${name} ?` : `Archiver ${name} ?`}
        description={
          archived
            ? 'Le patient revient dans la liste des patients suivis.'
            : 'Le patient n’apparaîtra plus dans la liste des patients suivis. Son dossier reste intact et vous pourrez le désarchiver.'
        }
        confirmLabel={archived ? 'Désarchiver' : 'Archiver'}
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate()}
      />
    </>
  );
}
