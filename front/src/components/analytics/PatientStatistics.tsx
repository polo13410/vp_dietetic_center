
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const PatientStatistics = () => {
  // Demo data - in a real app, this would come from an API
  const genderData = [
    { name: "Male", value: 42 },
    { name: "Female", value: 53 },
    { name: "Other", value: 5 },
  ];

  const ageGroupData = [
    { name: "18-24", count: 12 },
    { name: "25-34", count: 23 },
    { name: "35-44", count: 28 },
    { name: "45-54", count: 19 },
    { name: "55-64", count: 12 },
    { name: "65+", count: 6 },
  ];

  const conditionsData = [
    { name: "Diabetes", count: 18 },
    { name: "Hypertension", count: 24 },
    { name: "Heart Disease", count: 12 },
    { name: "Obesity", count: 30 },
    { name: "Allergy", count: 22 },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28FD0"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Patient Demographics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Total patients: <strong>100</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gender Distribution</CardTitle>
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
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {genderData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} patients`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Age Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageGroupData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} patients`, 'Count']} />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Common Health Conditions</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conditionsData} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => [`${value} patients`, 'Count']} />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientStatistics;
