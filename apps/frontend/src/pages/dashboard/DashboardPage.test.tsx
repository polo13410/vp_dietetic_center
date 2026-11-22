import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { DashboardAppointmentDto, DashboardSummary, SessionToInvoiceDto, TaskDto, UserRole } from '@vp/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { renderWithProviders } from '../../test/patient-fixtures';

import DashboardPage from './DashboardPage';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const NOW = new Date('2026-11-20T11:00:00');

const appointment = (
  id: string,
  time: string,
  firstName: string,
  extra: Partial<DashboardAppointmentDto> = {},
): DashboardAppointmentDto => ({
  id,
  patientId: `p-${id}`,
  patient: { id: `p-${id}`, firstName, lastName: 'Test' },
  practitionerId: 'u-1',
  startAt: new Date(`2026-11-20T${time}:00`).toISOString(),
  endAt: new Date(`2026-11-20T${time}:00`).toISOString(),
  duration: 45,
  type: 'IN_PERSON' as DashboardAppointmentDto['type'],
  status: 'CONFIRMED' as DashboardAppointmentDto['status'],
  reason: null,
  consultation: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...extra,
});

const task = (id: string, title: string, dueAt: string | null): TaskDto => ({
  id,
  title,
  description: null,
  patientId: 'p-9',
  patient: { id: 'p-9', firstName: 'Claire', lastName: 'Bernard' },
  appointmentId: null,
  assignedToId: 'u-1',
  status: 'PENDING' as TaskDto['status'],
  priority: 'MEDIUM' as TaskDto['priority'],
  dueAt,
  completedAt: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
});

const toInvoice = (id: string, firstName: string, extra: Partial<SessionToInvoiceDto> = {}): SessionToInvoiceDto => ({
  id,
  date: '2026-11-15T09:00:00.000Z',
  formulaLabel: 'Suivi',
  priceCents: 5000,
  paymentMethod: 'CHECK' as SessionToInvoiceDto['paymentMethod'],
  patient: { id: `p-${id}`, firstName, lastName: 'Test' },
  ...extra,
});

const summary: DashboardSummary = {
  todayAppointments: [
    appointment('a1', '09:00', 'Lucas', { status: 'COMPLETED' as DashboardAppointmentDto['status'], consultation: { id: 'c-1' } }),
    appointment('a2', '14:00', 'Thomas', { reason: 'Suivi' }),
    appointment('a3', '16:00', 'Emma', { status: 'CANCELLED' as DashboardAppointmentDto['status'] }),
  ],
  followUps: [
    {
      patient: { id: 'p-f1', firstName: 'Claire', lastName: 'Bernard', phone: '07 11 22 33 44', email: null },
      lastSessionAt: '2026-10-02T09:00:00.000Z',
      daysSince: 49,
    },
    { patient: { id: 'p-f2', firstName: 'Paul', lastName: 'Martin', phone: null, email: null }, lastSessionAt: null, daysSince: null },
  ],
  tasks: [task('t-1', 'Relancer pour un rendez-vous', '2026-11-18T00:00:00.000Z'), task('t-2', 'Envoyer les menus', null)],
};

const EMPTY: DashboardSummary = { todayAppointments: [], followUps: [], tasks: [] };

function serve(data: DashboardSummary, sessionsToInvoice: SessionToInvoiceDto[] = [toInvoice('c-8', 'Martine')]) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === '/dashboard/summary') return { data };
    if (url === '/invoices/to-issue') return { data: sessionsToInvoice };
    // The appointment dialog looks up patients
    return { data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } };
  });
}

function login(role: 'PRATICIENNE' | 'ASSISTANTE' = 'PRATICIENNE') {
  useAuthStore.setState({
    user: { id: 'u-1', email: 'v@example.com', firstName: 'Valérie', lastName: 'Perrot', role: role as UserRole },
    isAuthenticated: true,
  });
}

/** The section whose title is `title`. */
const section = (title: string) => within(screen.getByRole('heading', { name: title }).closest('section')!);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
    login();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the four sections and nothing left from « Séances à finaliser »', async () => {
    serve(summary);
    renderWithProviders(<DashboardPage />, '/dashboard');
    expect(await screen.findByRole('heading', { name: 'Bonjour, Valérie' })).toBeInTheDocument();
    for (const title of ['Aujourd’hui', 'À relancer', 'Factures à faire', 'Tâches']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    // Cancelled appointments are not counted
    expect(screen.getByText(/2 rendez-vous aujourd’hui/)).toBeInTheDocument();
    expect(screen.queryByText(/finalis/i)).not.toBeInTheDocument();
  });

  describe('Aujourd’hui', () => {
    it('shows each appointment as a card: time, patient, and the session button', async () => {
      serve(summary);
      renderWithProviders(<DashboardPage />, '/dashboard');
      const today = within((await screen.findByRole('heading', { name: 'Aujourd’hui' })).closest('section')!);
      const cards = today.getAllByRole('listitem');
      expect(cards).toHaveLength(3);

      // Session started: reopen it
      expect(cards[0]).toHaveTextContent('9 h 00');
      expect(cards[0]).toHaveTextContent('Séance commencée');
      expect(within(cards[0]).getByRole('link', { name: 'Rouvrir' })).toHaveAttribute('href', '/consultations/c-1');

      // Next to see: start it
      expect(cards[1]).toHaveTextContent('14 h 00');
      expect(cards[1]).toHaveTextContent('À suivre');
      expect(within(cards[1]).getByRole('link', { name: 'Thomas Test' })).toHaveAttribute('href', '/appointments/a2');

      // Cancelled: no action
      expect(cards[2]).toHaveTextContent('Annulé');
      expect(within(cards[2]).queryByRole('button')).not.toBeInTheDocument();
    });

    it('starts the session of the appointment and opens it', async () => {
      serve(summary);
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'c-new' } });
      renderWithProviders(<DashboardPage />, '/dashboard');
      fireEvent.click(await screen.findByRole('button', { name: 'Démarrer la séance' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/patients/p-a2/consultations', { appointmentId: 'a2' }),
      );
      expect(await screen.findByText('Page : /consultations/c-new')).toBeInTheDocument();
    });
  });

  describe('À relancer', () => {
    it('lists patients with how long since their last session', async () => {
      serve(summary);
      renderWithProviders(<DashboardPage />, '/dashboard');
      await screen.findByText('Aucune séance pour l’instant');
      const list = section('À relancer');
      expect(list.getByText(/Dernière séance il y a 7 semaines/)).toBeInTheDocument();
      expect(list.getByText('Aucune séance pour l’instant')).toBeInTheDocument();
      expect(list.getByRole('link', { name: '07 11 22 33 44' })).toHaveAttribute('href', 'tel:0711223344');
    });

    it('books an appointment for the patient from « Prendre rendez-vous »', async () => {
      serve(summary);
      renderWithProviders(<DashboardPage />, '/dashboard');
      await screen.findByText('Aucune séance pour l’instant');
      fireEvent.click(section('À relancer').getAllByRole('button', { name: 'Prendre rendez-vous' })[0]);
      expect(await screen.findByRole('dialog', { name: 'Nouveau rendez-vous' })).toBeInTheDocument();
    });
  });

  describe('Factures à faire', () => {
    it('issues the invoice of a session in one tap', async () => {
      serve(summary);
      vi.mocked(api.post).mockResolvedValue({ data: { id: 'i-1', number: '2026-0042' } });
      renderWithProviders(<DashboardPage />, '/dashboard');
      await screen.findByText('Martine Test');
      const invoices = section('Factures à faire');
      expect(invoices.getByText('1 séance sans facture.')).toBeInTheDocument();
      expect(invoices.getByText(/15 novembre · Suivi 50 €/)).toBeInTheDocument();
      fireEvent.click(invoices.getByRole('button', { name: 'Faire la facture' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/consultations/c-8/invoice'));
    });

    it('sends to the session when its formula is missing, and folds a long list', async () => {
      serve(summary, [
        toInvoice('c-1', 'Sans', { formulaLabel: null, priceCents: null }),
        ...['B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => toInvoice(`c-${i + 2}`, name)),
      ]);
      renderWithProviders(<DashboardPage />, '/dashboard');
      await screen.findByText('Sans Test');
      const invoices = section('Factures à faire');
      expect(invoices.getByRole('link', { name: 'Choisir la formule' })).toHaveAttribute('href', '/consultations/c-1');
      expect(invoices.getAllByRole('listitem')).toHaveLength(5);
      fireEvent.click(invoices.getByRole('button', { name: 'Voir les 2 autres séances' }));
      expect(invoices.getAllByRole('listitem')).toHaveLength(7);
    });
  });

  describe('Tâches', () => {
    it('marks a task as done and flags overdue ones', async () => {
      serve(summary);
      vi.mocked(api.patch).mockResolvedValue({ data: {} });
      renderWithProviders(<DashboardPage />, '/dashboard');
      await screen.findByText('Relancer pour un rendez-vous');
      const tasks = section('Tâches');
      expect(tasks.getByText(/En retard · 18 novembre/)).toBeInTheDocument();
      fireEvent.click(tasks.getByRole('button', { name: 'Marquer « Envoyer les menus » comme faite' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/tasks/t-2', { status: 'DONE' }));
    });
  });

  it('guides with friendly empty states', async () => {
    serve(EMPTY, []);
    renderWithProviders(<DashboardPage />, '/dashboard');
    expect(await screen.findByText('Aucun rendez-vous aujourd’hui.')).toBeInTheDocument();
    expect(screen.getByText(/aucun rendez-vous aujourd’hui$/)).toBeInTheDocument();
    expect(screen.getByText('Tous vos patients sont suivis.')).toBeInTheDocument();
    expect(await screen.findByText('Toutes les séances ont leur facture.')).toBeInTheDocument();
    expect(screen.getByText('Aucune tâche en cours.')).toBeInTheDocument();
  });

  it('shows assistants the day and their tasks, without sessions, follow-ups or invoices', async () => {
    login('ASSISTANTE');
    serve(summary);
    renderWithProviders(<DashboardPage />, '/dashboard');
    await screen.findByRole('heading', { name: 'Aujourd’hui' });
    expect(screen.getByRole('heading', { name: 'Tâches' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'À relancer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Factures à faire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer la séance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rouvrir' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/invoices/to-issue');
  });
});
