import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserDto, UpdateUserDto, UserDto } from '@vp/types';

import api from '../lib/api';

export function useUsers() {
  return useQuery<UserDto[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });
}

export function useUser(id: string | null) {
  return useQuery<UserDto>({
    queryKey: ['users', id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateUserDto) => {
      const { data } = await api.post<UserDto>('/users', dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateUserDto }) => {
      const { data } = await api.patch<UserDto>(`/users/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
