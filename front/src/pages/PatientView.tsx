import Header from "@/components/layout/Header";
import PageTitle from "@/components/layout/PageTitle";
import Sidebar from "@/components/layout/Sidebar";
import PatientDetails from "@/components/patients/PatientDetails";
import { Button } from "@/components/ui/button";
import { Patient, patients } from "@/utils/dummyData";
import { ChevronLeft, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const PatientView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  useEffect(() => {
    // In a real app, this would be an API call
    const foundPatient = patients.find((p) => String(p.id) === id);

    if (foundPatient) {
      setPatient(foundPatient);
    }

    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageTitle title="Loading Patient" />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <PageTitle title="Patient Not Found" />
        <h1 className="text-2xl font-bold mb-4">Patient Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The patient you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/patients">Return to Patients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <PageTitle title={`${patient.firstName} ${patient.lastName}`} />
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <Header sidebarWidth={sidebarWidth} />
      <main
        className="pt-24 pb-16 px-6 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Link to="/patients">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>

            <Button asChild size="sm" className="gap-2">
              <Link to={`/patient/${patient.id}/edit`}>
                <Edit className="h-4 w-4" />
                Edit Patient
              </Link>
            </Button>
          </div>

          <PatientDetails patientId={patient.id} />
        </div>
      </main>
    </div>
  );
};

export default PatientView;
