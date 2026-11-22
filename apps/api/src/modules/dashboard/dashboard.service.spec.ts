import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { createMockUser, mockPrisma } from '../../test/setup';

import { DashboardService } from './dashboard.service';

const NOW = new Date('2026-11-20T11:00:00');
const at = (iso: string) => new Date(iso);

describe('DashboardService', () => {
  let service: DashboardService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    service = new DashboardService(mockPrisma as any, new PatientAccessService(mockPrisma as any));
    mockPrisma.appointment.findMany.mockResolvedValue([
      { id: 'a1', status: 'COMPLETED', startAt: at('2026-11-20T09:00:00') },
      { id: 'a2', status: 'CONFIRMED', startAt: at('2026-11-20T14:00:00') },
      { id: 'a3', status: 'CANCELLED', startAt: at('2026-11-20T16:00:00') },
    ]);
    mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'a2' });
    mockPrisma.appointment.count.mockResolvedValue(9);
    mockPrisma.patient.count.mockResolvedValue(12);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.patient.findMany.mockResolvedValue([
      { id: 'p1', firstName: 'A', lastName: 'Seen 50 days ago', appointments: [{ startAt: at('2026-10-01T11:00:00') }] },
      { id: 'p2', firstName: 'B', lastName: 'Never seen', appointments: [] },
      { id: 'p3', firstName: 'C', lastName: 'Seen 80 days ago', appointments: [{ startAt: at('2026-09-01T11:00:00') }] },
    ]);
  });

  afterEach(() => vi.useRealTimers());

  it("counts today's appointments, the remaining ones and the week", async () => {
    const { stats, nextAppointment } = await service.getSummary(user as any);
    expect(stats).toEqual({
      todayCount: 2, // cancelled ones do not count
      todayRemaining: 1,
      weekAppointmentCount: 9,
      followedPatientCount: 12,
    });
    expect(nextAppointment).toEqual({ id: 'a2' });
  });

  it("only looks at the practitioner's own current patients", async () => {
    await service.getSummary(user as any);
    expect(mockPrisma.appointment.findMany.mock.calls[0][0].where.practitionerId).toBe(user.id);
    expect(mockPrisma.patient.count.mock.calls[0][0].where).toMatchObject({
      practitionerId: user.id,
      archivedAt: null,
    });
  });

  it('lists patients to follow up: never seen first, then the longest without a visit', async () => {
    const { followUps } = await service.getSummary(user as any);
    expect(followUps.map((f) => f.patient.id)).toEqual(['p2', 'p3', 'p1']);
    expect(followUps[1].daysSince).toBe(80);
    expect(followUps[0].lastSeenAt).toBeNull();
    // Only patients with nothing booked and no visit in the last 6 weeks are asked for
    const where = mockPrisma.patient.findMany.mock.calls[0][0].where;
    expect(where.appointments.none.OR).toHaveLength(2);
  });

  it('gives admins nothing', async () => {
    const admin = createMockUser({ id: 'admin-1', role: 'ADMIN' });
    await service.getSummary(admin as any);
    expect(mockPrisma.appointment.findMany.mock.calls[0][0].where.id).toEqual({ in: [] });
    expect(mockPrisma.patient.count.mock.calls[0][0].where.id).toEqual({ in: [] });
  });
});
