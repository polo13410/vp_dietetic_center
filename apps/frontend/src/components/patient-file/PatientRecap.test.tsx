import { screen, within } from '@testing-library/react';
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

  it('counts the change from the bilan, not from a weight history entered before it', async () => {
    get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${PATIENT_ID}/brief`]: {
          ...brief,
          metrics: [{ ...brief.metrics[0], count: 4, first: { value: 70, measuredAt: '2019-05-01T00:00:00.000Z' } }],
        },
      }) as never,
    );
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByText('−2,5 kg')).toBeInTheDocument();
    expect(screen.getByText(/depuis le bilan \(79 kg\)/)).toBeInTheDocument();
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

  it('shows the last advice, aversions, tastes and what is left to do', async () => {
    get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${PATIENT_ID}/brief`]: {
          ...brief,
          openTasks: [{ id: 't1', title: 'Envoyer le compte rendu', priority: 'HIGH', dueAt: '2026-11-30T00:00:00.000Z' }],
        },
      }) as never,
    );
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByText('Une entrée ou un dessert, pas les deux.')).toBeInTheDocument();
    expect(screen.getByText('Suivi 2 · 15 novembre', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Pas de poisson.')).toBeInTheDocument();
    expect(screen.getByText('Aime les fruits.')).toBeInTheDocument();
    expect(screen.getByText('Envoyer le compte rendu')).toBeInTheDocument();
    expect(screen.getByText(/avant le 30 nov/)).toBeInTheDocument();
  });

  it('is read only: no field, no editing button', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} links />);
    await screen.findByText('76,5 kg');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument();
  });

  it('leads each « Modifier » to the tab that owns the data, at its place', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} links />);
    await screen.findByText('76,5 kg');
    const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');
    expect(href('Modifier les allergies')).toBe(`/patients/${PATIENT_ID}?onglet=dossier#allergies`);
    expect(href('Modifier l’identité et le contact')).toBe(`/patients/${PATIENT_ID}?onglet=dossier#identite`);
    expect(href('Modifier les mesures')).toBe(`/patients/${PATIENT_ID}?onglet=mesures#poids`);
    expect(href('Modifier les aversions et goûts')).toBe(`/patients/${PATIENT_ID}?onglet=dossier#aversions`);
    expect(href('Modifier les tâches de ce patient')).toBe(`/patients/${PATIENT_ID}?onglet=suivi#a-faire`);
    // Each link reads « Modifier »
    for (const link of screen.getAllByRole('link', { name: /^Modifier/ })) expect(link).toHaveTextContent('Modifier');
  });

  it('says what is missing and where to add it', async () => {
    get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${PATIENT_ID}/brief`]: { ...brief, bmi: { current: null, atStart: null }, bmr: null, missing: ['height'] },
      }) as never,
    );
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} links />);
    expect(await screen.findByText(/Ajoutez la taille pour calculer l’IMC\. Ajoutez la taille pour calculer le MB\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ajouter une mesure' })).toHaveAttribute(
      'href',
      `/patients/${PATIENT_ID}?onglet=mesures#frise`,
    );
  });

  it('sends a missing sex or age to the medical file', async () => {
    get.mockImplementation(
      apiGet({ ...ROUTES, [`/patients/${PATIENT_ID}/brief`]: { ...brief, bmr: null, missing: ['sex'] } }) as never,
    );
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} links />);
    expect(await screen.findByRole('link', { name: 'Compléter l’âge, le sexe et la taille' })).toHaveAttribute(
      'href',
      `/patients/${PATIENT_ID}?onglet=dossier#age-sexe-taille`,
    );
  });

  it('shows a child’s BMI on the IOTF curves, and the BMR « formule adulte »', async () => {
    get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${PATIENT_ID}/brief`]: {
          ...brief,
          minor: true,
          bmi: {
            current: { value: 22.96, category: null, child: { ageYears: 12, class: 'OVERWEIGHT', cutoffs: null } },
            atStart: null,
          },
          bmr: { mj: 5.1, kcal: 1218.6, adultFormulaForMinor: true },
        },
      }) as never,
    );
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} />);
    expect(await screen.findByText('Surpoids (IOTF)')).toBeInTheDocument();
    expect(screen.getAllByText('formule adulte')).toHaveLength(2);
  });

  it('has no « Modifier » outside the patient’s file, and gives the work done at the last session in the panel', async () => {
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} size="panel" />);
    expect(await screen.findByText('Point sur les repas au restaurant.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Modifier/ })).not.toBeInTheDocument();
    const figures = screen.getByRole('heading', { name: 'Chiffres clés' }).closest('section')!;
    expect(within(figures).queryByRole('link')).not.toBeInTheDocument();
  });
});
