import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';

import { PatientPdfDocument } from '../components/patients/PatientPdfDocument';

import { saveFile } from './download';

export async function exportPatientPdf(
  patient: any,
  appointments: any[],
  sessions: any[],
) {
  const doc = createElement(PatientPdfDocument, { patient, appointments, sessions });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob();
  saveFile(blob, `patient-${patient.lastName}-${patient.firstName}.pdf`);
}
