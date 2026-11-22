import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { PATIENT_ID, renderWithProviders } from '../../test/patient-fixtures';

import { GpReportsSection } from './GpReportsSection';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const mocked = vi.mocked(api);

const LIST = `/patients/${PATIENT_ID}/gp-reports`;
const reports = [
  { id: 'r-2', date: '2026-11-22T00:00:00.000Z', status: 'DRAFT', sentAt: null },
  { id: 'r-1', date: '2026-09-26T00:00:00.000Z', status: 'SENT', sentAt: '2026-09-26T16:00:00.000Z' },
];

describe('GpReportsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.get.mockResolvedValue({ data: reports });
  });

  it('lists the reports with their status', async () => {
    renderWithProviders(<GpReportsSection patientId={PATIENT_ID} gpName="Dr Laurent Garnier" />);
    expect(await screen.findByText('Brouillon')).toBeInTheDocument();
    expect(screen.getByText('Envoyé le 26 septembre')).toBeInTheDocument();
    expect(screen.getByText('Pour Dr Laurent Garnier')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ouvrir' })[0]).toHaveAttribute(
      'href',
      `/patients/${PATIENT_ID}/gp-reports/r-2`,
    );
  });

  it('writes a new report pre-filled by the API, and opens it', async () => {
    mocked.post.mockResolvedValue({ data: { id: 'r-3', status: 'DRAFT' } });
    renderWithProviders(<GpReportsSection patientId={PATIENT_ID} />);
    await userEvent.click(screen.getByRole('button', { name: /Rédiger un compte rendu/ }));
    await waitFor(() => expect(mocked.post).toHaveBeenCalledWith(LIST, {}));
    expect(await screen.findByText(`Page : /patients/${PATIENT_ID}/gp-reports/r-3`)).toBeInTheDocument();
  });

  it('deletes a report only after confirmation', async () => {
    mocked.delete.mockResolvedValue({ data: undefined });
    renderWithProviders(<GpReportsSection patientId={PATIENT_ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer le compte rendu du 22 novembre 2026' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/sera supprimé définitivement/)).toBeInTheDocument();
    expect(mocked.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(mocked.delete).toHaveBeenCalledWith(`${LIST}/r-2`));
  });

  it('guides when there is no report yet', async () => {
    mocked.get.mockResolvedValue({ data: [] });
    renderWithProviders(<GpReportsSection patientId={PATIENT_ID} gpName={null} />);
    expect(await screen.findByText(/Aucun compte rendu pour l’instant/)).toBeInTheDocument();
    expect(screen.getByText('Médecin traitant non renseigné')).toBeInTheDocument();
  });
});
