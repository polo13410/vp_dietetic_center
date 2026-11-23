import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { PATIENT_ID, ROUTES } from '../../test/patient-fixtures';

import PatientDetailPage from './PatientDetailPage';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), request: vi.fn() },
}));
vi.mock('../../hooks/useAuth', () => ({ useIsRole: () => false }));
const mocked = vi.mocked(api);

function Address() {
  const { search, hash } = useLocation();
  return <p data-testid="address">{`${search}${hash}`}</p>;
}

function renderPage(entry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/patients/:id"
            element={
              <>
                <PatientDetailPage />
                <Address />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PatientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The file's routes; everything else (appointments, invoices, documents, tasks…) is empty
    mocked.get.mockImplementation((async (url: string) => {
      const path = url.split('?')[0];
      return { data: path in ROUTES ? ROUTES[path as keyof typeof ROUTES] : [] };
    }) as never);
  });

  it('has her tabs, with « Mesures » after the medical file', async () => {
    renderPage(`/patients/${PATIENT_ID}`);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual([
      'Récapitulatif',
      'Dossier médical',
      'Mesures',
      'Suivi',
      'Factures',
      'Documents',
    ]);
    expect(screen.queryByText('Pour aller plus loin')).not.toBeInTheDocument();
  });

  it('opens the tab and the block named in the address (a reload keeps them)', async () => {
    renderPage(`/patients/${PATIENT_ID}?onglet=mesures#poids`);
    expect(await screen.findByRole('tab', { name: 'Mesures', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Frise des mesures' })).toBeInTheDocument();
    expect(document.getElementById('poids')).not.toBeNull();
  });

  it('follows a « Modifier » of the summary to the right tab and place', async () => {
    renderPage(`/patients/${PATIENT_ID}`);
    fireEvent.click(await screen.findByRole('link', { name: 'Modifier les mesures' }));
    expect(await screen.findByRole('tab', { name: 'Mesures', selected: true })).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('?onglet=mesures#poids');

    await userEvent.click(screen.getByRole('tab', { name: 'Récapitulatif' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Modifier les aversions et goûts' }));
    expect(await screen.findByRole('tab', { name: 'Dossier médical', selected: true })).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('aversions')).not.toBeNull());
    expect(document.getElementById('identite')).not.toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Récapitulatif' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Modifier les tâches de ce patient' }));
    expect(await screen.findByRole('tab', { name: /^Suivi/, selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'À faire pour ce patient' })).toBeInTheDocument();
    expect(document.getElementById('a-faire')).not.toBeNull();
  });

  it('keeps the access history, the PDF export and archiving in the « … » menu', async () => {
    renderPage(`/patients/${PATIENT_ID}`);
    const more = await screen.findByRole('button', { name: 'Plus d’actions' });
    await userEvent.click(more);
    expect(await screen.findByRole('menuitem', { name: 'Historique des accès' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Exporter le dossier en PDF' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Archiver le patient' })).toBeInTheDocument();
  });
});
