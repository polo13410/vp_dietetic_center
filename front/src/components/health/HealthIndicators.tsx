import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Patient } from "@/utils/dummyData";
import { useState } from "react";
import { toast } from "sonner";
import IndicatorGraph from "./IndicatorGraph";

interface HealthIndicatorsProps {
  patient: Patient;
}

const HealthIndicators = ({ patient }: HealthIndicatorsProps) => {
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([
    "weight",
    "bmi",
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    weight: "",
    bodyFat: "",
    muscleMass: "",
    waterPercentage: "",
  });

  const toggleIndicator = (indicator: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(indicator)
        ? prev.filter((item) => item !== indicator)
        : [...prev, indicator]
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least weight is provided
    if (!formData.weight) {
      toast.error("Weight is required");
      return;
    }

    // In a real app, this would be an API call to update the patient
    toast.success("Measurement added successfully");
    setIsDialogOpen(false);

    // Reset form
    setFormData({
      weight: "",
      bodyFat: "",
      muscleMass: "",
      waterPercentage: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Health Indicators</h3>
          <p className="text-muted-foreground">
            Track {patient.firstName}'s health metrics over time
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add New Measurement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Measurement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMeasurement} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg) *</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bodyFat">Body Fat (%)</Label>
                <Input
                  id="bodyFat"
                  name="bodyFat"
                  type="number"
                  step="0.1"
                  value={formData.bodyFat}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="muscleMass">Muscle Mass (kg)</Label>
                <Input
                  id="muscleMass"
                  name="muscleMass"
                  type="number"
                  step="0.1"
                  value={formData.muscleMass}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waterPercentage">Water (%)</Label>
                <Input
                  id="waterPercentage"
                  name="waterPercentage"
                  type="number"
                  step="0.1"
                  value={formData.waterPercentage}
                  onChange={handleInputChange}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Measurement</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Select Indicators to Display
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={
                selectedIndicators.includes("weight") ? "default" : "outline"
              }
              size="sm"
              onClick={() => toggleIndicator("weight")}
            >
              Weight
            </Button>
            <Button
              variant={
                selectedIndicators.includes("bmi") ? "default" : "outline"
              }
              size="sm"
              onClick={() => toggleIndicator("bmi")}
            >
              BMI
            </Button>
            {patient.indicators.some((i) => i.bodyFat !== undefined) && (
              <Button
                variant={
                  selectedIndicators.includes("bodyFat") ? "default" : "outline"
                }
                size="sm"
                onClick={() => toggleIndicator("bodyFat")}
              >
                Body Fat
              </Button>
            )}
            {patient.indicators.some((i) => i.muscleMass !== undefined) && (
              <Button
                variant={
                  selectedIndicators.includes("muscleMass")
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => toggleIndicator("muscleMass")}
              >
                Muscle Mass
              </Button>
            )}
            {patient.indicators.some(
              (i) => i.waterPercentage !== undefined
            ) && (
              <Button
                variant={
                  selectedIndicators.includes("waterPercentage")
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => toggleIndicator("waterPercentage")}
              >
                Water Percentage
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <IndicatorGraph
        patient={patient}
        selectedIndicators={selectedIndicators}
      />

      <Card>
        <CardHeader>
          <CardTitle>Measurement History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase ">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Weight (kg)</th>
                  <th className="px-6 py-3">BMI</th>
                  {patient.indicators.some((i) => i.bodyFat !== undefined) && (
                    <th className="px-6 py-3">Body Fat (%)</th>
                  )}
                  {patient.indicators.some(
                    (i) => i.muscleMass !== undefined
                  ) && <th className="px-6 py-3">Muscle Mass (kg)</th>}
                  {patient.indicators.some(
                    (i) => i.waterPercentage !== undefined
                  ) && <th className="px-6 py-3">Water (%)</th>}
                </tr>
              </thead>
              <tbody>
                {[...patient.indicators].reverse().map((indicator, index) => (
                  <tr key={index} className=" border-b">
                    <td className="px-6 py-4 font-medium">{indicator.date}</td>
                    <td className="px-6 py-4">{indicator.weight}</td>
                    <td className="px-6 py-4">{indicator.bmi}</td>
                    {patient.indicators.some(
                      (i) => i.bodyFat !== undefined
                    ) && (
                      <td className="px-6 py-4">{indicator.bodyFat || "-"}</td>
                    )}
                    {patient.indicators.some(
                      (i) => i.muscleMass !== undefined
                    ) && (
                      <td className="px-6 py-4">
                        {indicator.muscleMass || "-"}
                      </td>
                    )}
                    {patient.indicators.some(
                      (i) => i.waterPercentage !== undefined
                    ) && (
                      <td className="px-6 py-4">
                        {indicator.waterPercentage || "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthIndicators;
