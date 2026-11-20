import { vi } from 'vitest';

// Mock PrismaService globally
export const mockPrisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
  patient: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  appointment: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
  consultation: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  measurement: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  topicNote: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  lifeEvent: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  goal: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  goalReview: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  task: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  document: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  notification: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  refreshToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  tag: { findMany: vi.fn() },
  // Runs the given operations, or the callback with this mock as the transaction client
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg as unknown[]),
  ),
};

export const mockNotifications = {
  create: vi.fn().mockResolvedValue({}),
  findAll: vi.fn().mockResolvedValue([]),
  markAsRead: vi.fn().mockResolvedValue({}),
  markAllAsRead: vi.fn().mockResolvedValue({}),
  unreadCount: vi.fn().mockResolvedValue(0),
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
    passwordHash: '$2b$12$hashedpassword',
    isActive: true,
    loginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
