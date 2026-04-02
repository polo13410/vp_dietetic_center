import type { UserRole } from '@vp/types';
import { create } from 'zustand';
import { type PersistOptions, persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
        // Redirect to login — handled by RequireAuth
        window.location.href = '/login';
      },
    }),
    {
      name: 'vp-auth',
      partialState: (state: AuthState) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't persist the access token in localStorage — re-fetch via refresh cookie
      }),
    } as PersistOptions<AuthState>,
  ),
);
