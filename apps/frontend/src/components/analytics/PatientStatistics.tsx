import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const genderData = [
  { name: 'Homme', value: 42 },
  { name: 'Femme', value: 53 },
  { name: 'Autre', value: 5 },
];

const ageGroupData = [
  { name: '18-24', count: 12 },
  { name: '25-34', count: 23 },
  { name: '35-44', count: 28 },
  { name: '45-54', count: 19 },
  { name: '55-64', count: 12 },
  { name: '65+', count: 6 },
];

const conditionsData = [
  { name: 'Diabète', count: 18 },
  { name: 'Hypertension', count: 24 },
  { name: 'Maladies cardiaques', count: 12 },
  { name: 'Obésité', count: 30 },
  { name: 'Allergies', count: 22 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28FD0'];

export default function PatientStatistics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Démographie des patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Total patients : <strong>100</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition par genre</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {genderData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} patients`, 'Total']} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition par âge</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageGroupData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} patients`, 'Total']} />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Conditions de santé fréquentes</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conditionsData} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} />
              <Tooltip formatter={(value) => [`${value} patients`, 'Total']} />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
