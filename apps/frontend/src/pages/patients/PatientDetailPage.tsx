import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Edit, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import api from '../../lib/api';
import { calculateAge, formatDate } from '../../lib/utils';

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
          <h1 className="text-xl font-semibold">
            {patient.lastName} {patient.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {calculateAge(patient.dateOfBirth)} — Créé le {formatDate(patient.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/appointments?patientId=${id}`}>
              <Calendar className="w-4 h-4" /> RDV
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/notes?patientId=${id}`}>
              <FileText className="w-4 h-4" /> Notes
            </Link>
          </Button>
          <Button size="sm">
            <Edit className="w-4 h-4" /> Modifier
          </Button>
        </div>
      </div>

      {/* Tags */}
      {patient.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {patient.tags.map((tag: any) => (
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

      {/* Info grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <InfoCard title="Coordonnées">
          <InfoRow label="Email" value={patient.email} />
          <InfoRow label="Téléphone" value={patient.phone} />
          <InfoRow
            label="Adresse"
            value={[patient.address, patient.zipCode, patient.city].filter(Boolean).join(', ')}
          />
        </InfoCard>

        <InfoCard title="Contact d'urgence">
          <InfoRow label="Nom" value={patient.emergencyContactName} />
          <InfoRow label="Téléphone" value={patient.emergencyContactPhone} />
          <InfoRow label="Lien" value={patient.emergencyContactRelationship} />
        </InfoCard>
      </div>

      {/* Private note */}
      {patient.privateNote && (
        <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1.5">Note privée praticienne</p>
          <p className="text-sm text-amber-900 whitespace-pre-line">{patient.privateNote}</p>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Rendez-vous',
            count: patient._count?.appointments,
            href: `/appointments?patientId=${id}`,
          },
          { label: 'Notes', count: patient._count?.notes, href: `/notes?patientId=${id}` },
          {
            label: 'Documents',
            count: patient._count?.documents,
            href: `/documents?patientId=${id}`,
          },
          { label: 'Tâches', count: patient._count?.tasks, href: `/tasks?patientId=${id}` },
        ].map(({ label, count, href }) => (
          <Link
            key={label}
            to={href}
            className="bg-white rounded-xl border border-border p-4 text-center hover:border-primary/20 transition-colors"
          >
            <p className="text-xl font-semibold">{count ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-xs text-foreground">{value ?? '—'}</span>
    </div>
  );
}
