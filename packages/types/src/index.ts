// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  PRATICIENNE = 'PRATICIENNE',
  ASSISTANTE = 'ASSISTANTE',
}

export enum Sex {
  F = 'F',
  M = 'M',
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

/** How a session was paid. NONE = « Non réglé ». */
export enum PaymentMethod {
  CASH = 'CASH',
  CHECK = 'CHECK',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  NONE = 'NONE',
}

/** Sections of the medical file, in the practitioner's order. */
export enum FileField {
  HEALTH = 'HEALTH',
  FAMILY_HISTORY = 'FAMILY_HISTORY',
  PSYCHOLOGY = 'PSYCHOLOGY',
  PHYSICAL_ACTIVITY = 'PHYSICAL_ACTIVITY',
  WEIGHT_HISTORY = 'WEIGHT_HISTORY',
  ALLERGIES = 'ALLERGIES',
  BLOOD_GLUCOSE = 'BLOOD_GLUCOSE',
  CHOLESTEROL_TRIGLYCERIDES = 'CHOLESTEROL_TRIGLYCERIDES',
  AVERSIONS = 'AVERSIONS',
  TASTES = 'TASTES',
}

export enum GpReportStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
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

/** No password: the person signs in with the Google account of this address. */
export interface CreateUserDto {
  email: string;
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

// ─── Settings (the signed-in user) ─────────────────────────────────────────────

/** Appearance: LIGHT, DARK, or SYSTEM (follows the device). */
export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';

/** GET /me */
export interface MeDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  theme: Theme;
}

/** PATCH /me */
export interface UpdateMeDto {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  theme?: Theme;
}

/** GET/PATCH /me/activity: who she is, printed on the invoices. Empty fields are null. */
export interface ActivityDto {
  /** Name printed on the invoices */
  practiceName: string | null;
  /** 14 digits */
  siret: string | null;
  /** ADELI (9 digits) or RPPS (11 digits) */
  adeliRpps: string | null;
  vatMention: string | null;
  invoiceFooter: string | null;
}

/** GET /me/practices: where she consults, active ones first (default one first), then archived. */
export interface PracticeDto {
  id: string;
  name: string;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  phone: string | null;
  /** Only when it differs from the activity's */
  siret: string | null;
  /** Exactly one active practice is the default one */
  isDefault: boolean;
  archivedAt: string | null;
}

export interface CreatePracticeDto {
  name: string;
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
  phone?: string | null;
  siret?: string | null;
}

export interface UpdatePracticeDto extends Partial<CreatePracticeDto> {
  /** true: becomes the default one (the previous default stops being it) */
  isDefault?: true;
  /** true: archived (not the last active one); false: offered again */
  archived?: boolean;
}

/** GET /me/formulas: offered ones first (in her order), then archived ones. */
export interface FormulaDto {
  id: string;
  label: string;
  /** Null: price still to fill in */
  priceCents: number | null;
  /** Duration of an appointment of this type */
  durationMinutes: number;
  position: number;
  /** Set: no longer offered for new sessions */
  archivedAt: string | null;
}

export interface CreateFormulaDto {
  label: string;
  priceCents?: number | null;
  durationMinutes?: number;
}

export interface UpdateFormulaDto {
  label?: string;
  priceCents?: number | null;
  durationMinutes?: number;
  /** false: offer an archived formula again */
  archived?: boolean;
}

/** DELETE /me/formulas/:id: a formula used by sessions is archived instead of deleted. */
export interface RemoveFormulaResult {
  deleted: boolean;
  formula: FormulaDto | null;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

/** Adult BMI categories (18 and over) */
export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY';

/** Under 18: where the BMI falls among the IOTF curves (grade 3 is the most severe thinness) */
export type IotfClass = 'THINNESS_3' | 'THINNESS_2' | 'THINNESS_1' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY';

/** The IOTF cut-offs at one age, named by the adult BMI each curve reaches at 18 */
export interface IotfCutoffsDto {
  thinness3: number;
  thinness2: number;
  thinness1: number;
  overweight: number;
  obesity: number;
}

export interface BmiDto {
  value: number;
  /** Adult category; null under 18, where `child` applies instead */
  category: BmiCategory | null;
  child: {
    /** Exact age at the measurement, in years */
    ageYears: number;
    /** Null before 2 years or when the sex is not known */
    class: IotfClass | null;
    cutoffs: IotfCutoffsDto | null;
  } | null;
}

/** Basal metabolic rate per day */
export interface BmrDto {
  mj: number;
  kcal: number;
  /** Under 18: the Black formula is an adult one, shown with « formule adulte » */
  adultFormulaForMinor: boolean;
}

export interface PatientDto {
  id: string;
  firstName: string;
  lastName: string;
  sex: Sex | null;
  dateOfBirth: string | null;
  /** Only the age was known: dateOfBirth is January 1st of the estimated birth year */
  birthDateEstimated: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  familySituation: string | null;
  profession: string | null;
  /** Médecin traitant */
  gpName: string | null;
  /** Motif (practitioner only) */
  consultationReason?: string | null;
  /** Adressé par */
  referralSource: string | null;
  archivedAt: string | null;
  practitionerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListItemDto extends PatientDto {
  lastAppointmentAt: string | null;
  /** Latest BMI (practitioner only) */
  bmi?: BmiDto | null;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  sex?: Sex | null;
  dateOfBirth?: string | null;
  /** Declared age, when the birth date is unknown (exclusive with dateOfBirth) */
  age?: number;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  familySituation?: string;
  profession?: string;
  gpName?: string;
  referralSource?: string;
  consultationReason?: string;
}

export type UpdatePatientDto = Partial<CreatePatientDto>;

// ─── Patient file ─────────────────────────────────────────────────────────────

/** What is needed for a figure and not known yet */
export type MissingData = 'weight' | 'height' | 'sex' | 'age';

/** Computed for each session, never stored (docs/REFONTE.md § 3.1). */
export interface SessionFiguresDto {
  /** Age on the session's date */
  age: number | null;
  /** Under 18 on that date */
  minor: boolean;
  weight: number | null;
  /** The height known on that date (§ 3.1), with its date */
  height: { value: number; measuredAt: string } | null;
  bmi: BmiDto | null;
  bmr: BmrDto | null;
  missing: MissingData[];
}

/** A session ("séance"): one row of the practitioner's follow-up sheet. */
export interface ConsultationDto {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string | null;
  date: string;
  formulaId: string | null;
  /** Copied from the formula at the time of the session */
  formulaLabel: string | null;
  priceCents: number | null;
  paymentMethod: PaymentMethod;
  /** Where it took place: its address goes on the invoice */
  practiceId: string | null;
  practice?: { id: string; name: string } | null;
  /** Habitudes et évolution */
  habits: string | null;
  /** Travail en consultation */
  sessionWork: string | null;
  /** Conseils diététiques */
  advice: string | null;
  createdAt: string;
  updatedAt: string;
  /** 0 for the « Bilan », then 1, 2… (« Suivi 1 », « Suivi 2 »…) */
  sequence: number;
  figures: SessionFiguresDto;
  weightChange: { sincePrevious: number | null; sinceFirst: number | null };
  /** Advice given at the previous session */
  previousAdvice: string | null;
}

export interface UpdateConsultationDto {
  date?: string;
  formulaId?: string | null;
  paymentMethod?: PaymentMethod;
  practiceId?: string;
  habits?: string;
  sessionWork?: string;
  advice?: string;
}

/** One version of a section of the medical file. */
export interface FileEntryDto {
  id: string;
  patientId: string;
  consultationId: string | null;
  field: FileField;
  content: string;
  /** Day of this version */
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** A section of the medical file: its current value and how many versions it has. */
export interface FileSectionDto {
  field: FileField;
  current: Pick<FileEntryDto, 'id' | 'field' | 'content' | 'date' | 'updatedAt' | 'consultationId'> | null;
  versionCount: number;
}

/** A report to the patient's general practitioner. */
export interface GpReportDto {
  id: string;
  patientId: string;
  authorId: string;
  date: string;
  content: string;
  status: GpReportStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A report as it will be printed: with her letterhead (« Mon activité » and her default practice). */
export interface GpReportDocumentDto extends GpReportDto {
  patient: { firstName: string; lastName: string; gpName: string | null };
  /** Name of the practice first, then address, phone, e-mail, ADELI or RPPS */
  letterhead: string[];
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
  /** Type of appointment (one of her formulas) */
  formulaId: string | null;
  formula: { id: string; label: string } | null;
  /** Where it takes place; null for a video or phone appointment */
  practiceId: string | null;
  practice: { id: string; name: string } | null;
  /** Optional note */
  reason: string | null;
  consultation?: { id: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  startAt: string;
  /** Minutes; defaults to the duration of the formula */
  duration?: number;
  type: AppointmentType;
  formulaId?: string | null;
  /** In person: defaults to her default practice. Ignored for video and phone. */
  practiceId?: string | null;
  reason?: string | null;
}

/** GET /appointments/options?patientId=: what an appointment of that patient can be booked with. */
export interface BookingOptionsDto {
  /** Her offered formulas, in her order */
  formulas: Pick<FormulaDto, 'id' | 'label' | 'priceCents' | 'durationMinutes'>[];
  /** Her active practices, the default one first */
  practices: Pick<PracticeDto, 'id' | 'name' | 'address' | 'zipCode' | 'city' | 'isDefault'>[];
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
  patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName'>;
}

/** An appointment as shown on the dashboard, with its session if one was started. */
export interface DashboardAppointmentDto extends AppointmentDto {
  consultation: { id: string } | null;
}

export interface DashboardSummary {
  /** Today's appointments, earliest first, with their session if it was started */
  todayAppointments: DashboardAppointmentDto[];
  /** Current patients with nothing booked and no session for 6 weeks */
  followUps: {
    patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName' | 'phone' | 'email'>;
    /** Date of the last session, null if there never was one */
    lastSessionAt: string | null;
    daysSince: number | null;
  }[];
  tasks: TaskDto[];
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

/** INVOICE: « facture » (2026-0001). CREDIT_NOTE: « avoir » (A-2026-0001), cancels an invoice. */
export enum InvoiceType {
  INVOICE = 'INVOICE',
  CREDIT_NOTE = 'CREDIT_NOTE',
}

/** Another document an invoice is linked to */
export interface InvoiceLinkDto {
  id: string;
  number: string;
  issuedAt: string;
}

/**
 * An invoice or a credit note. Never changed once issued: it keeps copies of the practice,
 * the patient and the session as they were then (patientId / consultationId become null
 * when those are deleted).
 */
export interface InvoiceDto {
  id: string;
  practitionerId: string;
  patientId: string | null;
  consultationId: string | null;
  type: InvoiceType;
  year: number;
  sequence: number;
  /** "2026-0001" or "A-2026-0001" */
  number: string;
  issuedAt: string;
  /** Negative for a credit note */
  amountCents: number;
  paymentMethod: PaymentMethod;
  /** Formula of the session */
  serviceLabel: string;
  /** Date of the session */
  serviceDate: string;
  practiceName: string;
  practiceAddress: string | null;
  practiceZipCode: string | null;
  practiceCity: string | null;
  siret: string | null;
  adeliRpps: string | null;
  vatMention: string | null;
  invoiceFooter: string | null;
  patientFirstName: string;
  patientLastName: string;
  patientAddress: string | null;
  patientZipCode: string | null;
  patientCity: string | null;
  /** Invoices: set once cancelled by a credit note */
  cancelledAt: string | null;
  cancelReason: string | null;
  creditNoteId: string | null;
  replacedById: string | null;
  createdAt: string;
  /** Invoices: the credit note that cancels it */
  creditNote: InvoiceLinkDto | null;
  /** Invoices: the invoice issued in its place */
  replacedBy: InvoiceLinkDto | null;
  /** Credit notes: the invoice it cancels */
  cancels: InvoiceLinkDto | null;
  /** The invoice this one replaces */
  replaces: InvoiceLinkDto | null;
}

/** What an invoice no longer matches in its session */
export type InvoiceMismatch = 'formula' | 'price' | 'paymentMethod' | 'date' | 'practice';

/** Totals of invoices in force (cancelled invoices and credit notes are left out). */
export interface InvoiceTotalsDto {
  /** Paid by any means (« encaissé ») */
  collectedCents: number;
  /** Invoiced « Non réglé » */
  unpaidCents: number;
  count: number;
  byPaymentMethod: Record<PaymentMethod, number>;
}

/** GET /invoices?from=&to= (Paris days, both included) */
export interface InvoiceListDto {
  from: string;
  to: string;
  invoices: InvoiceDto[];
  totals: InvoiceTotalsDto & { byMonth: (InvoiceTotalsDto & { month: string })[] };
}

/** GET /patients/:id/invoices (latest first) */
export interface PatientInvoicesDto {
  invoices: InvoiceDto[];
  totals: InvoiceTotalsDto;
}

/** GET /consultations/:id/invoices */
export interface SessionInvoicesDto {
  /** The invoice in force, if the session was invoiced */
  current: InvoiceDto | null;
  mismatches: InvoiceMismatch[];
  /** Cancelled invoices and credit notes of the session, latest first */
  history: InvoiceDto[];
}

/** GET /invoices/to-issue: a session without an invoice in force */
export interface SessionToInvoiceDto {
  id: string;
  date: string;
  formulaLabel: string | null;
  priceCents: number | null;
  paymentMethod: PaymentMethod;
  patient: Pick<PatientDto, 'id' | 'firstName' | 'lastName'>;
}

/** POST /invoices/:id/cancel */
export interface CancelInvoiceDto {
  reason?: string;
}
