import { useMutation } from '@tanstack/react-query';
import type { TwoFactorChallengeDto, UserDto } from '@vp/types';
import { useNavigate } from 'react-router';

import api from '../lib/api';
import { homePathFor } from '../lib/roles';
import { useAuthStore } from '../stores/authStore';

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
  /** Right after she set up her app: her recovery codes, shown once */
  recoveryCodes?: string[];
}

/** Opens the session in the app, then the home page of her role. */
export function useOpenSession() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  return (data: LoginResponse) => {
    setAuth(data.user as any, data.accessToken);
    navigate(homePathFor(data.user.role));
  };
}

/** First step, the only way to sign in: the ID token Google gives the sign-in button. */
export function useGoogleLogin() {
  return useMutation({
    mutationFn: async (idToken: string) =>
      (await api.post<TwoFactorChallengeDto>('/auth/google', { idToken })).data,
  });
}

/** Second step: the code of her authenticator app, or a recovery code. */
export function useTwoFactor() {
  return useMutation({
    mutationFn: async (body: { challengeToken: string; code: string }) =>
      (await api.post<LoginResponse>('/auth/two-factor', body)).data,
  });
}

/** Local development and end-to-end tests only: the API has this route only with DEV_LOGIN=true. */
export function useDevLogin() {
  const openSession = useOpenSession();
  return useMutation({
    mutationFn: async (email: string) => (await api.post<LoginResponse>('/auth/dev-login', { email })).data,
    onSuccess: openSession,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      logout();
    },
  });
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useIsRole(...roles: string[]) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return roles.includes(user.role);
}
