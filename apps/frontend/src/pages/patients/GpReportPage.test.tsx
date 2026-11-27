import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GpReportDocumentDto } from '@vp/types';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { PATIENT_ID } from '../../test/patient-fixtures';

import GpReportPage from './GpReportPage';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../components/gp-reports/GpReportPdfDocument', () => ({
  renderGpReportPdf: vi.fn(async () => new Blob(['%PDF-'], { type: 'application/pdf' })),
}));
const mocked = vi.mocked(api);

const draft = {
  id: 'r-1',
  patientId: PATIENT_ID,
  authorId: 'u-1',
  date: '2026-11-22T00:00:00.000Z',
  content: 'Dr Laurent Garnier\n\nDocteur,\n\nSon poids est passé de 79 kg (IMC 31,25) à 76,5 kg (IMC 30,26).',
  status: 'DRAFT',
  sentAt: null,
  createdAt: '2026-11-22T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
  patient: { firstName: 'Martine', lastName: 'Roux', gpName: 'Dr Laurent Garnier' },
  letterhead: ['Valérie Dupont, diététicienne nutritionniste', '12 rue des Oliviers', 'N° ADELI : 139512345'],
} as GpReportDocumentDto;

const URL_REPORT = `/patients/${PATIENT_ID}/gp-reports/r-1`;

function renderPage(report: GpReportDocumentDto = draft) {
  mocked.get.mockImplementation((async (url: string) => {
    if (url === URL_REPORT || url === `${URL_REPORT}/document`) return { data: report };
    if (url === `/patients/${PATIENT_ID}/gp-reports`) return { data: [report] };
    throw new Error(`Unexpected GET ${url}`);
  }) as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[URL_REPORT]}>
        <Routes>
          <Route path="/patients/:id/gp-reports/:reportId" element={<GpReportPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function CurrentPath() {
  return <p>Page : {useLocation().pathname}</p>;
}

describe('GpReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.patch.mockImplementation((async (_url: string, body: Record<string, unknown>) => ({
      data: { ...draft, ...body, ...(body.status === 'SENT' ? { sentAt: '2026-11-22T15:00:00.000Z' } : {}) },
    })) as never);
  });

  it('shows the pre-filled draft on the practice’s letterhead', async () => {
    renderPage();
    const text = await screen.findByLabelText('Texte du compte rendu');
    expect(text).toHaveValue(draft.content);
    expect(screen.getByText('Valérie Dupont, diététicienne nutritionniste')).toBeInTheDocument();
    expect(screen.getByText('N° ADELI : 139512345')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compte rendu au médecin' })).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Martine Roux/ })).toHaveAttribute('href', `/patients/${PATIENT_ID}`);
  });

  it('saves her changes as she writes, and says so', async () => {
    renderPage();
    const text = await screen.findByLabelText('Texte du compte rendu');
    fireEvent.change(text, { target: { value: `${draft.content}\n\nElle a repris l’aquagym.` } });
    fireEvent.blur(text);
    await waitFor(() =>
      expect(mocked.patch).toHaveBeenCalledWith(URL_REPORT, { content: `${draft.content}\n\nElle a repris l’aquagym.` }),
    );
    expect(await screen.findByText(/Enregistré à/)).toBeInTheDocument();
  });

  it('exports the PDF (logged as a download), then marks the report as sent', async () => {
    const createObjectURL = vi.fn(() => 'blob:report');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    // jsdom cannot follow the download link
    const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderPage();
    await screen.findByLabelText('Texte du compte rendu');

    await userEvent.click(screen.getByRole('button', { name: /Télécharger le PDF/ }));
    await waitFor(() => expect(mocked.get).toHaveBeenCalledWith(`${URL_REPORT}/document`));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    save.mockRestore();

    await userEvent.click(screen.getByRole('button', { name: /Marquer comme envoyé/ }));
    await waitFor(() => expect(mocked.patch).toHaveBeenCalledWith(URL_REPORT, { status: 'SENT' }));
  });

  it('regenerates a draft only after a warning that the text is replaced', async () => {
    mocked.post.mockResolvedValue({ data: { ...draft, content: 'Nouveau brouillon' } });
    renderPage();
    await screen.findByLabelText('Texte du compte rendu');

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Régénérer/ }));
    expect(screen.getByText(/Les modifications que vous y avez faites seront perdues/)).toBeInTheDocument();
    expect(mocked.post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remplacer le texte' }));
    await waitFor(() => expect(mocked.post).toHaveBeenCalledWith(`${URL_REPORT}/regenerate`));
    await waitFor(() => expect(screen.getByLabelText('Texte du compte rendu')).toHaveValue('Nouveau brouillon'));
  });

  it('offers no regeneration once sent, but can go back to draft', async () => {
    renderPage({ ...draft, status: 'SENT', sentAt: '2026-11-20T15:00:00.000Z' } as GpReportDocumentDto);
    await screen.findByLabelText('Texte du compte rendu');
    expect(screen.getByText('Envoyé le 20 novembre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marquer comme envoyé/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    expect(screen.queryByRole('menuitem', { name: /Régénérer/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Repasser en brouillon/ }));
    await waitFor(() => expect(mocked.patch).toHaveBeenCalledWith(URL_REPORT, { status: 'DRAFT' }));
  });

  it('deletes the report after confirmation and goes back to the file', async () => {
    mocked.delete.mockResolvedValue({ data: undefined });
    renderPage();
    await screen.findByLabelText('Texte du compte rendu');

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Supprimer/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(mocked.delete).toHaveBeenCalledWith(URL_REPORT));
    expect(await screen.findByText(`Page : /patients/${PATIENT_ID}`)).toBeInTheDocument();
  });
});
