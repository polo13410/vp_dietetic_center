import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LoadingSpinner } from '../ui/loading-screen';

export default function NutritionTrends() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'nutrition-trends'],
    queryFn: async () => {
      const { data } = await api.get('/reports/nutrition-trends');
      return data as Array<{
        month: string;
        avgWeight: number | null;
        avgBmi: number | null;
        avgEnergy: number | null;
        avgWater: number | null;
      }>;
    },
  });

  if (isLoading) return <LoadingSpinner />;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Aucune donnée nutritionnelle enregistrée pour l'instant.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Poids moyen des patients (kg)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(value) => [`${value} kg`, 'Poids moyen']} />
              <Area
                type="monotone"
                dataKey="avgWeight"
                name="Poids moyen"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorWeight)"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">IMC & Niveau d'énergie</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgBmi"
                name="IMC moyen"
                stroke="#82ca9d"
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgEnergy"
                name="Énergie (0-10)"
                stroke="#ffc658"
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hydratation moyenne (L/j)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#00C49F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(value) => [`${value} L`, 'Hydratation moyenne']} />
              <Area
                type="monotone"
                dataKey="avgWater"
                name="Eau (L)"
                stroke="#00C49F"
                fillOpacity={1}
                fill="url(#colorWater)"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
