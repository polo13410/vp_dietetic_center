import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import type { Consultation } from '../../lib/patient-file';
import { replacement } from '../../test/invoice-fixtures';
import { apiGet, PATIENT_ID, ROUTES, sessions } from '../../test/patient-fixtures';

import { SessionEndDialog } from './SessionEndDialog';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { get, post } = vi.mocked(api);

/** « Suivi 2 » of the test patient, just ended: 50 €, not invoiced yet */
const ended: Consultation = { ...sessions[0], patient: { id: PATIENT_ID, firstName: 'Martine', lastName: 'Roux' } };

function mockApi(session: Consultation, current: unknown = null) {
  get.mockImplementation(
    apiGet({
      ...ROUTES,
      [`/consultations/${session.id}`]: session,
      [`/consultations/${session.id}/invoices`]: { current, mismatches: [], history: [] },
      '/patients': { data: [] },
    }) as never,
  );
}

function State() {
  return <p data-testid="state">{JSON.stringify(useLocation().state)}</p>;
}

function renderOnFile(state: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: `/patients/${PATIENT_ID}`, state }]}>
        <SessionEndDialog patientId={PATIENT_ID} />
        <State />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SessionEndDialog', () => {
  beforeEach(() => {
    post.mockReset();
    mockApi(ended);
  });

  it('is not shown when the file is opened otherwise', () => {
    renderOnFile(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the invoice and the next appointment after « Terminer la séance »', async () => {
    renderOnFile({ endedSession: ended.id });
    const dialog = await screen.findByRole('dialog', { name: /Séance terminée/ });
    expect(await within(dialog).findByText('Suivi 2 de Martine Roux : tout est enregistré.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Faire la facture/ })).toHaveTextContent('50,00 €');
    expect(within(dialog).getByRole('button', { name: /Prendre le prochain rendez-vous/ })).toBeInTheDocument();
  });

  it('makes the invoice of the séance', async () => {
    post.mockResolvedValue({ data: { ...replacement, number: '2026-0015' } });
    renderOnFile({ endedSession: ended.id });
    const button = await screen.findByRole('button', { name: /Faire la facture/ });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/consultations/${ended.id}/invoice`));
  });

  it('says when the invoice is already made, and offers it to download', async () => {
    mockApi(ended, replacement);
    renderOnFile({ endedSession: ended.id });
    expect(await screen.findByText(new RegExp(`Facture n° ${replacement.number} faite`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger la facture/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Faire la facture/ })).not.toBeInTheDocument();
  });

  it('asks for the formula first', async () => {
    const free = { ...ended, formulaId: null, formulaLabel: null, priceCents: null };
    mockApi(free);
    renderOnFile({ endedSession: free.id });
    expect(await screen.findByText(/Choisissez d’abord la formule/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faire la facture/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'revenir à la séance' })).toHaveAttribute('href', `/consultations/${free.id}`);
  });

  it('opens the appointment form for the patient, and does not come back', async () => {
    renderOnFile({ endedSession: ended.id });
    fireEvent.click(await screen.findByRole('button', { name: /Prendre le prochain rendez-vous/ }));
    expect(await screen.findByRole('dialog', { name: 'Nouveau rendez-vous' })).toBeInTheDocument();
    expect(screen.queryByText('Séance terminée')).not.toBeInTheDocument();
    // A reload or « back » does not open it again
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });
});
