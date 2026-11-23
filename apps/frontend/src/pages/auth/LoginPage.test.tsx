import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../stores/authStore';

import LoginPage from './LoginPage';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../lib/api', () => ({ default: api, api }));

// Google's button lives in an iframe: here, a plain button that hands over an ID token
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, text }: { onSuccess: (r: { credential: string }) => void; text: string }) => (
    <button type="button" data-text={text} onClick={() => onSuccess({ credential: 'id-token' })}>
      Se connecter avec Google
    </button>
  ),
}));

const session = {
  accessToken: 'access',
  expiresIn: 900,
  user: { id: 'u1', email: 'valerie@gmail.com', firstName: 'Valérie', lastName: 'Perrot', role: 'PRATICIENNE' },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<p>Tableau de bord</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const refused = (status: number, message?: string) => ({ response: { status, data: { message } } });

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  });

  it('offers only Google, with no password', () => {
    renderPage();
    const google = screen.getByRole('button', { name: 'Se connecter avec Google' });
    expect(google).toHaveAttribute('data-text', 'signin_with');
    expect(screen.getByText(/Aucun mot de passe à retenir/)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText(/Mot de passe oublié/)).not.toBeInTheDocument();
  });

  it('signs in with the Google ID token and opens her home page', async () => {
    api.post.mockResolvedValue({ data: session });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/google', { idToken: 'id-token' });
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, accessToken: 'access' });
  });

  it('says clearly when the Google account is not registered', async () => {
    const message =
      'Cette adresse Google n’est pas enregistrée dans l’application. Demandez à l’administratrice de créer votre compte avec cette adresse.';
    api.post.mockRejectedValue(refused(401, message));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('asks to check the connection when the API cannot be reached', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter avec Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Vérifiez votre connexion à internet/);
  });

  it('has a sign-in without Google in local development (absent from production builds)', async () => {
    api.post.mockResolvedValue({ data: session });
    renderPage();
    fireEvent.change(screen.getByLabelText('Adresse e-mail d’un compte enregistré'), {
      target: { value: 'praticienne@vp-dietetic.fr' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connexion de développement' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/dev-login', { email: 'praticienne@vp-dietetic.fr' }),
    );
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
  });

  it('explains how to turn the dev sign-in on when the API does not have it', async () => {
    api.post.mockRejectedValue(refused(404));
    renderPage();
    fireEvent.change(screen.getByLabelText('Adresse e-mail d’un compte enregistré'), {
      target: { value: 'praticienne@vp-dietetic.fr' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connexion de développement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/DEV_LOGIN=true/);
  });
});
