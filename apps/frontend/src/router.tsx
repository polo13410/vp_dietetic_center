import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { LoadingScreen } from './components/ui/loading-screen';
import { RequireAuth } from './components/auth/RequireAuth';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const PatientsListPage = lazy(() => import('./pages/patients/PatientsListPage'));
const PatientDetailPage = lazy(() => import('./pages/patients/PatientDetailPage'));
const PatientNewPage = lazy(() => import('./pages/patients/PatientNewPage'));
const AppointmentsPage = lazy(() => import('./pages/appointments/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./pages/appointments/AppointmentDetailPage'));
const NotesPage = lazy(() => import('./pages/notes/NotesPage'));
const NoteDetailPage = lazy(() => import('./pages/notes/NoteDetailPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const NutritionalPage = lazy(() => import('./pages/nutritional/NutritionalPage'));
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
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

          {/* Rendez-vous */}
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

          {/* Notes */}
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<NoteDetailPage />} />

          {/* Tâches */}
          <Route path="/tasks" element={<TasksPage />} />

          {/* Suivi nutritionnel */}
          <Route path="/nutritional/:patientId" element={<NutritionalPage />} />

          {/* Documents */}
          <Route path="/documents" element={<DocumentsPage />} />

          {/* Reporting */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Administration */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/*" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
