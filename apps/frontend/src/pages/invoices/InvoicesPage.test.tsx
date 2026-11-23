import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { InvoiceListDto } from '@vp/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { bilanInvoice, cancelledInvoice, creditNote, replacement } from '../../test/invoice-fixtures';
import { renderWithProviders } from '../../test/patient-fixtures';

import InvoicesPage from './InvoicesPage';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn() } }));

const totals = (collectedCents: number, count: number) => ({
  collectedCents,
  unpaidCents: 0,
  count,
  byPaymentMethod: { CASH: 0, CHECK: collectedCents, CARD: 0, TRANSFER: 0, NONE: 0 },
  patients: { invoicedCents: collectedCents, collectedCents, unpaidCents: 0, count },
  payers: { invoicedCents: 0, collectedCents: 0, unpaidCents: 0, count: 0 },
});

const quarter: InvoiceListDto = {
  from: '2026-07-01',
  to: '2026-09-30',
  invoices: [bilanInvoice, cancelledInvoice, creditNote, replacement],
  totals: {
    ...totals(11000, 2),
    unpaidCents: 2500,
    patients: { invoicedCents: 13500, collectedCents: 11000, unpaidCents: 2500, count: 2 },
    byMonth: [
      { month: '2026-09', ...totals(6000, 1) },
      { month: '2026-11', ...totals(5000, 1) },
    ],
  },
};

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/invoices/export') return { data: new Blob(['csv']) };
      return { data: quarter };
    });
  });

  it('shows the period’s totals, by payment method and by month, then every document', async () => {
    renderWithProviders(<InvoicesPage />, '/invoices');
    await screen.findByText('Encaissé');
    // The current month by default
    expect(api.get).toHaveBeenCalledWith('/invoices', { params: expect.objectContaining({ from: expect.stringMatching(/-01$/) }) });

    fireEvent.click(screen.getByRole('button', { name: 'Trimestre' }));
    expect(await screen.findByText('Par mois')).toBeInTheDocument();
    expect(screen.getAllByText('Encaissé')[0].parentElement).toHaveTextContent('Encaissé110,00 €2 factures en vigueur');
    expect(screen.getAllByText('Chèque')[0].parentElement).toHaveTextContent('Chèque110,00 €');
    expect(screen.getByText(/Non réglé par les patients : 25,00 €/)).toHaveTextContent(
      'Non réglé par les patients : 25,00 € — pas compté dans l’encaissé.',
    );
    expect(screen.getByText('septembre 2026')).toBeInTheDocument();

    const table = screen.getAllByRole('table').at(-1)!;
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText('Annulée par l’avoir A-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Remplace la 2026-0010')).toBeInTheDocument();
  });

  it('moves to the previous period', async () => {
    renderWithProviders(<InvoicesPage />, '/invoices');
    await screen.findByText('Encaissé');
    fireEvent.click(screen.getByRole('button', { name: 'Année' }));
    fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
    const lastYear = new Date().getFullYear() - 1;
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/invoices', { params: { from: `${lastYear}-01-01`, to: `${lastYear}-12-31` } }),
    );
    expect(screen.getByRole('button', { name: 'Revenir à aujourd’hui' })).toBeInTheDocument();
  });

  it('exports the period for the accountant', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithProviders(<InvoicesPage />, '/invoices');
    await screen.findByText('Encaissé');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter pour le comptable' }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/invoices/export', {
        params: expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
        responseType: 'blob',
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
