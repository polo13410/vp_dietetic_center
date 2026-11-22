import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { apiGet, brief, PATIENT_ID, renderWithProviders, ROUTES } from '../../test/patient-fixtures';

import { PatientRecap } from './PatientRecap';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
const get = vi.mocked(api.get);

describe('PatientRecap', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(apiGet(ROUTES) as never);
  });

  it('shows the figures of her sheet for the test case', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByText('76,5 kg')).toBeInTheDocument();
    expect(screen.getByText('30,26')).toBeInTheDocument();
    expect(screen.getByText('5,77')).toBeInTheDocument();
    expect(screen.getByText(/1\s378,9/)).toBeInTheDocument();
    expect(screen.getByText('−2,5 kg')).toBeInTheDocument();
    expect(screen.getByText(/depuis le bilan/)).toBeInTheDocument();
  });

  it('puts allergies, contact and the GP report in view', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByRole('note', { name: 'Allergies' })).toHaveTextContent('Arachide.');
    expect(screen.getByRole('link', { name: '06 21 43 65 87' })).toHaveAttribute('href', 'tel:0621436587');
    expect(screen.getByRole('link', { name: 'martine.roux@example.com' })).toHaveAttribute(
      'href',
      'mailto:martine.roux@example.com',
    );
    expect(screen.getByText('Compte rendu : à faire')).toBeInTheDocument();
    expect(screen.getByText('56 ans · Femme')).toBeInTheDocument();
  });

  it('shows the last advice, aversions and tastes', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByText('Une entrée ou un dessert, pas les deux.')).toBeInTheDocument();
    expect(screen.getByText('Suivi 2 · 15 novembre', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Pas de poisson.')).toBeInTheDocument();
    expect(screen.getByText('Aime les fruits.')).toBeInTheDocument();
  });

  it('says what is missing to compute the figures', async () => {
    get.mockImplementation(
      apiGet({ ...ROUTES, [`/patients/${PATIENT_ID}/brief`]: { ...brief, bmi: { current: null, atStart: null }, bmr: null, missing: ['height'] } }) as never,
    );
    const openFile = vi.fn();
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} onOpenFile={openFile} />);
    expect(await screen.findByText(/Ajoutez la taille pour calculer l’IMC\. Ajoutez la taille pour calculer le MB\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compléter le dossier' }));
    expect(openFile).toHaveBeenCalled();
  });

  it('edits identity in place on the page size', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} editable />);
    fireEvent.click(await screen.findByRole('button', { name: /Modifier$/ }));
    expect(await screen.findByLabelText(/Prénom/)).toHaveValue('Martine');
    fireEvent.click(screen.getByRole('button', { name: /Terminer/ }));
    expect(screen.queryByLabelText(/Prénom/)).not.toBeInTheDocument();
  });

  it('is read-only in the narrow panel, with the work done at the last session', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} size="panel" editable />);
    expect(await screen.findByText('Point sur les repas au restaurant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier$/ })).not.toBeInTheDocument();
  });
});
