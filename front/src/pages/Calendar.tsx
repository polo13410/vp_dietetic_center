import NewAppointmentForm from "@/components/appointments/NewAppointmentForm";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAppointments } from "@/hooks/useAppointments";
import { patients } from "@/utils/dummyData";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const CalendarPage = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);

  const { appointments, addAppointment } = useAppointments();

  // Generate array of 7 days starting from weekStart
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1));
  };

  const handleNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1));
  };

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  // Filter appointments for the selected date
  const dailyAppointments = appointments
    .filter((app) => isSameDay(new Date(app.date), selectedDate))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen ">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <Header sidebarWidth={sidebarWidth} />
      <main
        className="pt-24 pb-16 px-6 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Calendar</h1>
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Select Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Dialog
                open={isNewAppointmentOpen}
                onOpenChange={setIsNewAppointmentOpen}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Appointment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule New Appointment</DialogTitle>
                  </DialogHeader>
                  <NewAppointmentForm
                    onSubmit={(data) => {
                      addAppointment(data);
                      setIsNewAppointmentOpen(false);
                    }}
                    initialDate={selectedDate}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Weekly calendar view */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    Week of {format(weekStart, "MMM d, yyyy")}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePreviousWeek}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNextWeek}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Click on a day to view appointments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, index) => (
                    <Button
                      key={index}
                      variant={
                        isSameDay(day, selectedDate) ? "default" : "outline"
                      }
                      className="h-24 flex flex-col items-center justify-start p-2"
                      onClick={() => setSelectedDate(day)}
                    >
                      <span className="text-xs">{format(day, "EEE")}</span>
                      <span className="text-lg font-bold">
                        {format(day, "d")}
                      </span>
                      <div>
                        <span className="text-xs">
                          {appointments
                            .filter((app) => isSameDay(new Date(app.date), day))
                            .slice(0, 2).length > 0 ? (
                            appointments
                              .filter((app) =>
                                isSameDay(new Date(app.date), day)
                              )
                              .slice(0, 2).length + " rdv(s)"
                          ) : (
                            <CalendarIcon className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Daily agenda */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Agenda for {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
                <CardDescription>
                  {dailyAppointments.length === 0
                    ? "No appointments scheduled"
                    : `${dailyAppointments.length} appointment(s) scheduled`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dailyAppointments.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        No appointments for this day
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsNewAppointmentOpen(true)}
                      >
                        Schedule appointment
                      </Button>
                    </div>
                  ) : (
                    dailyAppointments.map((appointment, index) => {
                      const patient = patients.find(
                        (p) => p.id === appointment.patientId
                      );
                      return (
                        <div
                          key={index}
                          className="border rounded-md p-3 hover: transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">
                                {format(new Date(appointment.date), "h:mm a")}
                              </p>
                              <h3 className="font-semibold mt-1">
                                {appointment.title}
                              </h3>
                            </div>
                            <div className="flex items-center">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/patient/${appointment.patientId}`}>
                                  <User className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>

                          {patient && (
                            <div className="flex items-center mt-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs mr-2">
                                {patient.firstName[0]}
                                {patient.lastName[0]}
                              </div>
                              <Link
                                to={`/patient/${patient.id}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {patient.firstName} {patient.lastName}
                              </Link>
                            </div>
                          )}

                          {appointment.notes && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {appointment.notes}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CalendarPage;
