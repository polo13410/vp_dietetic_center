
import { Patient } from "@/utils/dummyData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface IndicatorGraphProps {
  patient: Patient;
  selectedIndicators: string[];
}

const COLORS = {
  weight: "#3B82F6", // blue
  bmi: "#10B981", // green
  bodyFat: "#F59E0B", // amber
  muscleMass: "#8B5CF6", // purple
  waterPercentage: "#06B6D4", // cyan
};

const AXIS_NAMES = {
  weight: "Weight (kg)",
  bmi: "BMI",
  bodyFat: "Body Fat (%)",
  muscleMass: "Muscle Mass (kg)",
  waterPercentage: "Water (%)",
};

const IndicatorGraph = ({ patient, selectedIndicators }: IndicatorGraphProps) => {
  if (!patient.indicators.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No indicator data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = patient.indicators.map((indicator) => ({
    date: indicator.date,
    weight: indicator.weight,
    bmi: indicator.bmi,
    bodyFat: indicator.bodyFat,
    muscleMass: indicator.muscleMass,
    waterPercentage: indicator.waterPercentage,
  }));

  if (selectedIndicators.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Please select at least one indicator to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Indicators Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedIndicators.includes("weight") && (
                <Line
                  type="monotone"
                  dataKey="weight"
                  name={AXIS_NAMES.weight}
                  stroke={COLORS.weight}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 8 }}
                />
              )}
              {selectedIndicators.includes("bmi") && (
                <Line
                  type="monotone"
                  dataKey="bmi"
                  name={AXIS_NAMES.bmi}
                  stroke={COLORS.bmi}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedIndicators.includes("bodyFat") &&
                patient.indicators.some((i) => i.bodyFat !== undefined) && (
                <Line
                  type="monotone"
                  dataKey="bodyFat"
                  name={AXIS_NAMES.bodyFat}
                  stroke={COLORS.bodyFat}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedIndicators.includes("muscleMass") &&
                patient.indicators.some((i) => i.muscleMass !== undefined) && (
                <Line
                  type="monotone"
                  dataKey="muscleMass"
                  name={AXIS_NAMES.muscleMass}
                  stroke={COLORS.muscleMass}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
              {selectedIndicators.includes("waterPercentage") &&
                patient.indicators.some((i) => i.waterPercentage !== undefined) && (
                <Line
                  type="monotone"
                  dataKey="waterPercentage"
                  name={AXIS_NAMES.waterPercentage}
                  stroke={COLORS.waterPercentage}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default IndicatorGraph;
