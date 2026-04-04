import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockPrisma } from '../../test/setup';

import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchService(mockPrisma as any);
  });

  describe('globalSearch', () => {
    it('searches patients, appointments, and notes in parallel', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1', firstName: 'Marie' }]);
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.clinicalNote.findMany.mockResolvedValue([]);

      const result = await service.search('Marie', user as any);

      expect(result.patients).toHaveLength(1);
      expect(result.appointments).toHaveLength(0);
      expect(result.notes).toHaveLength(0);
    });

    it('returns empty results for empty query', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([]);
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.clinicalNote.findMany.mockResolvedValue([]);

      const result = await service.search('', user as any);
      expect(result.patients).toHaveLength(0);
    });
  });

  describe('getDashboardSummary', () => {
    it('returns dashboard aggregations', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.clinicalNote.findMany.mockResolvedValue([]);
      mockPrisma.patient.count.mockResolvedValue(10);

      const result = await service.getDashboardSummary(user as any);

      expect(result).toHaveProperty('activePatientCount', 10);
      expect(result).toHaveProperty('todayAppointments');
      expect(result).toHaveProperty('pendingTasks');
    });
  });
});
