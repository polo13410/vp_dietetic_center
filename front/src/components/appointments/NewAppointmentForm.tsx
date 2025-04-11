
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { patients } from "@/utils/dummyData";
import { Appointment } from "@/hooks/useAppointments";

interface NewAppointmentFormProps {
  onSubmit: (data: Omit<Appointment, "id">) => void;
  initialDate?: Date;
}

const appointmentTypes = [
  { value: "initial", label: "Initial Consultation" },
  { value: "followup", label: "Follow-up" },
  { value: "checkup", label: "Regular Checkup" },
];

const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    label: format(new Date().setHours(hour, minute), "h:mm a"),
  };
});

const durations = [15, 30, 45, 60, 90, 120];

const NewAppointmentForm = ({ onSubmit, initialDate = new Date() }: NewAppointmentFormProps) => {
  const [date, setDate] = useState<Date>(initialDate);
  const [timeSlot, setTimeSlot] = useState("09:00");
  const [patientId, setPatientId] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<"initial" | "followup" | "checkup">("followup");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create appointment date by combining selected date and time
    const [hours, minutes] = timeSlot.split(":").map(Number);
    const appointmentDate = new Date(date);
    appointmentDate.setHours(hours, minutes, 0, 0);
    
    onSubmit({
      patientId,
      title,
      date: appointmentDate.toISOString(),
      duration,
      notes,
      type,
    });
  };
  
  // Auto-fill title when type changes
  const handleTypeChange = (value: "initial" | "followup" | "checkup") => {
    setType(value);
    if (!title || appointmentTypes.some(t => t.label === title)) {
      setTitle(appointmentTypes.find(t => t.value === value)?.label || "");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="patient">Patient</Label>
        <Select value={patientId} onValueChange={setPatientId} required>
          <SelectTrigger id="patient">
            <SelectValue placeholder="Select a patient" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((patient) => (
              <SelectItem key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="appointment-type">Appointment Type</Label>
        <Select 
          value={type} 
          onValueChange={(value: "initial" | "followup" | "checkup") => handleTypeChange(value)}
          required
        >
          <SelectTrigger id="appointment-type">
            <SelectValue placeholder="Select appointment type" />
          </SelectTrigger>
          <SelectContent>
            {appointmentTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Appointment title"
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(date) => date && setDate(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="time">Time</Label>
          <Select value={timeSlot} onValueChange={setTimeSlot} required>
            <SelectTrigger id="time" className="w-full">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map((slot) => (
                <SelectItem key={slot.value} value={slot.value}>
                  {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Select 
          value={duration.toString()} 
          onValueChange={(value) => setDuration(parseInt(value))}
          required
        >
          <SelectTrigger id="duration">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            {durations.map((duration) => (
              <SelectItem key={duration} value={duration.toString()}>
                {duration} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any important notes about this appointment"
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit">Schedule Appointment</Button>
      </div>
    </form>
  );
};

export default NewAppointmentForm;
