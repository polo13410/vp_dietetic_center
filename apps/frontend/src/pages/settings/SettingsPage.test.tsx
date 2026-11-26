import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ActivityDto, FormulaDto, MeDto, PracticeDto } from '@vp/types';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

import SettingsPage from './SettingsPage';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ default: api, api }));

const practitioner: MeDto = {
  id: 'u1',
  email: 'valerie@example.fr',
  firstName: 'Valérie',
  lastName: 'Perrot',
  phone: '06 12 34 56 78',
  role: 'PRATICIENNE' as MeDto['role'],
  theme: 'SYSTEM',
  twoFactorEnabledAt: '2026-11-26T09:00:00.000Z',
  recoveryCodesLeft: 9,
};

const activity: ActivityDto = {
  practiceName: 'Valérie Perrot, diététicienne',
  siret: '91234567800011',
  adeliRpps: '139512345',
  vatMention: 'TVA non applicable, article 261-4-1° du CGI',
  invoiceFooter: null,
};

const formulas: FormulaDto[] = [
  { id: 'f1', label: 'Bilan', priceCents: 6000, durationMinutes: 60, position: 0, archivedAt: null },
  { id: 'f2', label: 'Suivi', priceCents: null, durationMinutes: 45, position: 1, archivedAt: null },
  { id: 'f3', label: 'Ancien forfait', priceCents: 15000, durationMinutes: 90, position: 0, archivedAt: '2026-01-01T00:00:00Z' },
];

const place = (over: Partial<PracticeDto>): PracticeDto => ({
  id: 'pr1',
  name: 'Cabinet d’Aix',
  address: '12 rue des Oliviers',
  zipCode: '13100',
  city: 'Aix-en-Provence',
  phone: null,
  siret: null,
  isDefault: true,
  archivedAt: null,
  ...over,
});
let practices: PracticeDto[] = [place({})];

function serve(me: MeDto) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/me'
          ? me
          : url === '/me/activity'
            ? activity
            : url === '/me/practices'
              ? practices
              : formulas,
    }),
  );
  api.patch.mockImplementation((url: string, body: object) =>
    Promise.resolve({ data: url === '/me' ? { ...me, ...body } : url === '/me/activity' ? { ...activity, ...body } : {} }),
  );
  api.post.mockResolvedValue({ data: {} });
  api.put.mockResolvedValue({ data: formulas });
  api.delete.mockResolvedValue({ data: { deleted: true, formula: null } });
}

function renderPage(me: MeDto = practitioner) {
  serve(me);
  useAuthStore.setState({
    user: { id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName, role: me.role },
    isAuthenticated: true,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The section whose title is `title`. */
function section(title: string) {
  return within(screen.getByRole('heading', { name: title }).closest('section')!);
}

function edit(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

beforeEach(() => {
  vi.clearAllMocks();
  practices = [place({})];
  document.documentElement.classList.remove('dark');
  useThemeStore.setState({ theme: 'SYSTEM' });
});

describe('SettingsPage', () => {
  it('shows a practitioner the six sections with what is saved', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Valérie')).toBeInTheDocument();
    for (const title of ['Mon profil', 'Mon activité', 'Mes cabinets', 'Mes tarifs', 'Sécurité', 'Apparence']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByDisplayValue('06 12 34 56 78')).toBeInTheDocument();
    expect(section('Mon profil').getByText('valerie@example.fr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('91234567800011')).toBeInTheDocument();
    expect(screen.getByDisplayValue('139512345')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bilan')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Prix en euros/)[0]).toHaveValue('60');
    expect(screen.getByLabelText(/Comme l’appareil/)).toBeChecked();
  });

  it('shows an admin only her profile, security and appearance', async () => {
    renderPage({ ...practitioner, role: 'ADMIN' as MeDto['role'] });
    expect(await screen.findByRole('heading', { name: 'Mon profil' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mon activité' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mes cabinets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mes tarifs' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sécurité' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apparence' })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/me/activity');
    expect(api.get).not.toHaveBeenCalledWith('/me/practices');
    expect(api.get).not.toHaveBeenCalledWith('/me/formulas');
  });

  it('saves a field when it is left, and says when', async () => {
    renderPage();
    edit(await screen.findByLabelText('Téléphone'), '07 00 00 00 00');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me', { phone: '07 00 00 00 00' }));
    expect(await section('Mon profil').findByText(/Enregistré à \d+ h \d\d/)).toBeInTheDocument();
    expect(useAuthStore.getState().user?.firstName).toBe('Valérie');
  });

  it('saves after a pause in typing, without leaving the field', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderPage();
      const aix = within(await screen.findByRole('listitem', { name: 'Cabinet d’Aix' }));
      const city = aix.getByLabelText('Ville');
      fireEvent.change(city, { target: { value: 'Marseille' } });
      expect(api.patch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1500);
      expect(api.patch).toHaveBeenCalledWith('/me/practices/pr1', { city: 'Marseille' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not save a wrong SIRET and says how to fix it', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Mon activité' });
    const siret = section('Mon activité').getByLabelText('SIRET', { exact: false });
    edit(siret, '91234567800012');
    expect(await screen.findByText(/Ce SIRET n’est pas valide/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    // Typed with spaces: saved as digits
    edit(siret, '912 345 678 00011 ');
    expect(screen.queryByText(/Ce SIRET n’est pas valide/)).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled(); // same number as before
    edit(screen.getByLabelText('N° ADELI ou RPPS', { exact: false }), '1234');
    expect(await screen.findByText('Le numéro ADELI compte 9 chiffres, le numéro RPPS 11 chiffres.')).toBeInTheDocument();
  });

  it('refuses to empty the first name', async () => {
    renderPage();
    edit(await screen.findByLabelText('Prénom'), '  ');
    expect(await screen.findByText('Le prénom ne peut pas être vide.')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('flags the formulas without a price and saves a price typed in euros', async () => {
    renderPage();
    expect(await screen.findByText(/Indiquez le prix de la formule « Suivi »/)).toBeInTheDocument();
    const prices = screen.getAllByLabelText(/Prix en euros/);
    expect(prices[1]).toHaveValue('');
    expect(prices[1]).toHaveClass('border-warning');
    expect(prices[0]).not.toHaveClass('border-warning');
    edit(prices[1], '52,50');
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/me/formulas/f2', { priceCents: 5250 }),
    );
    edit(prices[0], 'soixante');
    expect(await screen.findByText(/Indiquez un prix en euros/)).toBeInTheDocument();
  });

  it('changes the order of the formulas', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Descendre « Bilan »' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/me/formulas/order', { ids: ['f2', 'f1'] }));
    expect(screen.getByRole('button', { name: 'Monter « Bilan »' })).toBeDisabled();
  });

  it('adds a formula', async () => {
    renderPage();
    const form = within(await screen.findByRole('form', { name: 'Ajouter une formule' }));
    fireEvent.click(form.getByRole('button', { name: 'Ajouter la formule' }));
    expect(await form.findByText('Donnez un nom à la formule.')).toBeInTheDocument();
    fireEvent.change(form.getByLabelText('Nouvelle formule'), { target: { value: 'Séance de groupe' } });
    fireEvent.change(form.getByLabelText('Prix en euros'), { target: { value: '30' } });
    fireEvent.change(form.getByLabelText('Durée en minutes'), { target: { value: '5' } });
    fireEvent.click(form.getByRole('button', { name: 'Ajouter la formule' }));
    expect(await form.findByText('Comptez au moins 15 minutes.')).toBeInTheDocument();
    fireEvent.change(form.getByLabelText('Durée en minutes'), { target: { value: '90' } });
    fireEvent.click(form.getByRole('button', { name: 'Ajouter la formule' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/me/formulas', {
        label: 'Séance de groupe',
        priceCents: 3000,
        durationMinutes: 90,
      }),
    );
  });

  it('shows and saves the duration of each type of appointment', async () => {
    renderPage();
    const durations = await screen.findAllByLabelText('Durée en minutes');
    expect(durations.slice(0, 2).map((d) => (d as HTMLInputElement).value)).toEqual(['60', '45']);
    edit(durations[1], '50');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/formulas/f2', { durationMinutes: 50 }));
    edit(durations[0], '');
    expect(await screen.findByText('Indiquez la durée en minutes, par exemple 45.')).toBeInTheDocument();
  });

  describe('Mes cabinets', () => {
    it('has the one practice as default, with nothing to archive', async () => {
      renderPage();
      await screen.findByRole('heading', { name: 'Mes cabinets' });
      const aix = within(screen.getByRole('listitem', { name: 'Cabinet d’Aix' }));
      expect(aix.getByText('Par défaut')).toBeInTheDocument();
      expect(aix.queryByRole('button', { name: /Archiver/ })).not.toBeInTheDocument();
      expect(aix.getByDisplayValue('12 rue des Oliviers')).toBeInTheDocument();
    });

    it('chooses another default practice, and archives one after confirmation', async () => {
      practices = [place({}), place({ id: 'pr2', name: 'Marseille', city: 'Marseille', isDefault: false })];
      renderPage();
      const marseille = within(await screen.findByRole('listitem', { name: 'Marseille' }));
      fireEvent.click(marseille.getByRole('button', { name: 'Choisir par défaut' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/practices/pr2', { isDefault: true }));

      const aix = within(screen.getByRole('listitem', { name: 'Cabinet d’Aix' }));
      fireEvent.click(aix.getByRole('button', { name: 'Archiver' }));
      expect(screen.getByText('Archiver le cabinet « Cabinet d’Aix » ?')).toBeInTheDocument();
      expect(screen.getByText(/Le cabinet suivant deviendra celui par défaut/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Archiver le cabinet' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/practices/pr1', { archived: true }));
    });

    it('adds a practice with its address', async () => {
      renderPage();
      const form = within(await screen.findByRole('form', { name: 'Ajouter un cabinet' }));
      fireEvent.click(form.getByRole('button', { name: 'Ajouter le cabinet' }));
      expect(await form.findByText('Donnez un nom au cabinet.')).toBeInTheDocument();
      fireEvent.change(form.getByLabelText('Nouveau cabinet'), { target: { value: 'Maison de santé' } });
      fireEvent.change(form.getByLabelText('Adresse'), { target: { value: '40 rue de Rome' } });
      fireEvent.change(form.getByLabelText('Code postal'), { target: { value: '13006' } });
      fireEvent.change(form.getByLabelText('Ville'), { target: { value: 'Marseille' } });
      fireEvent.click(form.getByRole('button', { name: 'Ajouter le cabinet' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/me/practices', {
          name: 'Maison de santé',
          address: '40 rue de Rome',
          zipCode: '13006',
          city: 'Marseille',
        }),
      );
    });

    it('offers an archived practice again', async () => {
      practices = [place({}), place({ id: 'pr3', name: 'Salon', isDefault: false, archivedAt: '2026-10-01T00:00:00Z' })];
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Cabinets archivés \(1\)/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Proposer à nouveau' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/practices/pr3', { archived: false }));
    });
  });

  it('removes a formula after confirmation, and offers a removed one again', async () => {
    renderPage();
    const bilan = (await screen.findByDisplayValue('Bilan')).closest('li')!;
    fireEvent.click(within(bilan).getByRole('button', { name: 'Retirer' }));
    expect(screen.getByText('Retirer la formule « Bilan » ?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la formule' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/me/formulas/f1'));

    fireEvent.click(screen.getByRole('button', { name: /Formules retirées \(1\)/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Proposer à nouveau' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me/formulas/f3', { archived: false }));
  });

  it('explains that she signs in with Google then her app, with no password to change', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Sécurité' });
    const security = section('Sécurité');
    expect(
      security.getByText(/Vous vous connectez avec votre compte Google/).textContent,
    ).toBe(
      'Vous vous connectez avec votre compte Google valerie@example.fr, puis le code de votre application d’authentification.',
    );
    expect(security.getByText(/Double authentification active depuis le 26 novembre 2026, 9 codes de secours restants/)).toBeInTheDocument();
    const link = security.getByRole('link', { name: /validation en deux étapes/ });
    expect(link).toHaveAttribute('href', 'https://myaccount.google.com/signinoptions/two-step-verification');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByText(/mot de passe/i)).not.toBeInTheDocument();
    expect(security.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies and saves the chosen appearance', async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText('Sombre', { exact: false }));
    expect(document.documentElement).toHaveClass('dark');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me', { theme: 'DARK' }));
    expect(useThemeStore.getState().theme).toBe('DARK');
  });
});
