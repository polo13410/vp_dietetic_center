import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import {
  apiGet,
  PATIENT_ID,
  renderWithProviders,
  ROUTES,
  signInPractitioner,
  TWO_PRACTICES,
} from '../../test/patient-fixtures';

import { SessionsPanel } from './SessionsPanel';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn() } }));

describe('SessionsPanel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(apiGet(ROUTES) as never);
  });

  it('lists the sessions like her sheet: Bilan first, with the computed figures', async () => {
    renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={vi.fn()} />);
    await screen.findByRole('link', { name: 'Bilan' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Bilan', 'Suivi 1', 'Suivi 2']);
    expect(within(rows[0]).getByText('31,25')).toBeInTheDocument();
    expect(within(rows[0]).getByText('5,86')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/1\s400,3/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/60 €/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Chèque')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Non réglé')).toBeInTheDocument();
  });

  it('has no practice column with one practice, and one when she consults in several', async () => {
    signInPractitioner();
    vi.mocked(api.get).mockImplementation(apiGet({ ...ROUTES, '/me/practices': TWO_PRACTICES.slice(0, 1) }) as never);
    const { unmount } = renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={vi.fn()} />);
    await screen.findByRole('link', { name: 'Bilan' });
    expect(screen.queryByRole('columnheader', { name: 'Cabinet' })).not.toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockImplementation(apiGet({ ...ROUTES, '/me/practices': TWO_PRACTICES }) as never);
    renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={vi.fn()} />);
    expect(await screen.findByRole('columnheader', { name: 'Cabinet' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Cabinet d’Aix')).toBeInTheDocument();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('unfolds a row to read its texts', async () => {
    renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={vi.fn()} />);
    const toggle = await screen.findByRole('button', { name: 'Lire les textes : Suivi 1' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Petit-déjeuner pris 5 jours sur 7.')).toBeInTheDocument();
    expect(screen.getByText('Préparer la collation la veille.')).toBeInTheDocument();
  });

  it('opens the session when its row is touched', async () => {
    renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={vi.fn()} />);
    fireEvent.click(await screen.findByText('23 octobre 2026'));
    expect(screen.getByText('Page : /consultations/c-2')).toBeInTheDocument();
  });

  it('starts the bilan from the empty sheet', async () => {
    vi.mocked(api.get).mockImplementation(apiGet({ ...ROUTES, [`/patients/${PATIENT_ID}/consultations`]: [] }) as never);
    const start = vi.fn();
    renderWithProviders(<SessionsPanel patientId={PATIENT_ID} onStart={start} />);
    expect(await screen.findByText('Aucune séance pour l’instant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Démarrer le bilan/ }));
    expect(start).toHaveBeenCalled();
  });
});
