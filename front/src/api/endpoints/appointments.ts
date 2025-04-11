
import { apiClient } from '../config/axios';
import { Appointment } from '@/hooks/useAppointments';
import { ApiResponse, PaginatedResponse, PaginationParams, DateRangeParams } from '../types/api-types';

// Types
export interface AppointmentFilters extends PaginationParams, DateRangeParams {
  patientId?: string;
  type?: 'initial' | 'followup' | 'checkup';
  status?: 'scheduled' | 'completed' | 'canceled';
}

export interface CreateAppointmentData {
  patientId: string;
  title: string;
  date: string;
  duration: number;
  notes?: string;
  type: 'initial' | 'followup' | 'checkup';
}

// API functions
export const getAppointments = async (filters?: AppointmentFilters): Promise<PaginatedResponse<Appointment>> => {
  const response = await apiClient.get<PaginatedResponse<Appointment>>('/appointments', { params: filters });
  return response.data;
};

export const getAppointmentById = async (id: string): Promise<Appointment> => {
  const response = await apiClient.get<ApiResponse<Appointment>>(`/appointments/${id}`);
  return response.data.data;
};

export const createAppointment = async (data: CreateAppointmentData): Promise<Appointment> => {
  const response = await apiClient.post<ApiResponse<Appointment>>('/appointments', data);
  return response.data.data;
};

export const updateAppointment = async (id: string, data: Partial<CreateAppointmentData>): Promise<Appointment> => {
  const response = await apiClient.put<ApiResponse<Appointment>>(`/appointments/${id}`, data);
  return response.data.data;
};

export const deleteAppointment = async (id: string): Promise<void> => {
  await apiClient.delete(`/appointments/${id}`);
};
