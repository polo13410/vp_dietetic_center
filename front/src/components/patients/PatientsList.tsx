
import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Archive, 
  MoreVertical,
  Edit,
  Trash2,
  Filter
} from "lucide-react";
import { Patient, patients, calculateAge, formatDate } from "@/utils/dummyData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const PatientsList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [patientsList, setPatientsList] = useState<Patient[]>(patients);

  const filteredPatients = patientsList.filter((patient) => {
    const matchesSearch = 
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || patient.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const archivePatient = (id: string) => {
    setPatientsList(prevPatients => 
      prevPatients.map(patient => 
        patient.id === id ? { ...patient, status: "archived" } : patient
      )
    );
  };

  const deletePatient = (id: string) => {
    setPatientsList(prevPatients => 
      prevPatients.filter(patient => patient.id !== id)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Search patients..."
            className="w-[250px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter size={16} />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                All Patients
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                Active Patients
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("archived")}>
                Archived Patients
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button asChild>
          <Link to="/add-patient">Add New Patient</Link>
        </Button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient) => (
          <Card key={patient.id} className="overflow-hidden">
            <CardHeader className="pb-3 flex flex-row justify-between items-center">
              <CardTitle className="text-lg">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <div className="flex items-center">
                {patient.status === "archived" && (
                  <Badge variant="outline" className="mr-2">Archived</Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/patient/${patient.id}`}>View Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/patient/${patient.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    {patient.status === "active" ? (
                      <DropdownMenuItem onClick={() => archivePatient(patient.id)}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => {
                        setPatientsList(prevPatients => 
                          prevPatients.map(p => 
                            p.id === patient.id ? { ...p, status: "active" } : p
                          )
                        );
                      }}>
                        Restore
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => deletePatient(patient.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Age: </span>
                  {calculateAge(patient.dateOfBirth)} years
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Email: </span>
                  {patient.email}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Phone: </span>
                  {patient.phone}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Last Updated: </span>
                  {formatDate(patient.indicators.slice(-1)[0]?.date || patient.createdAt)}
                </div>
                <Button 
                  variant="outline" 
                  asChild 
                  className="w-full mt-3"
                >
                  <Link to={`/patient/${patient.id}`}>View Profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredPatients.length === 0 && (
          <div className="col-span-full text-center py-10">
            <p className="text-muted-foreground">No patients found. Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientsList;
