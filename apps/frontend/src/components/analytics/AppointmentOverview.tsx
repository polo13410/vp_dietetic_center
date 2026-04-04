import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const monthlyAppointmentData = [
  { month: 'Jan', count: 42 },
  { month: 'Fév', count: 38 },
  { month: 'Mar', count: 45 },
  { month: 'Avr', count: 50 },
  { month: 'Mai', count: 53 },
  { month: 'Juin', count: 48 },
  { month: 'Juil', count: 51 },
];

const appointmentTypeData = [
  { name: 'Consultation initiale', value: 25 },
  { name: 'Suivi', value: 45 },
  { name: 'Urgence', value: 10 },
  { name: 'Contrôle routine', value: 20 },
];

const completionRateData = [
  { month: 'Jan', rate: 92 },
  { month: 'Fév', rate: 89 },
  { month: 'Mar', rate: 91 },
  { month: 'Avr', rate: 93 },
  { month: 'Mai', rate: 95 },
  { month: 'Juin', rate: 94 },
  { month: 'Juil', rate: 96 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function AppointmentOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Rendez-vous mensuels</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyAppointmentData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} rendez-vous`, 'Total']} />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Types de rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={appointmentTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {appointmentTypeData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Pourcentage']} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Taux de complétion</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[80, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Taux de complétion']} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#82ca9d"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
