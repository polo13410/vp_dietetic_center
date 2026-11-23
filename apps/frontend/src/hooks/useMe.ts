import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFormulaDto,
  FormulaDto,
  MeDto,
  PracticeDto,
  RemoveFormulaResult,
  Theme,
  UpdateFormulaDto,
  UpdateMeDto,
} from '@vp/types';
import { useEffect } from 'react';

import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

const ME = ['me'] as const;
const PRACTICE = ['me', 'practice'] as const;
const FORMULAS = ['me', 'formulas'] as const;

/** The message the API gives for a refused change, else the fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  if (typeof message === 'string') return message;
  return fallback;
}

// ─── Profile and appearance ─────────────────────────────────────────────────────

export function useMe() {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  return useQuery<MeDto>({
    queryKey: ME,
    queryFn: async () => (await api.get<MeDto>('/me')).data,
    enabled: signedIn,
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateMeDto) => (await api.patch<MeDto>('/me', dto)).data,
    onSuccess: (me) => {
      queryClient.setQueryData(ME, me);
      // The header shows her initials
      const user = useAuthStore.getState().user;
      if (user) useAuthStore.setState({ user: { ...user, firstName: me.firstName, lastName: me.lastName } });
    },
  });
}

/** Shows the theme at once, then saves it on her account. */
export function useSaveTheme() {
  const queryClient = useQueryClient();
  const setTheme = useThemeStore((s) => s.setTheme);
  return useMutation({
    mutationFn: async (theme: Theme) => (await api.patch<MeDto>('/me', { theme })).data,
    onMutate: (theme) => {
      setTheme(theme);
      // So a refetch in between does not bring back the old theme
      queryClient.setQueryData<MeDto>(ME, (me) => (me ? { ...me, theme } : me));
    },
    onSuccess: (me) => queryClient.setQueryData(ME, me),
  });
}

/** Signed in on another device with another theme: the one saved on her account wins. */
export function useThemeFromAccount() {
  const { data: me } = useMe();
  const setTheme = useThemeStore((s) => s.setTheme);
  const serverTheme = me?.theme;
  useEffect(() => {
    if (serverTheme && serverTheme !== useThemeStore.getState().theme) setTheme(serverTheme);
  }, [serverTheme, setTheme]);
}

// ─── Practice ─────────────────────────────────────────────────────────────────

export function usePractice(enabled = true) {
  return useQuery<PracticeDto>({
    queryKey: PRACTICE,
    queryFn: async () => (await api.get<PracticeDto>('/me/practice')).data,
    enabled,
  });
}

export function useUpdatePractice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<PracticeDto>) =>
      (await api.patch<PracticeDto>('/me/practice', dto)).data,
    onSuccess: (practice) => queryClient.setQueryData(PRACTICE, practice),
  });
}

// ─── Formulas ────────────────────────────────────────────────────────────────

export function useFormulas(enabled = true) {
  return useQuery<FormulaDto[]>({
    queryKey: FORMULAS,
    queryFn: async () => (await api.get<FormulaDto[]>('/me/formulas')).data,
    enabled,
  });
}

function useFormulaMutation<T>(mutationFn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: FORMULAS }),
  });
}

export function useCreateFormula() {
  return useFormulaMutation(async (dto: CreateFormulaDto) =>
    (await api.post<FormulaDto>('/me/formulas', dto)).data,
  );
}

export function useUpdateFormula() {
  return useFormulaMutation(async ({ id, dto }: { id: string; dto: UpdateFormulaDto }) =>
    (await api.patch<FormulaDto>(`/me/formulas/${id}`, dto)).data,
  );
}

export function useRemoveFormula() {
  return useFormulaMutation(async (id: string) =>
    (await api.delete<RemoveFormulaResult>(`/me/formulas/${id}`)).data,
  );
}

export function useReorderFormulas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => (await api.put<FormulaDto[]>('/me/formulas/order', { ids })).data,
    // Moves at once; the server's answer then confirms the order
    onMutate: (ids) => {
      queryClient.setQueryData<FormulaDto[]>(FORMULAS, (list) => {
        if (!list) return list;
        const offered = ids
          .map((id, position) => {
            const formula = list.find((f) => f.id === id);
            return formula && { ...formula, position };
          })
          .filter((f): f is FormulaDto => !!f);
        return [...offered, ...list.filter((f) => f.archivedAt)];
      });
    },
    onSuccess: (list) => queryClient.setQueryData(FORMULAS, list),
    onError: () => queryClient.invalidateQueries({ queryKey: FORMULAS }),
  });
}
