// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  PRATICIENNE = 'PRATICIENNE',
  ASSISTANTE = 'ASSISTANTE',
}

export enum PatientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum AppointmentType {
  IN_PERSON = 'IN_PERSON',
  VIDEO = 'VIDEO',
  PHONE = 'PHONE',
}

export enum ConsultationStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum DocumentType {
  ANALYSIS = 'ANALYSIS',
  PRESCRIPTION = 'PRESCRIPTION',
  REPORT = 'REPORT',
  CONSENT = 'CONSENT',
  OTHER = 'OTHER',
}

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  FINALIZE = 'FINALIZE',
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export interface PatientDto {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: PatientStatus;
  tags: TagDto[];
  practitionerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  status: PatientStatus;
  tags: TagDto[];
  lastAppointmentAt: string | null;
  nextAppointmentAt: string | null;
  /** Latest BMI (practitioner only) */
  bmi?: { value: number; category: 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY' } | null;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContact?: EmergencyContactDto;
  tagIds?: string[];
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {
  status?: PatientStatus;
  privateNote?: string;
}

export interface EmergencyContactDto {
  name: string;
  phone: string;
  relationship?: string;
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export interface AppointmentDto {
  id: string;
  patientId: string;
  patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName'>;
  practitionerId: string;
  startAt: string;
  endAt: string;
  duration: number;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string | null;
  consultation?: { id: string; status: ConsultationStatus } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  startAt: string;
  duration: number;
  type: AppointmentType;
  reason?: string;
}

export interface UpdateAppointmentDto extends Partial<CreateAppointmentDto> {
  status?: AppointmentStatus;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface DocumentDto {
  id: string;
  patientId: string;
  name: string;
  type: DocumentType;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  patientId: string | null;
  patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName'> | null;
  appointmentId: string | null;
  assignedToId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  patientId?: string;
  appointmentId?: string;
  assignedToId?: string;
  priority?: TaskPriority;
  dueAt?: string;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export interface TagDto {
  id: string;
  name: string;
  color: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLogDto {
  id: string;
  userId: string;
  user: Pick<UserDto, 'id' | 'firstName' | 'lastName' | 'email'>;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Common ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface SearchResult {
  patients: PatientListItemDto[];
  appointments: AppointmentDto[];
  consultations: ConsultationSummaryDto[];
}

/** A session as listed on the dashboard or in search results. */
export interface ConsultationSummaryDto {
  id: string;
  date: string;
  status?: ConsultationStatus;
  patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName'>;
}

export interface DashboardSummary {
  todayAppointments: AppointmentDto[];
  upcomingAppointments: AppointmentDto[];
  pendingTasks: TaskDto[];
  draftConsultations: ConsultationSummaryDto[];
  activePatientCount: number;
  weekStats: {
    appointmentsCount: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
  };
}
