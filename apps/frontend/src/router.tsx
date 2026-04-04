import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { RequireAuth } from './components/auth/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { LoadingScreen } from './components/ui/loading-screen';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const PatientsListPage = lazy(() => import('./pages/patients/PatientsListPage'));
const PatientDetailPage = lazy(() => import('./pages/patients/PatientDetailPage'));
const PatientNewPage = lazy(() => import('./pages/patients/PatientNewPage'));
const PatientEditPage = lazy(() => import('./pages/patients/PatientEditPage'));
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./pages/appointments/AppointmentDetailPage'));
const NotesPage = lazy(() => import('./pages/notes/NotesPage'));
const NoteNewPage = lazy(() => import('./pages/notes/NoteNewPage'));
const NoteDetailPage = lazy(() => import('./pages/notes/NoteDetailPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const NutritionalPage = lazy(() => import('./pages/nutritional/NutritionalPage'));
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* App routes — protégées */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Patients */}
          <Route path="/patients" element={<PatientsListPage />} />
          <Route path="/patients/new" element={<PatientNewPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/patients/:id/edit" element={<PatientEditPage />} />

          {/* Rendez-vous */}
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

          {/* Calendrier */}
          <Route path="/calendar" element={<CalendarPage />} />

          {/* Notes */}
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/new" element={<NoteNewPage />} />
          <Route path="/notes/:id" element={<NoteDetailPage />} />

          {/* Tâches */}
          <Route path="/tasks" element={<TasksPage />} />

          {/* Suivi nutritionnel */}
          <Route path="/nutritional/:patientId" element={<NutritionalPage />} />

          {/* Documents */}
          <Route path="/documents" element={<DocumentsPage />} />

          {/* Reporting & Analytics */}
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />

          {/* Profil & Paramètres */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Administration */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/*" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
