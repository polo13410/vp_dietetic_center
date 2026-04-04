import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { PatientForm, type PatientFormData } from '../../components/patients/PatientForm';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';

export default function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data } = await api.get(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: PatientFormData) => api.patch(`/patients/${id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Patient mis a jour', description: `${res.data.firstName} ${res.data.lastName}` });
      navigate(`/patients/${id}`);
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!patient) return <p className="text-muted-foreground">Patient introuvable</p>;

  const defaultValues: Partial<PatientFormData> = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : undefined,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    address: patient.address ?? '',
    city: patient.city ?? '',
    zipCode: patient.zipCode ?? '',
    referralSource: patient.referralSource ?? '',
    privateNote: patient.privateNote ?? '',
    status: patient.status,
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
    emergencyContactRelationship: patient.emergencyContactRelationship ?? '',
    tagIds: patient.tags?.map((t: { id: string }) => t.id) ?? [],
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/patients/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold">
          Modifier — {patient.lastName} {patient.firstName}
        </h1>
      </div>

      <PatientForm
        defaultValues={defaultValues}
        onSubmit={(data) => mutate(data)}
        isPending={isPending}
        submitLabel="Enregistrer"
        showStatus
      />

      <div className="flex justify-start mt-4">
        <Button variant="outline" asChild>
          <Link to={`/patients/${id}`}>Annuler</Link>
        </Button>
      </div>
    </div>
  );
}
