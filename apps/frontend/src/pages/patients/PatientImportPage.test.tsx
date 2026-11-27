import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import type { PatientImportPreviewDto } from '../../lib/patient-import';
import { DRAFT } from '../../test/import-fixtures';

import PatientImportPage from './PatientImportPage';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { post } = vi.mocked(api);

const PREVIEW: PatientImportPreviewDto = {
  draft: DRAFT,
  warnings: ['Bilan (18/08/2026) est après Suivi 1 (10/09/2025) : vérifiez les dates.'],
  ignored: ['Feuille « Facture »'],
  duplicates: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientImportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pick = (name = 'Polo.numbers') =>
  fireEvent.change(screen.getByLabelText('Fichier du patient'), {
    target: { files: [new File(['PK'], name)] },
  });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('PatientImportPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the file, lets her correct the name and a date, then imports it', async () => {
    post.mockResolvedValueOnce({ data: PREVIEW });
    renderPage();
    pick();

    expect(await screen.findByText(/est après Suivi 1/)).toBeInTheDocument();
    expect(post.mock.calls[0][0]).toBe('/patients/import/preview');
    expect((post.mock.calls[0][1] as FormData).get('file')).toBeInstanceOf(File);
    // The API client's default is JSON: a file needs multipart
    expect(post.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(screen.getByText('Santé, maladies')).toBeInTheDocument();
    expect(screen.getByText(/Non repris : Feuille « Facture »/)).toBeInTheDocument();

    // The first name is missing in her file: asked for before anything is sent
    click('Importer le dossier');
    expect(await screen.findByText('Indiquez le prénom.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Paul' } });
    fireEvent.change(screen.getByLabelText('Date de Bilan'), { target: { value: '2025-08-18' } });
    post.mockResolvedValueOnce({ data: { id: 'p-new', sessions: 3 } });
    click('Importer le dossier');

    expect(await screen.findByText(/le patient est créé avec 3 séances/)).toBeInTheDocument();
    const [path, body] = post.mock.calls[1];
    expect(path).toBe('/patients/import');
    expect(body).toMatchObject({ firstName: 'Paul', lastName: 'Polo', allowDuplicate: false });
    expect((body as typeof DRAFT).sessions[0].date).toBe('2025-08-18');
    expect(screen.getByRole('link', { name: 'Ouvrir son dossier' })).toHaveAttribute('href', '/patients/p-new');
  });

  it('holds the import while a patient with that name exists, until she says it is another one', async () => {
    post.mockResolvedValueOnce({
      data: { ...PREVIEW, draft: { ...DRAFT, firstName: 'Paul' }, duplicates: [{ id: 'p-0', firstName: 'Paul', lastName: 'Polo' }] },
    });
    renderPage();
    pick();

    const importButton = await screen.findByRole('button', { name: 'Importer le dossier' });
    expect(importButton).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Paul Polo' })).toHaveAttribute('href', '/patients/p-0');

    fireEvent.click(screen.getByLabelText(/importer quand même/));
    post.mockResolvedValueOnce({ data: { id: 'p-new', sessions: 3 } });
    click('Importer le dossier');
    await waitFor(() => expect(post.mock.calls[1]?.[1]).toMatchObject({ allowDuplicate: true }));
  });

  it('refuses another kind of file, and shows why the server could not read one', async () => {
    renderPage();
    pick('Polo.pdf');
    expect(screen.getByRole('alert')).toHaveTextContent('Choisissez un fichier Numbers');
    expect(post).not.toHaveBeenCalled();

    post.mockRejectedValueOnce({ response: { data: { message: 'Aucun tableau de dossier patient trouvé.' } } });
    pick();
    expect(await screen.findByRole('alert')).toHaveTextContent('Aucun tableau de dossier patient trouvé.');
  });

  it('says nothing was saved when the import fails', async () => {
    post.mockResolvedValueOnce({ data: { ...PREVIEW, draft: { ...DRAFT, firstName: 'Paul' } } });
    renderPage();
    pick();
    await screen.findByText('Séances');
    post.mockRejectedValueOnce(new Error('network'));
    click('Importer le dossier');
    expect(await screen.findByRole('alert')).toHaveTextContent('rien n’a été enregistré');
  });
});
