import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { PatientCoverageDto, PayerInvoiceListItemDto, PayerOverviewDto, PayerPreviewDto } from '@vp/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { payerInvoice } from '../../test/invoice-fixtures';
import { apiGet, PATIENT_ID, renderWithProviders, ROUTES, sessions } from '../../test/patient-fixtures';
import { PatientRecap } from '../patient-file/PatientRecap';

import { PatientCoverages } from './PatientCoverages';
import { PayersPanel } from './PayersPanel';
import { SessionDiscount, SessionSplit } from './SessionDiscount';
import { SessionInvoice } from './SessionInvoice';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const mutuelle: PayerOverviewDto = {
  id: 'payer-1',
  practitionerId: 'u-1',
  name: 'Mutuelle Horizon Santé',
  address: '8 boulevard de la Liberté',
  zipCode: '13001',
  city: 'Marseille',
  contact: 'Service prestations',
  conventionReference: 'CONV-2026-114',
  billingRhythm: 'MONTHLY',
  rhythmMonths: null,
  notes: null,
  archivedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  _count: { coverages: 2 },
  nextPeriod: { from: '2026-10-01', to: '2026-10-31', ended: true, sessionCount: 2, totalCents: 5000 },
  pending: { count: 1, totalCents: 5000 },
};

const preview: PayerPreviewDto = {
  from: '2026-10-01',
  to: '2026-10-31',
  totalCents: 5000,
  sessions: [
    {
      id: 'c-3',
      date: '2026-10-15T09:00:00.000Z',
      formulaLabel: 'Suivi',
      payerCents: 3000,
      patient: { id: PATIENT_ID, firstName: 'Martine', lastName: 'Roux' },
      coverage: { coverageNumber: 'PEC-0042' },
    },
    {
      id: 'c-9',
      date: '2026-10-20T09:00:00.000Z',
      formulaLabel: 'Bilan',
      payerCents: 2000,
      patient: { id: 'p-2', firstName: 'Paul', lastName: 'Garcia' },
      coverage: null,
    },
  ],
};

const listed: PayerInvoiceListItemDto = { ...payerInvoice, _count: { lines: 2 }, mismatches: null };

describe('PayersPanel (« Organismes »)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockImplementation(
      apiGet({
        '/payers': [mutuelle],
        '/payer-invoices': [listed],
        [`/payers/${mutuelle.id}/preview`]: preview,
      }) as never,
    );
  });

  it('shows each payer with its next period to bill, and its invoices « en attente »', async () => {
    renderWithProviders(<PayersPanel />);
    const card = (await screen.findByRole('heading', { name: 'Mutuelle Horizon Santé' })).closest('li')!;
    expect(card).toHaveTextContent('13001 Marseille · facturé tous les mois · convention CONV-2026-114');
    expect(card).toHaveTextContent('Prochaine période : du 1er au 31 octobre 2026');
    expect(card).toHaveTextContent('Terminée, à facturer');
    expect(card).toHaveTextContent('2 séances · 50,00 €');
    expect(card).toHaveTextContent('1 facture en attente de règlement');

    const invoices = screen.getAllByRole('table').at(-1)!;
    expect(within(invoices).getByText('2026-0017')).toBeInTheDocument();
    expect(within(invoices).getByText('du 1er au 30 novembre 2026')).toBeInTheDocument();
    expect(within(invoices).getByText('En attente')).toBeInTheDocument();
  });

  it('« Préparer la facture »: the proposed period, its sessions (nothing medical), then the invoice', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...payerInvoice, number: '2026-0018' } });
    renderWithProviders(<PayersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Préparer la facture' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Du')).toHaveValue('2026-10-01');
    expect(within(dialog).getByLabelText('Au')).toHaveValue('2026-10-31');
    const table = await within(dialog).findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(table).toHaveTextContent('Martine Roux');
    expect(table).toHaveTextContent('N° PEC-0042');
    expect(table).toHaveTextContent('Total · 2 séances50,00 €');

    // The end of the period can be changed
    fireEvent.change(within(dialog).getByLabelText('Au'), { target: { value: '2026-10-25' } });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(`/payers/${mutuelle.id}/preview`, { params: { from: '2026-10-01', to: '2026-10-25' } }),
    );
    const issue = within(dialog).getByRole('button', { name: 'Émettre la facture' });
    await waitFor(() => expect(issue).toBeEnabled());
    fireEvent.click(issue);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/payers/${mutuelle.id}/invoices`, { from: '2026-10-01', to: '2026-10-25' }),
    );
    expect(await within(dialog).findByRole('button', { name: 'Télécharger la facture' })).toBeInTheDocument();
  });

  it('records the payment of a payer invoice (« réglée le … »)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...payerInvoice, paidAt: '2026-12-15T00:00:00.000Z' } });
    renderWithProviders(<PayersPanel />);
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Actions de la facture n° 2026-0017' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Indiquer le règlement' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Réglée le'), { target: { value: '2026-12-15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le règlement' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/payer-invoices/${payerInvoice.id}/paid`, { paidOn: '2026-12-15' }));
  });

  it('says when an invoice no longer matches its sessions', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({ '/payers': [mutuelle], '/payer-invoices': [{ ...listed, mismatches: { deleted: 0, changed: 1, added: 2 } }] }) as never,
    );
    renderWithProviders(<PayersPanel />);
    expect(
      await screen.findByRole('button', { name: /Ne correspond plus aux séances : 1 séance modifiée, 2 séances à ajouters?/ }),
    ).toBeInTheDocument();
  });
});

describe('PatientCoverages (Factures tab of the file)', () => {
  const coverage: PatientCoverageDto = {
    id: 'cov-1',
    patientId: PATIENT_ID,
    payerId: mutuelle.id,
    payer: { id: mutuelle.id, name: mutuelle.name, archivedAt: null },
    kind: 'PERCENT',
    value: 60,
    maxSessions: 10,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-10-31T00:00:00.000Z',
    coverageNumber: 'PEC-0042',
    coveredSessions: 3,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it('reads the coverage: payer, share, caps, number and what it already paid', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({ [`/patients/${PATIENT_ID}/coverages`]: [coverage], '/payers': [mutuelle] }) as never,
    );
    renderWithProviders(<PatientCoverages patientId={PATIENT_ID} />);
    expect(await screen.findByText('60 % de chaque séance, 10 séances au plus, du 1er novembre 2026 au 31 octobre 2027')).toBeInTheDocument();
    expect(screen.getByText('N° de prise en charge PEC-0042 · 3 séances sur 10 prises en charge')).toBeInTheDocument();
  });

  it('adds a fixed amount per séance', async () => {
    vi.mocked(api.get).mockImplementation(apiGet({ [`/patients/${PATIENT_ID}/coverages`]: [], '/payers': [mutuelle] }) as never);
    vi.mocked(api.post).mockResolvedValue({ data: coverage });
    renderWithProviders(<PatientCoverages patientId={PATIENT_ID} />);
    expect(await screen.findByText('Aucune : le patient paie ses séances.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une prise en charge' }));
    await screen.findByRole('option', { name: mutuelle.name });
    fireEvent.change(screen.getByLabelText(/Organisme/), { target: { value: mutuelle.id } });
    fireEvent.change(screen.getByLabelText(/Part prise en charge/), { target: { value: '22,50' } });
    fireEvent.change(screen.getByLabelText(/Nombre de séances/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la prise en charge' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/coverages`, {
        payerId: mutuelle.id,
        kind: 'AMOUNT',
        value: 2250,
        maxSessions: 5,
        startDate: null,
        endDate: null,
        coverageNumber: null,
      }),
    );
  });

  it('is read in the summary of the file, with « Modifier » leading to the Factures tab', async () => {
    vi.mocked(api.get).mockImplementation(apiGet({ ...ROUTES, [`/patients/${PATIENT_ID}/coverages`]: [coverage] }) as never);
    renderWithProviders(<PatientRecap patientId={PATIENT_ID} links />);
    const block = (await screen.findByRole('heading', { name: 'Prise en charge' })).closest('section')!;
    expect(block).toHaveTextContent('Mutuelle Horizon Santé');
    expect(within(block).getByRole('link', { name: 'Modifier la prise en charge' })).toHaveAttribute(
      'href',
      `/patients/${PATIENT_ID}?onglet=factures#prise-en-charge`,
    );
    // Nothing to edit in the summary itself
    expect(within(block).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('refuses a percentage above 100', async () => {
    vi.mocked(api.get).mockImplementation(apiGet({ [`/patients/${PATIENT_ID}/coverages`]: [], '/payers': [mutuelle] }) as never);
    renderWithProviders(<PatientCoverages patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une prise en charge' }));
    await screen.findByRole('option', { name: mutuelle.name });
    fireEvent.change(screen.getByLabelText(/Organisme/), { target: { value: mutuelle.id } });
    fireEvent.click(screen.getByRole('button', { name: 'En %' }));
    fireEvent.change(screen.getByLabelText(/Part prise en charge/), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la prise en charge' }));
    expect(await screen.findByText('Un pourcentage entier, de 1 à 100.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('the séance: discount, split and patient invoice (lot 16)', () => {
  // « Suivi 2 », 60 € with a 10 € discount, 30 € paid by the mutuelle: 20 € for Martine
  const covered = {
    ...sessions[0],
    priceCents: 6000,
    discountKind: 'AMOUNT' as const,
    discountValue: 1000,
    discountReason: 'geste',
    discountCents: 1000,
    netCents: 5000,
    payerCents: 3000,
    patientCents: 2000,
    payerId: mutuelle.id,
    payer: { id: mutuelle.id, name: mutuelle.name },
  };

  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
  });

  it('shows the split next to the price', () => {
    renderWithProviders(<SessionSplit session={covered} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Prix60,00 €Remise-10,00 €Net50,00 €Pris en charge par Mutuelle Horizon Santé30,00 €À payer par le patient20,00 €',
    );
  });

  it('a free séance needs no invoice; one paid in full by the payer needs no patient invoice', () => {
    const { unmount } = renderWithProviders(
      <SessionSplit session={{ ...covered, discountCents: 6000, netCents: 0, payerCents: 0, patientCents: 0 }} />,
    );
    expect(screen.getByText('Séance offerte : pas de facture à faire.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<SessionSplit session={{ ...covered, payerCents: 5000, patientCents: 0 }} />);
    expect(screen.getByText(/Prise en charge en totalité par Mutuelle Horizon Santé/)).toBeInTheDocument();
  });

  it('saves a discount in % with its reason, as she types', async () => {
    renderWithProviders(<SessionDiscount session={sessions[0]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une remise' }));
    fireEvent.click(screen.getByRole('button', { name: '%' }));
    fireEvent.change(screen.getByLabelText('Remise'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Motif/), { target: { value: 'tarif solidaire' } });
    fireEvent.blur(screen.getByLabelText(/Motif/));
    await waitFor(() =>
      expect(api.patch).toHaveBeenLastCalledWith(`/consultations/${sessions[0].id}`, {
        discountKind: 'PERCENT',
        discountValue: 30,
        discountReason: 'tarif solidaire',
      }),
    );
  });

  it('is prefilled with the discount of the séance, and can be removed', async () => {
    renderWithProviders(<SessionDiscount session={covered} />);
    expect(screen.getByLabelText('Remise')).toHaveValue('10,00');
    expect(screen.getByLabelText(/Motif/)).toHaveValue('geste');
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la remise' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/consultations/${sessions[0].id}`, {
        discountKind: null,
        discountValue: null,
        discountReason: null,
      }),
    );
  });

  it('« Faire la facture » bills the patient part, and names the payer invoice of the séance', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({
        [`/consultations/${covered.id}/invoices`]: {
          current: null,
          mismatches: [],
          history: [],
          payerInvoice: { id: 'i-17', number: '2026-0017', payerName: mutuelle.name, issuedAt: '2026-12-01T10:00:00.000Z' },
        },
      }) as never,
    );
    renderWithProviders(<SessionInvoice session={covered} />);
    expect(await screen.findByText(/Pas encore de facture pour cette séance/)).toHaveTextContent('20,00 €');
    expect(screen.getByText('La part de Mutuelle Horizon Santé est sur sa facture n° 2026-0017.')).toBeInTheDocument();
  });

  it('offers no « Faire la facture » for a free séance', async () => {
    vi.mocked(api.get).mockImplementation(
      apiGet({ [`/consultations/${covered.id}/invoices`]: { current: null, mismatches: [], history: [], payerInvoice: null } }) as never,
    );
    renderWithProviders(<SessionInvoice session={{ ...covered, discountCents: 6000, netCents: 0, payerCents: 0, patientCents: 0 }} />);
    expect(await screen.findByText('Séance offerte : pas de facture à faire.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Faire la facture' })).not.toBeInTheDocument();
  });
});
