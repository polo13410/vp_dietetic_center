
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

const AppointmentOverview = () => {
  // Demo data - in a real app, this would come from an API
  const monthlyAppointmentData = [
    { month: "Jan", count: 42 },
    { month: "Feb", count: 38 },
    { month: "Mar", count: 45 },
    { month: "Apr", count: 50 },
    { month: "May", count: 53 },
    { month: "Jun", count: 48 },
    { month: "Jul", count: 51 },
  ];

  const appointmentTypeData = [
    { name: "Initial Consultation", value: 25 },
    { name: "Follow-up", value: 45 },
    { name: "Emergency", value: 10 },
    { name: "Routine Check", value: 20 },
  ];

  const completionRateData = [
    { month: "Jan", rate: 92 },
    { month: "Feb", rate: 89 },
    { month: "Mar", rate: 91 },
    { month: "Apr", rate: 93 },
    { month: "May", rate: 95 },
    { month: "Jun", rate: 94 },
    { month: "Jul", rate: 96 },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Monthly Appointments</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyAppointmentData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} appointments`, 'Count']} />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Types</CardTitle>
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
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {appointmentTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Completion Rate</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={completionRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[80, 100]} />
              <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
              <Line type="monotone" dataKey="rate" stroke="#82ca9d" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentOverview;
