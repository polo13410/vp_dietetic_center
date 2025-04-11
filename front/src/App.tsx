import AuthRedirect from "@/components/auth/AuthRedirect";
import PageTitle from "@/components/layout/PageTitle";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import PatientForm from "./components/patients/PatientForm";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import Patients from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import NotificationsTest from "./pages/NotificationsTest";
import PatientView from "./pages/PatientView";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <NotificationProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthRedirect>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <>
                        <PageTitle title="Login" />
                        <Login />
                      </>
                    }
                  />
                  <Route
                    path="/patients"
                    element={
                      <>
                        <PageTitle title="Patients" />
                        <Patients />
                      </>
                    }
                  />
                  <Route path="/patient/:id" element={<PatientView />} />
                  <Route
                    path="/add-patient"
                    element={
                      <>
                        <PageTitle title="Add New Patient" />
                        <div className="min-h-screen">
                          <Sidebar onWidthChange={handleSidebarWidthChange} />
                          <div
                            className="transition-all duration-300"
                            style={{ marginLeft: `${sidebarWidth}px` }}
                          >
                            <div className="max-w-3xl mx-auto pt-12 pb-16 px-6">
                              <h1 className="text-2xl font-bold mb-6">
                                Add New Patient
                              </h1>
                              <PatientForm />
                            </div>
                          </div>
                        </div>
                      </>
                    }
                  />
                  <Route
                    path="/patient/:id/edit"
                    element={
                      <>
                        <PageTitle title="Edit Patient" />
                        <div className="min-h-screen">
                          <Sidebar onWidthChange={handleSidebarWidthChange} />
                          <div
                            className="transition-all duration-300"
                            style={{ marginLeft: `${sidebarWidth}px` }}
                          >
                            <div className="max-w-3xl mx-auto pt-12 pb-16 px-6">
                              <h1 className="text-2xl font-bold mb-6">
                                Edit Patient
                              </h1>
                              <PatientForm patient={undefined} />
                            </div>
                          </div>
                        </div>
                      </>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <>
                        <PageTitle title="Calendar" />
                        <Calendar />
                      </>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <>
                        <PageTitle title="Profile" />
                        <Profile />
                      </>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <>
                        <PageTitle title="Analytics" />
                        <Analytics />
                      </>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <>
                        <PageTitle title="Settings" />
                        <Settings />
                      </>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <>
                        <PageTitle title="Notifications" />
                        <NotificationsTest />
                      </>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthRedirect>
            </BrowserRouter>
          </NotificationProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
