import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Download, Edit, FileText, FolderOpen, Heart } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { PatientTimeline } from '../../components/patients/PatientTimeline';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import api from '../../lib/api';
import { calculateAge, formatDate, formatDateTime } from '../../lib/utils';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await api.get(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', { patientId: id }],
    queryFn: async () => {
      const { data } = await api.get('/appointments', { params: { patientId: id, limit: 20 } });
      return data.data ?? data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', { patientId: id }],
    queryFn: async () => {
      const { data } = await api.get('/notes', { params: { patientId: id } });
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', { patientId: id }],
    queryFn: async () => {
      const { data } = await api.get('/documents', { params: { patientId: id } });
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!patient) return <p className="text-muted-foreground">Patient introuvable</p>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/patients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {patient.lastName} {patient.firstName}
            </h1>
            <StatusBadge status={patient.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {calculateAge(patient.dateOfBirth)} — Cree le {formatDate(patient.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            const { exportPatientPdf } = await import('../../lib/pdf-export');
            exportPatientPdf(patient, appointments, notes);
          }}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button size="sm" asChild>
            <Link to={`/patients/${id}/edit`}>
              <Edit className="w-4 h-4" /> Modifier
            </Link>
          </Button>
        </div>
      </div>

      {/* Tags */}
      {patient.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {patient.tags.map((tag: { id: string; name: string; color: string }) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-1 rounded-md font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Apercu</TabsTrigger>
          <TabsTrigger value="appointments">
            RDV ({patient._count?.appointments ?? 0})
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes ({patient._count?.notes ?? 0})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({patient._count?.documents ?? 0})
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <InfoCard title="Coordonnees">
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Telephone" value={patient.phone} />
              <InfoRow
                label="Adresse"
                value={[patient.address, patient.zipCode, patient.city].filter(Boolean).join(', ')}
              />
            </InfoCard>

            <InfoCard title="Contact d'urgence">
              <InfoRow label="Nom" value={patient.emergencyContactName} />
              <InfoRow label="Telephone" value={patient.emergencyContactPhone} />
              <InfoRow label="Lien" value={patient.emergencyContactRelationship} />
            </InfoCard>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <InfoCard title="Informations complementaires">
              <InfoRow label="Source" value={patient.referralSource} />
            </InfoCard>
            {patient.nutritionalProfile && (
              <Link
                to={`/nutritional/${id}`}
                className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-colors flex items-center gap-3"
              >
                <Heart className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Profil nutritionnel</p>
                  <p className="text-xs text-muted-foreground">Voir le suivi psycho-nutritionnel</p>
                </div>
              </Link>
            )}
          </div>

          {patient.privateNote && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">
                Note privee praticienne
              </p>
              <p className="text-sm text-foreground whitespace-pre-line">{patient.privateNote}</p>
            </div>
          )}

          {/* Quick counters */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Rendez-vous', count: patient._count?.appointments, icon: Calendar },
              { label: 'Notes', count: patient._count?.notes, icon: FileText },
              { label: 'Documents', count: patient._count?.documents, icon: FolderOpen },
            ].map(({ label, count, icon: Icon }) => (
              <div
                key={label}
                className="bg-card rounded-xl border border-border p-4 text-center"
              >
                <Icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl font-semibold">{count ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Appointments Tab ─────────────────────── */}
        <TabsContent value="appointments" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{appointments.length} rendez-vous</p>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/appointments?patientId=${id}`}>Voir tout</Link>
            </Button>
          </div>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun rendez-vous</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((appt: any) => (
                <Link
                  key={appt.id}
                  to={`/appointments/${appt.id}`}
                  className="flex items-center justify-between bg-card rounded-lg border border-border p-3 hover:border-primary/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatDateTime(appt.startAt)}
                    </p>
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
          )}
        </TabsContent>

        {/* ── Notes Tab ─────────────────────── */}
        <TabsContent value="notes" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{notes.length} notes</p>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/notes?patientId=${id}`}>Voir tout</Link>
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune note</p>
          ) : (
            <div className="space-y-2">
              {(notes as any[]).map((note) => (
                <Link
                  key={note.id}
                  to={`/notes/${note.id}`}
                  className="flex items-center justify-between bg-card rounded-lg border border-border p-3 hover:border-primary/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{note.title || 'Sans titre'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(note.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={note.type} />
                    <StatusBadge status={note.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Documents Tab ─────────────────────── */}
        <TabsContent value="documents" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{documents.length} documents</p>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/documents?patientId=${id}`}>Voir tout</Link>
            </Button>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun document</p>
          ) : (
            <div className="space-y-2">
              {(documents as any[]).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-card rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt)} — {doc.originalName}
                    </p>
                  </div>
                  <StatusBadge status={doc.type} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Timeline Tab ─────────────────────── */}
        <TabsContent value="timeline">
          <PatientTimeline patientId={id!} />
        </TabsContent>
      </Tabs>
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
      <span className="text-xs text-foreground">{value ?? '—'}</span>
    </div>
  );
}
