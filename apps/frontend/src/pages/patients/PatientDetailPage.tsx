import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Download, Edit, Eye, Play, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  DocumentPreviewDialog,
  downloadDocument,
  type PreviewableDocument,
} from '../../components/documents/DocumentPreviewDialog';
import { DocumentUploadDialog } from '../../components/documents/DocumentUploadDialog';
import { BmiBadge } from '../../components/patient-file/BmiBadge';
import { FilePanel } from '../../components/patient-file/FilePanel';
import { MeasurementsPanel } from '../../components/patient-file/MeasurementsPanel';
import { PatientBrief } from '../../components/patient-file/PatientBrief';
import { SessionsPanel } from '../../components/patient-file/SessionsPanel';
import { useStartSession } from '../../components/patient-file/useStartSession';
import { PatientAccessLog } from '../../components/patients/PatientAccessLog';
import { PatientTasks } from '../../components/patients/PatientTasks';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from '../../components/ui/toaster';
import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { previewKind } from '../../lib/documents';
import { useConsultations } from '../../lib/patient-file';
import { calculateAge, formatDate, formatDateTime } from '../../lib/utils';

type Appointment = { id: string; startAt: string; duration: number; reason?: string; type: string; status: string };

/** Today's appointment that a session can be started from. */
function todaysAppointment(appointments: Appointment[]) {
  const today = new Date().toDateString();
  return appointments.find(
    (a) => new Date(a.startAt).toDateString() === today && ['SCHEDULED', 'CONFIRMED'].includes(a.status),
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Assistants get a read-only administrative view: no clinical data
  const isAssistant = useIsRole('ASSISTANTE');

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data,
    enabled: !!id,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', { patientId: id }],
    queryFn: async () => {
      const { data } = await api.get('/appointments', { params: { patientId: id, limit: 50 } });
      return (data.data ?? data) as Appointment[];
    },
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!patient || !id) return <p className="text-muted-foreground">Patient introuvable</p>;

  return (
    <div className="space-y-5 max-w-6xl">
      <Header patient={patient} appointments={appointments} isAssistant={isAssistant} />

      {isAssistant ? (
        <div className="space-y-4">
          <RecordCard patient={patient} />
          <AppointmentsList appointments={appointments} />
        </div>
      ) : (
        <Tabs defaultValue="brief">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="brief">Résumé</TabsTrigger>
            <TabsTrigger value="sessions">Séances ({patient._count?.consultations ?? 0})</TabsTrigger>
            <TabsTrigger value="measurements">Mesures & événements</TabsTrigger>
            <TabsTrigger value="file">Dossier médical</TabsTrigger>
            <TabsTrigger value="appointments">Rendez-vous ({patient._count?.appointments ?? 0})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({patient._count?.documents ?? 0})</TabsTrigger>
            <TabsTrigger value="tasks">Tâches</TabsTrigger>
            <TabsTrigger value="record">Fiche</TabsTrigger>
          </TabsList>

          <TabsContent value="brief">
            <PatientBrief patientId={id} />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsPanel patientId={id} />
          </TabsContent>
          <TabsContent value="measurements">
            <MeasurementsPanel patientId={id} />
          </TabsContent>
          <TabsContent value="file">
            <FilePanel patientId={id} />
          </TabsContent>
          <TabsContent value="appointments">
            <AppointmentsList appointments={appointments} />
          </TabsContent>
          <TabsContent value="documents">
            <PatientDocuments patientId={id} />
          </TabsContent>
          <TabsContent value="tasks">
            <PatientTasks patientId={id} />
          </TabsContent>
          <TabsContent value="record" className="space-y-4">
            <RecordCard patient={patient} />
            <PatientAccessLog patientId={id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Header({ patient, appointments, isAssistant }: { patient: any; appointments: Appointment[]; isAssistant: boolean }) {
  const start = useStartSession(patient.id);
  const { data: sessions = [] } = useConsultations(isAssistant ? undefined : patient.id);
  const appointment = todaysAppointment(appointments);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/patients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">
              {patient.firstName} {patient.lastName}
            </h1>
            {patient.archivedAt && <span className="text-xs text-muted-foreground">Archivé</span>}
            <BmiBadge bmi={patient.bmi} />
          </div>
          <p className="text-sm text-muted-foreground">
            {calculateAge(patient.dateOfBirth)}
            {patient.birthDateEstimated && ', âge déclaré'} · suivi depuis le {formatDate(patient.createdAt)}
          </p>
        </div>
        {!isAssistant && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const { exportPatientPdf } = await import('../../lib/pdf-export');
                exportPatientPdf(patient, appointments, sessions);
              }}
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/patients/${patient.id}/edit`}>
                <Edit className="w-4 h-4" /> Modifier
              </Link>
            </Button>
            <ArchiveButton patient={patient} />
            <Button
              size="sm"
              disabled={start.isPending}
              onClick={() => start.mutate(appointment ? { appointmentId: appointment.id } : {})}
              title={appointment ? `RDV de ${formatDateTime(appointment.startAt)}` : 'Séance sans rendez-vous'}
            >
              <Play className="w-4 h-4" /> {appointment ? 'Démarrer la séance du jour' : 'Nouvelle séance'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Archived patients leave the lists; their file stays as it is. */
function ArchiveButton({ patient }: { patient: any }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const archived = !!patient.archivedAt;
  const toggle = useMutation({
    mutationFn: () => api.post(`/patients/${patient.id}/${archived ? 'unarchive' : 'archive'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setConfirm(false);
      toast({ title: archived ? 'Patient désarchivé' : 'Patient archivé' });
    },
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => (archived ? toggle.mutate() : setConfirm(true))}>
        {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        {archived ? 'Désarchiver' : 'Archiver'}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Archiver ce patient ?"
        description="Il n’apparaîtra plus dans la liste des patients suivis. Son dossier reste intact et vous pourrez le désarchiver."
        confirmLabel="Archiver"
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate()}
      />
    </>
  );
}

function AppointmentsList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucun rendez-vous</p>;
  }
  return (
    <div className="space-y-2">
      {appointments.map((appt) => (
        <Link
          key={appt.id}
          to={`/appointments/${appt.id}`}
          className="flex items-center justify-between bg-card rounded-lg border border-border p-3 hover:border-primary/20 transition-colors"
        >
          <div>
            <p className="text-sm font-medium">{formatDateTime(appt.startAt)}</p>
            <p className="text-xs text-muted-foreground">
              {appt.duration} min — {appt.reason || 'Pas de motif'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={appt.type} />
            <StatusBadge status={appt.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PatientDocuments({ patientId }: { patientId: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewableDocument | null>(null);
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', { patientId }],
    queryFn: async () => (await api.get('/documents', { params: { patientId } })).data as any[],
  });

  const download = async (doc: PreviewableDocument) => {
    try {
      await downloadDocument(doc);
    } catch {
      toast({ title: 'Erreur lors du téléchargement', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{documents.length} documents</p>
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4" /> Ajouter
        </Button>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucun document</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const viewable = !!previewKind(doc.mimeType);
            return (
              <div key={doc.id} className="flex items-center justify-between bg-card rounded-lg border border-border p-3">
                <button
                  className="text-left disabled:cursor-default"
                  onClick={() => setPreviewing(doc)}
                  disabled={!viewable}
                  title={viewable ? 'Afficher' : undefined}
                >
                  <p className="text-sm font-medium hover:text-primary">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(doc.createdAt)} — {doc.originalName}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <StatusBadge status={doc.type} />
                  {viewable && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Afficher" onClick={() => setPreviewing(doc)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Télécharger" onClick={() => download(doc)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} defaultPatientId={patientId} />
      <DocumentPreviewDialog doc={previewing} onOpenChange={(open) => !open && setPreviewing(null)} />
    </div>
  );
}

/** Administrative record: identity, contact, situation, reason for coming. */
function RecordCard({ patient }: { patient: any }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard title="Coordonnées">
          <InfoRow label="Né(e) le" value={patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null} />
          <InfoRow label="Email" value={patient.email} />
          <InfoRow label="Téléphone" value={patient.phone} />
          <InfoRow label="Adresse" value={[patient.address, patient.zipCode, patient.city].filter(Boolean).join(', ')} />
          <InfoRow label="Adressé par" value={patient.referralSource} />
        </InfoCard>
        <InfoCard title="Situation">
          <InfoRow label="Sexe" value={patient.sex === 'F' ? 'Femme' : patient.sex === 'M' ? 'Homme' : null} />
          <InfoRow label="Situation familiale" value={patient.familySituation} />
          <InfoRow label="Profession" value={patient.profession} />
          <InfoRow label="Médecin traitant" value={patient.gpName} />
        </InfoCard>
      </div>
      {'consultationReason' in patient && (
        <InfoCard title="Profil">
          <InfoRow label="Motif" value={patient.consultationReason} />
        </InfoCard>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-xs text-foreground whitespace-pre-line">{value || '—'}</span>
    </div>
  );
}
