import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import api from '../../lib/api';
import { type Consultation, useInvalidatePatientFile } from '../../lib/patient-file';
import { toast } from '../ui/toaster';

/**
 * Starts a session (from an appointment or not) and opens it. Starting again from the same
 * appointment reopens the existing session.
 */
export function useStartSession(patientId: string) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePatientFile();
  return useMutation({
    mutationFn: async (body: { appointmentId?: string }) =>
      (await api.post<Consultation>(`/patients/${patientId}/consultations`, body)).data,
    onSuccess: (session) => {
      invalidate(patientId);
      navigate(`/consultations/${session.id}`);
    },
    onError: (error: any) =>
      toast({
        title: 'Impossible de démarrer la séance',
        description: error?.response?.data?.message,
        variant: 'destructive',
      }),
  });
}
