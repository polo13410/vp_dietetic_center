import { vi } from 'vitest';

// Mock PrismaService globally
export const mockPrisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
  patient: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  appointment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
  consultation: { count: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  measurement: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  fileEntry: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  lifeEvent: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  gpReport: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  formula: { count: vi.fn(), createMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  invoice: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  userPreferences: { upsert: vi.fn() },
  practitionerProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  practice: { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  task: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  document: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  refreshToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $executeRaw: vi.fn().mockResolvedValue(1),
  // Runs the given operations, or the callback with this mock as the transaction client
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg as unknown[]),
  ),
};

export const mockAccess = {
  patientScope: vi.fn((user: { id: string; role: string }) =>
    user.role === 'PRATICIENNE' ? { practitionerId: user.id } : { id: { in: [] } },
  ),
  canAccess: vi.fn((user: { id: string; role: string }, practitionerId: string, level = 'full') =>
    user.role === 'PRATICIENNE' ? practitionerId === user.id : user.role === 'ASSISTANTE' && level === 'record',
  ),
  assertOwner: vi.fn(),
  assertPatient: vi.fn().mockResolvedValue({ practitionerId: 'user-1' }),
  appointmentScope: vi.fn((user: { id: string; role: string }) =>
    user.role === 'PRATICIENNE'
      ? { practitionerId: user.id }
      : user.role === 'ASSISTANTE'
        ? {}
        : { id: { in: [] } },
  ),
  assertCanManageAppointment: vi.fn(),
  assertAppointment: vi.fn().mockResolvedValue(undefined),
};

export function createMockUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'PRATICIENNE' as const,
    googleId: null as string | null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
