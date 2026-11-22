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
      { id: 'a1', status: 'COMPLETED', startAt: at('2026-11-20T09:00:00'), consultation: { id: 'c1' } },
      { id: 'a2', status: 'CONFIRMED', startAt: at('2026-11-20T14:00:00'), consultation: null },
    ]);
    mockPrisma.task.findMany.mockResolvedValue([{ id: 't1' }]);
    mockPrisma.patient.findMany.mockResolvedValue([
      { id: 'p1', firstName: 'A', lastName: 'Session 50 days ago', consultations: [{ date: at('2026-10-01T11:00:00') }] },
      { id: 'p2', firstName: 'B', lastName: 'No session', consultations: [] },
      { id: 'p3', firstName: 'C', lastName: 'Session 80 days ago', consultations: [{ date: at('2026-09-01T11:00:00') }] },
    ]);
  });

  afterEach(() => vi.useRealTimers());

  it('returns the four sections’ data and nothing left from dropped features', async () => {
    const summary = await service.getSummary(user as any);
    expect(Object.keys(summary).sort()).toEqual(['followUps', 'tasks', 'todayAppointments']);
    expect(summary.tasks).toEqual([{ id: 't1' }]);
  });

  it("lists today's appointments with their session, from midnight to midnight", async () => {
    const { todayAppointments } = await service.getSummary(user as any);
    expect(todayAppointments.map((a) => a.id)).toEqual(['a1', 'a2']);
    const query = mockPrisma.appointment.findMany.mock.calls[0][0];
    expect(query.where.startAt).toEqual({ gte: at('2026-11-20T00:00:00'), lt: at('2026-11-21T00:00:00') });
    expect(query.include.consultation).toEqual({ select: { id: true } });
    expect(query.orderBy).toEqual({ startAt: 'asc' });
  });

  it("only looks at the practitioner's own current patients", async () => {
    await service.getSummary(user as any);
    expect(mockPrisma.appointment.findMany.mock.calls[0][0].where.practitionerId).toBe(user.id);
    expect(mockPrisma.patient.findMany.mock.calls[0][0].where).toMatchObject({
      practitionerId: user.id,
      archivedAt: null,
      deletedAt: null,
    });
  });

  it('lists patients to follow up: no session first, then the longest without a session', async () => {
    const { followUps } = await service.getSummary(user as any);
    expect(followUps.map((f) => f.patient.id)).toEqual(['p2', 'p3', 'p1']);
    expect(followUps[0]).toMatchObject({ lastSessionAt: null, daysSince: null });
    expect(followUps[1]).toMatchObject({ lastSessionAt: at('2026-09-01T11:00:00'), daysSince: 80 });
  });

  it('asks only for patients with no session in 6 weeks and nothing booked', async () => {
    await service.getSummary(user as any);
    const where = mockPrisma.patient.findMany.mock.calls[0][0].where;
    const sixWeeksAgo = new Date(NOW.getTime() - 42 * 24 * 3600 * 1000);
    expect(where.consultations).toEqual({ none: { date: { gte: sixWeeksAgo } } });
    expect(where.appointments).toEqual({
      none: { startAt: { gte: NOW }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    });
    // A patient created this week has had no time for a session yet
    expect(where.createdAt).toEqual({ lt: sixWeeksAgo });
  });

  it('keeps at most 10 patients to follow up', async () => {
    mockPrisma.patient.findMany.mockResolvedValue(
      Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, firstName: 'X', lastName: 'Y', consultations: [] })),
    );
    const { followUps } = await service.getSummary(user as any);
    expect(followUps).toHaveLength(10);
  });

  it('lists the open tasks assigned to or created by the user', async () => {
    await service.getSummary(user as any);
    const where = mockPrisma.task.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ assignedToId: user.id }, { createdById: user.id }]);
    expect(where.status).toEqual({ in: ['PENDING', 'IN_PROGRESS'] });
  });

  it('gives admins nothing', async () => {
    const admin = createMockUser({ id: 'admin-1', role: 'ADMIN' });
    await service.getSummary(admin as any);
    expect(mockPrisma.appointment.findMany.mock.calls[0][0].where.id).toEqual({ in: [] });
    expect(mockPrisma.patient.findMany.mock.calls[0][0].where.id).toEqual({ in: [] });
  });
});
