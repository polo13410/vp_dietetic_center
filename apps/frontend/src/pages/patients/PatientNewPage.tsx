import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { PatientForm, type PatientFormData } from '../../components/patients/PatientForm';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';

export default function PatientNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (data: PatientFormData) => api.post('/patients', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Patient cree', description: `${res.data.firstName} ${res.data.lastName}` });
      navigate(`/patients/${res.data.id}`);
    },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/patients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold">Nouveau patient</h1>
      </div>

      <PatientForm
        onSubmit={(data) => mutate(data)}
        isPending={isPending}
        submitLabel="Creer le patient"
      />

      <div className="flex justify-start mt-4">
        <Button variant="outline" asChild>
          <Link to="/patients">Annuler</Link>
        </Button>
      </div>
    </div>
  );
}
