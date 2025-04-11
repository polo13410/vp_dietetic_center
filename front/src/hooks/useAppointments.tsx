
import { useState, useEffect } from "react";

export interface Appointment {
  id: string;
  patientId: string;
  title: string;
  date: string; // ISO string
  duration: number; // in minutes
  notes?: string;
  type: "initial" | "followup" | "checkup";
}

// Some sample appointments for demonstration
const sampleAppointments: Appointment[] = [
  {
    id: "a1",
    patientId: "p1",
    title: "Initial Consultation",
    date: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    duration: 60,
    notes: "First meeting to discuss nutrition goals",
    type: "initial"
  },
  {
    id: "a2",
    patientId: "p2",
    title: "Diet Plan Review",
    date: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(),
    duration: 45,
    notes: "Check progress and adjust meal plan",
    type: "followup"
  },
  {
    id: "a3",
    patientId: "p3",
    title: "Monthly Checkup",
    // Fix: Create a new Date object first, then set date and hours separately
    date: (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(11, 0, 0, 0);
      return tomorrow.toISOString();
    })(),
    duration: 30,
    type: "checkup"
  }
];

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  useEffect(() => {
    // In a real app, this would fetch from an API
    setAppointments(sampleAppointments);
  }, []);
  
  const addAppointment = (appointment: Omit<Appointment, "id">) => {
    const newAppointment = {
      ...appointment,
      id: `a${appointments.length + 1}`,
    };
    
    setAppointments([...appointments, newAppointment]);
    return newAppointment;
  };
  
  const updateAppointment = (id: string, data: Partial<Appointment>) => {
    setAppointments(
      appointments.map((app) => (app.id === id ? { ...app, ...data } : app))
    );
  };
  
  const deleteAppointment = (id: string) => {
    setAppointments(appointments.filter((app) => app.id !== id));
  };
  
  return {
    appointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  };
};
