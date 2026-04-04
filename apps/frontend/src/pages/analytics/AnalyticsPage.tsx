import { Suspense, lazy } from 'react';

import { LoadingSpinner } from '../../components/ui/loading-screen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const PatientStatistics = lazy(() => import('../../components/analytics/PatientStatistics'));
const NutritionTrends = lazy(() => import('../../components/analytics/NutritionTrends'));
const AppointmentOverview = lazy(() => import('../../components/analytics/AppointmentOverview'));

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tableau de bord analytique</h1>

      <Tabs defaultValue="patients" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="patients">Statistiques patients</TabsTrigger>
          <TabsTrigger value="nutrition">Tendances nutritionnelles</TabsTrigger>
          <TabsTrigger value="appointments">Vue rendez-vous</TabsTrigger>
        </TabsList>

        <Suspense fallback={<LoadingSpinner />}>
          <TabsContent value="patients" className="space-y-6">
            <PatientStatistics />
          </TabsContent>

          <TabsContent value="nutrition" className="space-y-6">
            <NutritionTrends />
          </TabsContent>

          <TabsContent value="appointments" className="space-y-6">
            <AppointmentOverview />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
