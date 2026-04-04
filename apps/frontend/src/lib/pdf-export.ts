import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';

import { PatientPdfDocument } from '../components/patients/PatientPdfDocument';

export async function exportPatientPdf(
  patient: any,
  appointments: any[],
  notes: any[],
) {
  const doc = createElement(PatientPdfDocument, { patient, appointments, notes });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `patient-${patient.lastName}-${patient.firstName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
