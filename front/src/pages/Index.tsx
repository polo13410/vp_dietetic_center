import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PatientsList from "@/components/patients/PatientsList";
import { useState } from "react";

const Patients = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  return (
    <div className="min-h-screen">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <Header sidebarWidth={sidebarWidth} />
      <main
        className="pt-24 pb-16 px-6 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Patients</h1>
          <PatientsList />
        </div>
      </main>
    </div>
  );
};

export default Patients;
