import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@vp/types';
import { useNavigate } from 'react-router';

import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user as any, data.accessToken);
      navigate('/dashboard');
    },
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
