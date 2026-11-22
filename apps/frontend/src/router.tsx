import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { RequireAuth } from './components/auth/RequireAuth';
import { RequireRole, RoleHome } from './components/auth/RequireRole';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { LoadingScreen } from './components/ui/loading-screen';
import { ADMIN_ROLES, CLINICAL_ROLES, PRACTITIONER_ROLES } from './lib/roles';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const PatientsListPage = lazy(() => import('./pages/patients/PatientsListPage'));
const PatientDetailPage = lazy(() => import('./pages/patients/PatientDetailPage'));
const PatientNewPage = lazy(() => import('./pages/patients/PatientNewPage'));
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./pages/appointments/AppointmentDetailPage'));
const ConsultationPage = lazy(() => import('./pages/consultations/ConsultationPage'));
const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* App routes — protégées */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<RoleHome />} />

          {/* Patients' data: practitioners (and assistants), never admins */}
          <Route element={<RequireRole roles={CLINICAL_ROLES} />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Patients — sessions, measurements, documents and tasks live in the patient's file */}
            <Route path="/patients" element={<PatientsListPage />} />
            <Route path="/patients/new" element={<PatientNewPage />} />
            <Route path="/patients/:id" element={<PatientDetailPage />} />
            <Route path="/consultations/:id" element={<ConsultationPage />} />

            {/* Rendez-vous */}
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          </Route>

          {/* Factures: the practitioner's own */}
          <Route element={<RequireRole roles={PRACTITIONER_ROLES} />}>
            <Route path="/invoices" element={<InvoicesPage />} />
          </Route>

          {/* Administration: the app and its users */}
          <Route element={<RequireRole roles={ADMIN_ROLES} />}>
            <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
          </Route>

          {/* Paramètres */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
