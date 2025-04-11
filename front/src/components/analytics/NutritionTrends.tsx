
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart, Bar } from "recharts";

const NutritionTrends = () => {
  // Demo data - in a real app, this would come from an API
  const monthlyCalorieData = [
    { month: "Jan", average: 2100 },
    { month: "Feb", average: 2050 },
    { month: "Mar", average: 1950 },
    { month: "Apr", average: 1900 },
    { month: "May", average: 1850 },
    { month: "Jun", average: 1800 },
    { month: "Jul", average: 1750 },
  ];

  const macronutrientData = [
    { name: "Week 1", protein: 75, carbs: 220, fat: 65 },
    { name: "Week 2", protein: 80, carbs: 210, fat: 60 },
    { name: "Week 3", protein: 85, carbs: 200, fat: 55 },
    { name: "Week 4", protein: 90, carbs: 190, fat: 50 },
    { name: "Week 5", protein: 95, carbs: 180, fat: 45 },
    { name: "Week 6", protein: 100, carbs: 170, fat: 40 },
  ];

  const dietPreferenceData = [
    { name: "Regular", value: 45 },
    { name: "Vegetarian", value: 20 },
    { name: "Vegan", value: 15 },
    { name: "Keto", value: 10 },
    { name: "Paleo", value: 5 },
    { name: "Gluten-Free", value: 5 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Average Daily Calorie Intake</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyCalorieData}>
              <defs>
                <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" />
              <YAxis domain={[1500, 2200]} />
              <CartesianGrid strokeDasharray="3 3" />
              <Tooltip formatter={(value) => [`${value} calories`, 'Daily Average']} />
              <Area type="monotone" dataKey="average" stroke="#8884d8" fillOpacity={1} fill="url(#colorCalories)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Macronutrient Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={macronutrientData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="protein" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="carbs" stroke="#82ca9d" />
              <Line type="monotone" dataKey="fat" stroke="#ffc658" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diet Preferences</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dietPreferenceData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
              <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default NutritionTrends;
