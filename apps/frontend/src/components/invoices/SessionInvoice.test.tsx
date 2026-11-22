import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { SessionInvoicesDto } from '@vp/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { cancelledInvoice, creditNote, replacement } from '../../test/invoice-fixtures';
import { apiGet, PATIENT_ID, renderWithProviders, sessions } from '../../test/patient-fixtures';

import { PatientInvoices } from './PatientInvoices';
import { SessionInvoice } from './SessionInvoice';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

/** « Suivi 2 » of the test patient: 50 €, not paid yet */
const session = sessions[0];
const formulas = [
  { id: 'f', label: 'Suivi', priceCents: 5000, position: 1, archivedAt: null },
  { id: 'b', label: 'Bilan', priceCents: 6000, position: 0, archivedAt: null },
];

function mockSession(state: SessionInvoicesDto) {
  vi.mocked(api.get).mockImplementation(
    apiGet({ [`/consultations/${session.id}/invoices`]: state, '/me/formulas': formulas }) as never,
  );
}

describe('SessionInvoice', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('issues the invoice of a session not invoiced yet (« Faire la facture »)', async () => {
    mockSession({ current: null, mismatches: [], history: [] });
    vi.mocked(api.post).mockResolvedValue({ data: { ...replacement, number: '2026-0015' } });
    renderWithProviders(<SessionInvoice session={session} />);

    expect(await screen.findByText(/Pas encore de facture pour cette séance/)).toHaveTextContent('50,00 €');
    fireEvent.click(screen.getByRole('button', { name: 'Faire la facture' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/consultations/${session.id}/invoice`));
  });

  it('asks for the formula first', async () => {
    mockSession({ current: null, mismatches: [], history: [] });
    renderWithProviders(<SessionInvoice session={{ ...session, formulaId: null, formulaLabel: null, priceCents: null }} />);
    expect(await screen.findByText('Choisissez la formule de la séance (avec son prix) pour faire la facture.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faire la facture' })).toBeDisabled();
  });

  it('saves what is invoiced: payment method, formula, day', async () => {
    mockSession({ current: null, mismatches: [], history: [] });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderWithProviders(<SessionInvoice session={session} />);
    await screen.findByRole('option', { name: 'Bilan · 60,00 €' });

    fireEvent.change(screen.getByLabelText('Moyen de paiement'), { target: { value: 'CARD' } });
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith(`/consultations/${session.id}`, { paymentMethod: 'CARD' }));
    fireEvent.change(screen.getByLabelText('Formule'), { target: { value: 'b' } });
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith(`/consultations/${session.id}`, { formulaId: 'b' }));
    fireEvent.change(screen.getByLabelText('Date de la séance'), { target: { value: '2026-11-16' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(3));
    const { date } = vi.mocked(api.patch).mock.lastCall![1] as { date: string };
    // Same time of day, another day
    expect(new Date(date).getDate()).toBe(16);
    expect(new Date(date).getHours()).toBe(new Date(session.date).getHours());
  });

  it('says when the invoice no longer matches the session, and corrects it', async () => {
    mockSession({ current: replacement, mismatches: ['price', 'paymentMethod'], history: [] });
    vi.mocked(api.post).mockResolvedValue({ data: { ...replacement, number: '2026-0015' } });
    renderWithProviders(<SessionInvoice session={session} />);

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(
      'La facture n° 2026-0014 ne correspond plus à la séance : le prix et le moyen de paiement ont changé.',
    );
    fireEvent.click(within(banner).getByRole('button', { name: 'Corriger la facture' }));
    const dialog = await screen.findByRole('dialog', { name: 'Corriger la facture n° 2026-0014 ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Corriger la facture' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/invoices/i-14/correct'));
  });

  it('cancels the invoice with an optional reason (« Annuler la facture »)', async () => {
    mockSession({ current: replacement, mismatches: [], history: [] });
    vi.mocked(api.post).mockResolvedValue({ data: { ...creditNote, number: 'A-2026-0002' } });
    renderWithProviders(<SessionInvoice session={session} />);

    expect(await screen.findByText('Facture n° 2026-0014')).toBeInTheDocument();
    expect(screen.getByText('Acquittée')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la facture' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Séance offerte' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler la facture' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/invoices/i-14/cancel', { reason: 'Séance offerte' }));
  });

  it('lists the cancelled invoice and its credit note, struck through, with their links', async () => {
    mockSession({ current: replacement, mismatches: [], history: [creditNote, cancelledInvoice] });
    renderWithProviders(<SessionInvoice session={session} />);

    expect(await screen.findByText('Facture n° 2026-0010')).toHaveClass('line-through');
    expect(screen.getByText('Avoir n° A-2026-0001')).toHaveClass('line-through');
    expect(screen.getByText('-50,00 € · Annule la 2026-0010')).toBeInTheDocument();
    expect(screen.getByText('50,00 € · Annulée par l’avoir A-2026-0001 · Remplacée par la 2026-0014')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Télécharger l’avoir n° A-2026-0001' })).toBeInTheDocument();
  });
});

describe('PatientInvoices', () => {
  it('lists the patient’s invoices with what they paid', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({
        [`/patients/${PATIENT_ID}/invoices`]: {
          invoices: [replacement, creditNote, cancelledInvoice],
          totals: { collectedCents: 5000, unpaidCents: 0, count: 1, byPaymentMethod: {} },
        },
      }) as never,
    );
    renderWithProviders(<PatientInvoices patientId={PATIENT_ID} />);
    expect(await screen.findByText('Réglé : 50,00 €')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[2]).getByText('2026-0010')).toHaveClass('line-through');
    expect(within(rows[2]).getByText('Annulée')).toBeInTheDocument();
  });

  it('explains where invoices come from when there is none', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({ [`/patients/${PATIENT_ID}/invoices`]: { invoices: [], totals: { collectedCents: 0, unpaidCents: 0, count: 0 } } }) as never,
    );
    renderWithProviders(<PatientInvoices patientId={PATIENT_ID} />);
    expect(await screen.findByText('Aucune facture pour l’instant')).toBeInTheDocument();
  });
});
