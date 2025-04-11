import AppointmentOverview from "@/components/analytics/AppointmentOverview";
import NutritionTrends from "@/components/analytics/NutritionTrends";
import PatientStatistics from "@/components/analytics/PatientStatistics";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

const Analytics = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  return (
    <div className="min-h-screen ">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <Header sidebarWidth={sidebarWidth} />
      <main
        className="pt-24 pb-16 px-6 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>

          <Tabs defaultValue="patients" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="patients">Patient Statistics</TabsTrigger>
              <TabsTrigger value="nutrition">Nutrition Trends</TabsTrigger>
              <TabsTrigger value="appointments">
                Appointment Overview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="patients" className="space-y-6">
              <PatientStatistics />
            </TabsContent>

            <TabsContent value="nutrition" className="space-y-6">
              <NutritionTrends />
            </TabsContent>

            <TabsContent value="appointments" className="space-y-6">
              <AppointmentOverview />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
