import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { apiGet, PATIENT_ID, renderWithProviders, ROUTES } from '../../test/patient-fixtures';

import { FilePanel } from './FilePanel';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), request: vi.fn() },
}));
const mocked = vi.mocked(api);

describe('FilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.get.mockImplementation(apiGet(ROUTES) as never);
    mocked.put.mockResolvedValue({ data: {} });
    mocked.patch.mockResolvedValue({ data: {} });
    mocked.request.mockResolvedValue({ data: {} });
  });

  it('lists her sections in her order', async () => {
    renderWithProviders(<FilePanel patientId={PATIENT_ID} />);
    await screen.findByText('Mesures');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'Patient',
      'Mesures',
      'Santé, maladies',
      'Antécédents familiaux',
      'Psy',
      'Activité physique et sportive',
      'Histoire du poids et régimes',
      'Allergies',
      'Glycémie',
      'Cholestérol et triglycérides',
      'Aversions',
      'Goûts',
    ]);
  });

  it('shows the figures of her sheet: constant, BMI and BMR', async () => {
    renderWithProviders(<FilePanel patientId={PATIENT_ID} />);
    expect(await screen.findByText('0,96')).toBeInTheDocument();
    expect(screen.getByText('30,26')).toBeInTheDocument();
    expect(screen.getByLabelText(/Taille/)).toHaveValue('159');
    expect(screen.getByRole('button', { name: 'Femme', pressed: true })).toBeInTheDocument();
  });

  it('saves a section when leaving it, and says so', async () => {
    renderWithProviders(<FilePanel patientId={PATIENT_ID} />);
    const health = await screen.findByLabelText('Santé, maladies');
    fireEvent.focus(health);
    fireEvent.change(health, { target: { value: 'Hypertension traitée. Diabète de type 2.' } });
    fireEvent.blur(health);
    await waitFor(() =>
      expect(mocked.put).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/file/HEALTH`, {
        content: 'Hypertension traitée. Diabète de type 2.',
        consultationId: undefined,
      }),
    );
    expect(await screen.findByText(/Enregistré à/)).toBeInTheDocument();
  });

  it('shows the history, where a version is deleted after confirmation', async () => {
    renderWithProviders(<FilePanel patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'voir l’historique (2 versions)' }));
    const history = await screen.findByRole('list', { name: 'Historique : Psy' });
    expect(await within(history).findByText('Grignote le soir.')).toBeInTheDocument();
    expect(within(history).getByText(/version actuelle/)).toBeInTheDocument();

    fireEvent.click(within(history).getByRole('button', { name: /Supprimer la version du 23 septembre/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer la version' }));
    await waitFor(() =>
      expect(mocked.request).toHaveBeenCalledWith({
        method: 'delete',
        url: `/patients/${PATIENT_ID}/file-entries/e-psy-1`,
        data: undefined,
      }),
    );
  });

  it('records a declared age when the birth date is unknown', async () => {
    renderWithProviders(<FilePanel patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Je ne connais que son âge' }));
    const age = screen.getByLabelText(/^Âge/);
    fireEvent.change(age, { target: { value: '56' } });
    fireEvent.blur(age);
    await waitFor(() => expect(mocked.patch).toHaveBeenCalledWith(`/patients/${PATIENT_ID}`, { age: 56 }));
  });
});
