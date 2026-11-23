import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@vp/types';
import { useNavigate } from 'react-router';

import api from '../lib/api';
import { homePathFor } from '../lib/roles';
import { useAuthStore } from '../stores/authStore';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

/** Signs in, then opens the home page of her role. */
function useSignIn<T>(request: (arg: T) => Promise<LoginResponse>) {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      setAuth(data.user as any, data.accessToken);
      navigate(homePathFor(data.user.role));
    },
  });
}

/** The only way to sign in: the ID token Google gives the sign-in button. */
export function useGoogleLogin() {
  return useSignIn(async (idToken: string) => (await api.post<LoginResponse>('/auth/google', { idToken })).data);
}

/** Local development and end-to-end tests only: the API has this route only with DEV_LOGIN=true. */
export function useDevLogin() {
  return useSignIn(async (email: string) => (await api.post<LoginResponse>('/auth/dev-login', { email })).data);
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
