import { getPatientById } from "@/api/endpoints/patients";
import HealthIndicators from "@/components/health/HealthIndicators";
import FoodJournal from "@/components/journal/FoodJournal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Patient, calculateAge, formatDate } from "@/utils/dummyData";
import { useEffect, useState } from "react";

interface PatientDetailsProps {
  patientId: number;
}

const PatientDetails = ({ patientId }: PatientDetailsProps) => {
  const [activeTab, setActiveTab] = useState("summary");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [indicators, setIndicators] = useState<Patient["indicators"]>([]);
  const [foodJournal, setFoodJournal] = useState<Patient["foodJournal"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch patient data
        const patientData = await getPatientById(patientId);
        setPatient(patientData);

        console.log("🍏🍏🍏", patientData);

        // Fetch additional data
        // const indicatorsData = await getPatientIndicators(patientId);
        // setIndicators(indicatorsData);

        // const foodJournalData = await getPatientFoodJournal(patientId);
        // setFoodJournal(foodJournalData);
      } catch (err) {
        console.error("Error fetching patient data:", err);
        setError("Failed to load patient data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !patient) {
    console.log("🤠🤠", { error, patient });
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        {error || "Patient not found"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-muted-foreground">
            Patient ID: {patient.id} |
            {patient.status === "active" ? (
              <Badge
                variant="outline"
                className="ml-2 bg-green-50 text-green-700 hover:bg-green-50"
              >
                Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="ml-2 bg-gray-100 text-gray-700 hover:bg-gray-100"
              >
                Archived
              </Badge>
            )}
          </p>
        </div>
      </div>

      <Tabs
        defaultValue="summary"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="health">Health Data</TabsTrigger>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
          <TabsTrigger value="journal">Food Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Personal Information
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Age</div>
                    <div>{calculateAge(patient.dateOfBirth)} years</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Date of Birth</div>
                    <div>{formatDate(patient.dateOfBirth)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Gender</div>
                    <div>{patient.gender}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Email</div>
                    <div className="break-all">{patient.email}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Phone</div>
                    <div>{patient.phone}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">First Visit</div>
                    <div>{formatDate(patient.createdAt)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Last Update</div>
                    <div>
                      {formatDate(
                        indicators.slice(-1)[0]?.date || patient.createdAt
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Recent Health Summary
                </h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Height</div>
                    <div>{patient.healthData.height} cm</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Weight</div>
                    <div>
                      {indicators.slice(-1)[0]?.weight ||
                        patient.healthData.weight}{" "}
                      kg
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">BMI</div>
                    <div>
                      {indicators.slice(-1)[0]?.bmi || patient.healthData.bmi}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Blood Pressure</div>
                    <div>{patient.healthData.bloodPressure}</div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="font-medium mb-2">Allergies</div>
                    <div>
                      {patient.healthData.allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {patient.healthData.allergies.map((allergy) => (
                            <Badge key={allergy} variant="secondary">
                              {allergy}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          No known allergies
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="font-medium mb-2">Medical Conditions</div>
                    <div>
                      {patient.healthData.conditions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {patient.healthData.conditions.map((condition) => (
                            <Badge key={condition} variant="outline">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          No known medical conditions
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">
                Detailed Health Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Height</div>
                  <div className="text-2xl font-semibold">
                    {patient.healthData.height} cm
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Current Weight
                  </div>
                  <div className="text-2xl font-semibold">
                    {indicators.slice(-1)[0]?.weight ||
                      patient.healthData.weight}{" "}
                    kg
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">BMI</div>
                  <div className="text-2xl font-semibold">
                    {indicators.slice(-1)[0]?.bmi || patient.healthData.bmi}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-medium mb-2">Blood Pressure</h4>
                  <p>{patient.healthData.bloodPressure || "Not recorded"}</p>
                </div>

                <div>
                  <h4 className="text-md font-medium mb-2">Allergies</h4>
                  {patient.healthData.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.healthData.allergies.map((allergy) => (
                        <Badge key={allergy} variant="secondary">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No known allergies</p>
                  )}
                </div>

                <div>
                  <h4 className="text-md font-medium mb-2">
                    Medical Conditions
                  </h4>
                  {patient.healthData.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.healthData.conditions.map((condition) => (
                        <Badge key={condition} variant="outline">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No known medical conditions
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-md font-medium mb-2">Medications</h4>
                  {patient.healthData.medications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.healthData.medications.map((medication) => (
                        <Badge
                          key={medication}
                          variant="outline"
                          className="bg-blue-50"
                        >
                          {medication}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No medications</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicators">
          <HealthIndicators patient={patient} />
        </TabsContent>

        <TabsContent value="journal">
          <FoodJournal patient={patient} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetails;
