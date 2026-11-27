import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import type { Consultation } from '../../lib/patient-file';
import { useAuthStore } from '../../stores/authStore';
import { replacement } from '../../test/invoice-fixtures';
import { apiGet, PATIENT_ID, ROUTES, sessions, signInPractitioner, TWO_PRACTICES } from '../../test/patient-fixtures';

import ConsultationPage from './ConsultationPage';

// Recent Node versions shadow jsdom's localStorage with their own (unusable without a file)
const storage = vi.hoisted(() => {
  const items = new Map<string, string>();
  const store = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
  return store;
});

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const { get, post, patch, put } = vi.mocked(api);

/** Today's « Suivi 3 » of the test patient, just started: prefilled « Suivi », paid by cheque. */
const today: Consultation = {
  ...sessions[0],
  id: 'c-4',
  sequence: 3,
  date: '2026-11-22T09:00:00.000Z',
  formulaId: 'f-suivi',
  formulaLabel: 'Suivi',
  priceCents: 5000,
  paymentMethod: 'CHECK' as Consultation['paymentMethod'],
  habits: null,
  sessionWork: null,
  advice: null,
  previousAdvice: 'Une entrée ou un dessert, pas les deux.',
  figures: { age: 56, minor: false, weight: null, height: null, bmi: null, bmr: null, missing: ['weight'] },
  weightChange: { sincePrevious: null, sinceFirst: null },
  patient: { id: PATIENT_ID, firstName: 'Martine', lastName: 'Roux' },
  measurements: [],
  lifeEvents: [],
};
/** The same séance once weighed at 79 kg (§ 3.1). */
const weighed: Consultation = {
  ...today,
  figures: {
    age: 56,
    minor: false,
    weight: 79,
    height: { value: 159, measuredAt: '2026-09-23T00:00:00.000Z' },
    bmi: { value: 31.25, category: 'OBESITY', child: null },
    bmr: { mj: 5.86, kcal: 1400.3, adultFormulaForMinor: false },
    missing: [],
  },
  weightChange: { sincePrevious: 2.5, sinceFirst: 0 },
  measurements: [{ id: 'm-4', type: 'WEIGHT', value: 79, measuredAt: today.date, consultationId: 'c-4' }],
};

const formulas = [
  { id: 'f-bilan', label: 'Bilan', priceCents: 6000, position: 0, archivedAt: null },
  { id: 'f-suivi', label: 'Suivi', priceCents: 5000, position: 1, archivedAt: null },
];

function mockApi(session: Consultation, invoices: unknown = { current: null, mismatches: [], history: [] }) {
  get.mockImplementation(
    apiGet({
      ...ROUTES,
      [`/consultations/${session.id}`]: session,
      [`/consultations/${session.id}/invoices`]: invoices,
      '/me/formulas': formulas,
    }) as never,
  );
}

/** iPad landscape and computer (the panel pushes the séance), or iPad portrait (drawer). */
function screenWide(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: query === '(min-width: 1024px)' ? wide : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where" data-state={JSON.stringify(location.state)}>
      {location.pathname}
    </p>
  );
}

/** Opens the séance as `useStartSession` does (`started`), or as a link to a past one. */
function open(session: Consultation, { started = false } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[{ pathname: `/consultations/${session.id}`, state: started ? { startedSession: session.id } : null }]}
      >
        <Routes>
          <Route path="/consultations/:id" element={<ConsultationPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConsultationPage', () => {
  beforeEach(() => {
    storage.clear();
    screenWide(true);
    mockApi(today);
    post.mockReset();
    patch.mockReset();
    put.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  describe('two times', () => {
    it('starts on « Avant de commencer »: the summary as it was before this séance, one big button', async () => {
      open(today, { started: true });

      expect(await screen.findByRole('heading', { name: 'Avant de commencer' })).toBeInTheDocument();
      expect(screen.getByText('Suivi 3 · Martine Roux')).toBeInTheDocument();
      await waitFor(() =>
        expect(get).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/brief`, { params: { before: 'c-4' } }),
      );
      expect(await screen.findByText('Une entrée ou un dessert, pas les deux.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Poids (kg)')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Commencer la séance/ })).toHaveLength(1);
    });

    it('then the summary goes to the « Rappel » panel and the séance fields come', async () => {
      open(today, { started: true });
      fireEvent.click(await screen.findByRole('button', { name: /Commencer la séance/ }));

      expect(screen.queryByRole('heading', { name: 'Avant de commencer' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Poids (kg)')).toBeInTheDocument();
      const handle = screen.getByRole('button', { name: 'Fermer le rappel' });
      expect(handle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('complementary', { name: 'Rappel du dossier' })).not.toHaveAttribute('inert');
      // « Back » or a reload no longer shows time 1
      expect(screen.getByTestId('where')).toHaveAttribute('data-state', 'null');
    });

    it('goes straight to the fields, panel closed, when a past séance is reopened', async () => {
      open(today);
      expect(await screen.findByLabelText('Poids (kg)')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Avant de commencer' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ouvrir le rappel' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('slides the panel away on iPad portrait, where it would cover the séance', async () => {
      screenWide(false);
      open(today, { started: true });
      fireEvent.click(await screen.findByRole('button', { name: /Commencer la séance/ }));
      expect(screen.getByRole('button', { name: 'Ouvrir le rappel' })).toHaveAttribute('aria-expanded', 'false');

      // Over the séance: Escape closes it, like a menu
      fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le rappel' }));
      expect(screen.getByRole('button', { name: 'Fermer le rappel' })).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByRole('button', { name: 'Ouvrir le rappel' })).toBeInTheDocument();
    });
  });

  describe('« Rappel » panel', () => {
    it('remembers whether she left it open or closed', async () => {
      open(today, { started: true });
      fireEvent.click(await screen.findByRole('button', { name: /Commencer la séance/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Fermer le rappel' }));
      expect(storage.getItem('seance.rappel.ouvert')).toBe('false');

      // Next séance: the summary slides into a closed panel
      open(today, { started: true });
      fireEvent.click((await screen.findAllByRole('button', { name: /Commencer la séance/ })).at(-1)!);
      expect(screen.getAllByRole('button', { name: 'Ouvrir le rappel' })).toHaveLength(2);
    });

    it('explains the handle once', async () => {
      open(today);
      const hint = await screen.findByText('Le résumé du dossier reste ici, touchez pour l’ouvrir ou le fermer.');
      fireEvent.click(within(hint.parentElement!).getByRole('button', { name: 'J’ai compris' }));
      expect(screen.queryByText(/Le résumé du dossier reste ici/)).not.toBeInTheDocument();
      expect(storage.getItem('seance.rappel.bulle-vue')).toBe('true');
    });

    it('does not explain it again, and touching the handle counts as having seen it', async () => {
      const first = open(today);
      fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir le rappel' }));
      expect(storage.getItem('seance.rappel.bulle-vue')).toBe('true');
      first.unmount();

      open(today);
      await screen.findByLabelText('Poids (kg)');
      expect(screen.queryByText(/Le résumé du dossier reste ici/)).not.toBeInTheDocument();
    });
  });

  describe('fields', () => {
    it('shows the header line as prefilled when the séance was started: today, « Suivi », the last payment', async () => {
      open(today);
      await screen.findByRole('option', { name: 'Bilan · 60,00 €' });
      expect(screen.getByLabelText('Formule')).toHaveValue('f-suivi');
      expect(screen.getByLabelText('Moyen de paiement')).toHaveValue('CHECK');
      expect(screen.getByLabelText('Date')).toHaveValue('22/11/2026');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Suivi 3');
    });

    it('asks where the séance took place only when she consults in several practices', async () => {
      signInPractitioner();
      get.mockImplementation(
        apiGet({
          ...ROUTES,
          [`/consultations/${today.id}`]: today,
          [`/consultations/${today.id}/invoices`]: { current: null, mismatches: [], history: [] },
          '/me/formulas': formulas,
          '/me/practices': TWO_PRACTICES,
        }) as never,
      );
      patch.mockResolvedValue({ data: {} });
      open(today);
      const cabinet = await screen.findByLabelText('Cabinet');
      expect(cabinet).toHaveValue('pr-aix');
      fireEvent.change(cabinet, { target: { value: 'pr-mrs' } });
      await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/consultations/c-4', { practiceId: 'pr-mrs' }));
      useAuthStore.setState({ user: null, isAuthenticated: false });
    });

    it('does not ask where with a single practice', async () => {
      open(today);
      await screen.findByRole('option', { name: 'Bilan · 60,00 €' });
      expect(screen.queryByLabelText('Cabinet')).not.toBeInTheDocument();
    });

    it('saves the header line as soon as it changes', async () => {
      patch.mockResolvedValue({ data: {} });
      open(today);
      await screen.findByRole('option', { name: 'Bilan · 60,00 €' });

      fireEvent.change(screen.getByLabelText('Moyen de paiement'), { target: { value: 'CARD' } });
      await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/consultations/c-4', { paymentMethod: 'CARD' }));
      fireEvent.change(screen.getByLabelText('Formule'), { target: { value: 'f-bilan' } });
      await waitFor(() => expect(patch).toHaveBeenLastCalledWith('/consultations/c-4', { formulaId: 'f-bilan' }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-16' } });
      await waitFor(() => expect(patch).toHaveBeenCalledTimes(3));
      const { date } = patch.mock.lastCall![1] as { date: string };
      // Same time of day, another day
      expect(new Date(date).getDate()).toBe(16);
      expect(new Date(date).getHours()).toBe(new Date(today.date).getHours());
    });

    it('saves the weight as she types it, then shows BMI and BMR of the test case with the changes', async () => {
      post.mockResolvedValue({ data: { id: 'm-4' } });
      open(today);
      fireEvent.change(await screen.findByLabelText('Poids (kg)'), { target: { value: '79' } });
      mockApi(weighed);

      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/measurements`, {
          type: 'WEIGHT',
          value: 79,
          consultationId: 'c-4',
        }),
      );
      expect(await screen.findByText('31,25')).toBeInTheDocument();
      expect(screen.getByText('5,86')).toBeInTheDocument();
      expect(screen.getByText(/1\s?400,3/)).toBeInTheDocument();
      expect(screen.getByText('+2,5 kg')).toBeInTheDocument();
      expect(screen.getByText('depuis la dernière séance')).toBeInTheDocument();
    });

    it('corrects the weight of a past séance, and refuses what is not a number', async () => {
      mockApi(weighed);
      patch.mockResolvedValue({ data: {} });
      open(weighed);
      const weight = await screen.findByLabelText('Poids (kg)');
      expect(weight).toHaveValue('79');

      fireEvent.change(weight, { target: { value: '7a' } });
      expect(screen.getByText('Écrivez un nombre, par exemple 72,5.')).toBeInTheDocument();
      fireEvent.change(weight, { target: { value: '78,6' } });
      fireEvent.blur(weight);
      await waitFor(() => expect(patch).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/measurements/m-4`, { value: 78.6 }));
      expect(post).not.toHaveBeenCalled();
    });

    it('shows the previous advice above « Habitudes et évolution », and saves her texts', async () => {
      patch.mockResolvedValue({ data: {} });
      open(today);
      const habits = await screen.findByRole('textbox', { name: 'Habitudes et évolution' });
      const section = screen.getByRole('region', { name: 'Habitudes et évolution' });
      expect(within(section).getByText('Conseils donnés à la dernière séance')).toBeInTheDocument();
      expect(within(section).getByText('Une entrée ou un dessert, pas les deux.')).toBeInTheDocument();

      fireEvent.change(habits, { target: { value: 'Petit-déjeuner tous les jours.' } });
      fireEvent.blur(habits);
      await waitFor(() =>
        expect(patch).toHaveBeenCalledWith('/consultations/c-4', { habits: 'Petit-déjeuner tous les jours.' }),
      );
      expect(screen.getByRole('textbox', { name: 'Travail en consultation' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Conseils diététiques' })).toBeInTheDocument();
    });

    it('shows no previous advice for a bilan', async () => {
      const bilan = { ...today, sequence: 0, previousAdvice: null };
      mockApi(bilan);
      open(bilan);
      await screen.findByRole('textbox', { name: 'Habitudes et évolution' });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bilan');
      expect(screen.queryByText('Conseils donnés à la dernière séance')).not.toBeInTheDocument();
    });

    it('fills aversions and tastes with what is known, and links her changes to the séance', async () => {
      put.mockResolvedValue({ data: {} });
      open(today);
      const aversions = await screen.findByRole('textbox', { name: 'Aversions' });
      expect(aversions).toHaveValue('Pas de poisson.');
      expect(screen.getByRole('textbox', { name: 'Goûts' })).toHaveValue('Aime les fruits.');

      fireEvent.change(aversions, { target: { value: 'Pas de poisson, ni de chou.' } });
      fireEvent.blur(aversions);
      await waitFor(() =>
        expect(put).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/file/AVERSIONS`, {
          content: 'Pas de poisson, ni de chou.',
          consultationId: 'c-4',
        }),
      );
    });

    it('keeps the rest folded in « Pour aller plus loin »', async () => {
      open(today);
      const further = await screen.findByRole('button', { name: /Pour aller plus loin/ });
      expect(further).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Tour de taille (cm)')).not.toBeInTheDocument();

      fireEvent.click(further);
      expect(screen.getByLabelText('Tour de taille (cm)')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Fait marquant' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Santé, maladies' })).toBeInTheDocument();
      // Aversions and tastes are higher up, not twice
      expect(await screen.findAllByRole('textbox', { name: 'Aversions' })).toHaveLength(1);
    });
  });

  describe('end and deletion', () => {
    it('« Terminer la séance » goes back to the file, which offers the next steps', async () => {
      open(today);
      fireEvent.click(await screen.findByRole('button', { name: /Terminer la séance/ }));
      const where = await screen.findAllByTestId('where');
      expect(where[0]).toHaveTextContent(`/patients/${PATIENT_ID}`);
      expect(where[0]).toHaveAttribute('data-state', JSON.stringify({ endedSession: 'c-4' }));
    });

    it('shows the invoice block only once the séance is invoiced', async () => {
      open(today);
      await screen.findByLabelText('Poids (kg)');
      expect(screen.queryByRole('heading', { name: 'Facture' })).not.toBeInTheDocument();
    });

    it('deletes the séance after confirmation, its invoice cancelled by a credit note first', async () => {
      mockApi(today, { current: replacement, mismatches: [], history: [] });
      vi.mocked(api.delete).mockResolvedValue({ data: {} });
      open(today);
      await screen.findByRole('heading', { name: 'Facture' });

      // The secondary menu (opened from the keyboard: jsdom has no pointer events)
      fireEvent.keyDown(screen.getByRole('button', { name: 'Plus d’actions' }), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer la séance' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(`La facture n° ${replacement.number} sera annulée par un avoir`);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer la séance' }));

      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/consultations/c-4'));
      expect((await screen.findAllByTestId('where'))[0]).toHaveTextContent(`/patients/${PATIENT_ID}`);
    });
  });
});
