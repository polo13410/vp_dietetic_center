
import { Patient } from '@/utils/dummyData';
import { apiClient } from '../config/axios';
import { ApiResponse, PaginatedResponse, PaginationParams } from '../types/api-types';

// Types
export interface PatientFilters extends PaginationParams {
  search?: string;
  status?: 'active' | 'archived';
}

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  healthData?: {
    height?: number;
    weight?: number;
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
  };
}

// API functions
export const getPatients = async (filters?: PatientFilters): Promise<PaginatedResponse<Patient>> => {
  const response = await apiClient.get<PaginatedResponse<Patient>>('/patients', { params: filters });
  return response.data;
};

export const getPatientById = async (id: number): Promise<Patient> => {
  const response = await apiClient.get<Patient>(`/addresses/${id}`);
  return response.data;
};

export const createPatient = async (data: CreatePatientData): Promise<Patient> => {
  const response = await apiClient.post<ApiResponse<Patient>>('/patients', data);
  return response.data.data;
};

export const updatePatient = async (id: number, data: Partial<CreatePatientData>): Promise<Patient> => {
  const response = await apiClient.put<ApiResponse<Patient>>(`/patients/${id}`, data);
  return response.data.data;
};

export const deletePatient = async (id: number): Promise<void> => {
  await apiClient.delete(`/patients/${id}`);
};

export const getPatientIndicators = async (id: number): Promise<Patient['indicators']> => {
  const response = await apiClient.get<ApiResponse<Patient['indicators']>>(`/patients/${id}/indicators`);
  return response.data.data;
};

export const getPatientFoodJournal = async (id: number): Promise<Patient['foodJournal']> => {
  const response = await apiClient.get<ApiResponse<Patient['foodJournal']>>(`/patients/${id}/food-journal`);
  return response.data.data;
};
