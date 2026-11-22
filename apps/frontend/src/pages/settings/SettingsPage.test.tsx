import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FormulaDto, MeDto, PracticeDto } from '@vp/types';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';

import SettingsPage from './SettingsPage';

// Recent Node versions shadow jsdom's localStorage with their own (unusable without a file):
// give the stores an in-memory one before they are created
vi.hoisted(() => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
});

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
  hasPassword: true,
  googleLinked: false,
  theme: 'SYSTEM',
};

const practice: PracticeDto = {
  practiceName: 'Valérie Perrot, diététicienne',
  address: '12 rue des Oliviers',
  zipCode: '13100',
  city: 'Aix-en-Provence',
  siret: '91234567800011',
  adeliRpps: '139512345',
  vatMention: 'TVA non applicable, article 261-4-1° du CGI',
  invoiceFooter: null,
};

const formulas: FormulaDto[] = [
  { id: 'f1', label: 'Bilan', priceCents: 6000, position: 0, archivedAt: null },
  { id: 'f2', label: 'Suivi', priceCents: null, position: 1, archivedAt: null },
  { id: 'f3', label: 'Ancien forfait', priceCents: 15000, position: 0, archivedAt: '2026-01-01T00:00:00Z' },
];

function serve(me: MeDto) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/me' ? me : url === '/me/practice' ? practice : formulas,
    }),
  );
  api.patch.mockImplementation((url: string, body: object) =>
    Promise.resolve({ data: url === '/me' ? { ...me, ...body } : url === '/me/practice' ? { ...practice, ...body } : {} }),
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
  document.documentElement.classList.remove('dark');
  useThemeStore.setState({ theme: 'SYSTEM' });
});

describe('SettingsPage', () => {
  it('shows a practitioner the five sections with what is saved', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Valérie')).toBeInTheDocument();
    for (const title of ['Mon profil', 'Mon cabinet', 'Mes tarifs', 'Sécurité', 'Apparence']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByDisplayValue('06 12 34 56 78')).toBeInTheDocument();
    expect(screen.getByText('valerie@example.fr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('91234567800011')).toBeInTheDocument();
    expect(screen.getByDisplayValue('139512345')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bilan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByLabelText(/Comme l’appareil/)).toBeChecked();
  });

  it('shows an admin only her profile, security and appearance', async () => {
    renderPage({ ...practitioner, role: 'ADMIN' as MeDto['role'] });
    expect(await screen.findByRole('heading', { name: 'Mon profil' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mon cabinet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mes tarifs' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sécurité' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apparence' })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/me/practice');
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
      const city = await screen.findByLabelText('Ville');
      fireEvent.change(city, { target: { value: 'Marseille' } });
      expect(api.patch).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1500);
      expect(api.patch).toHaveBeenCalledWith('/me/practice', { city: 'Marseille' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not save a wrong SIRET and says how to fix it', async () => {
    renderPage();
    edit(await screen.findByLabelText('SIRET', { exact: false }), '91234567800012');
    expect(await screen.findByText(/Ce SIRET n’est pas valide/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    // Typed with spaces: saved as digits
    edit(screen.getByLabelText('SIRET', { exact: false }), '912 345 678 00011 ');
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
    expect(screen.getByText('À compléter')).toBeInTheDocument();
    const prices = screen.getAllByLabelText(/Prix en euros/);
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
    fireEvent.click(form.getByRole('button', { name: 'Ajouter la formule' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/me/formulas', { label: 'Séance de groupe', priceCents: 3000 }),
    );
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

  it('changes the password after checking the two new ones match', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Sécurité' });
    const security = section('Sécurité');
    fireEvent.change(security.getByLabelText('Mot de passe actuel'), { target: { value: 'Ancien1' } });
    fireEvent.change(security.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'Nouveau-mdp2' },
    });
    fireEvent.change(security.getByLabelText('Nouveau mot de passe, encore une fois'), {
      target: { value: 'Autre-mdp2' },
    });
    fireEvent.click(security.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await security.findByText('Les deux mots de passe ne sont pas identiques.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(security.getByLabelText('Nouveau mot de passe, encore une fois'), {
      target: { value: 'Nouveau-mdp2' },
    });
    fireEvent.click(security.getByRole('button', { name: 'Changer le mot de passe' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'Ancien1',
        newPassword: 'Nouveau-mdp2',
      }),
    );
    expect(await security.findByText(/Vos autres appareils ont été déconnectés/)).toBeInTheDocument();
  });

  it('shows the API’s answer when the current password is wrong', async () => {
    renderPage();
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Le mot de passe actuel n’est pas le bon.' } } });
    await screen.findByRole('heading', { name: 'Sécurité' });
    const security = section('Sécurité');
    fireEvent.change(security.getByLabelText('Mot de passe actuel'), { target: { value: 'Faux1' } });
    fireEvent.change(security.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'Nouveau-mdp2' },
    });
    fireEvent.change(security.getByLabelText('Nouveau mot de passe, encore une fois'), {
      target: { value: 'Nouveau-mdp2' },
    });
    fireEvent.click(security.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await security.findByText('Le mot de passe actuel n’est pas le bon.')).toBeInTheDocument();
  });

  it('tells a Google-only account it has no password to change', async () => {
    renderPage({ ...practitioner, hasPassword: false, googleLinked: true });
    expect(await screen.findByText(/Vous vous connectez avec Google/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Mot de passe actuel')).not.toBeInTheDocument();
  });

  it('applies and saves the chosen appearance', async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText('Sombre', { exact: false }));
    expect(document.documentElement).toHaveClass('dark');
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/me', { theme: 'DARK' }));
    expect(useThemeStore.getState().theme).toBe('DARK');
  });
});
