import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const monthlyCalorieData = [
  { month: 'Jan', average: 2100 },
  { month: 'Fév', average: 2050 },
  { month: 'Mar', average: 1950 },
  { month: 'Avr', average: 1900 },
  { month: 'Mai', average: 1850 },
  { month: 'Juin', average: 1800 },
  { month: 'Juil', average: 1750 },
];

const macronutrientData = [
  { name: 'Sem 1', protein: 75, carbs: 220, fat: 65 },
  { name: 'Sem 2', protein: 80, carbs: 210, fat: 60 },
  { name: 'Sem 3', protein: 85, carbs: 200, fat: 55 },
  { name: 'Sem 4', protein: 90, carbs: 190, fat: 50 },
  { name: 'Sem 5', protein: 95, carbs: 180, fat: 45 },
  { name: 'Sem 6', protein: 100, carbs: 170, fat: 40 },
];

const dietPreferenceData = [
  { name: 'Standard', value: 45 },
  { name: 'Végétarien', value: 20 },
  { name: 'Végan', value: 15 },
  { name: 'Keto', value: 10 },
  { name: 'Paléo', value: 5 },
  { name: 'Sans gluten', value: 5 },
];

export default function NutritionTrends() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Apport calorique journalier moyen</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyCalorieData}>
              <defs>
                <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" />
              <YAxis domain={[1500, 2200]} />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(value) => [`${value} calories`, 'Moyenne journalière']} />
              <Area
                type="monotone"
                dataKey="average"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#colorCalories)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition des macronutriments</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={macronutrientData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="protein"
                name="Protéines"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
              <Line type="monotone" dataKey="carbs" name="Glucides" stroke="#82ca9d" />
              <Line type="monotone" dataKey="fat" name="Lipides" stroke="#ffc658" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Préférences alimentaires</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dietPreferenceData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}%`, 'Pourcentage']} />
              <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
