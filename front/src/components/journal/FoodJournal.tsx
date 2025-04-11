
import { useState } from "react";
import { Patient, formatDate, getCurrentDate } from "@/utils/dummyData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import MealEntry from "./MealEntry";

interface FoodJournalProps {
  patient: Patient;
}

const FoodJournal = ({ patient }: FoodJournalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    patient.foodJournal.length > 0
      ? new Date(patient.foodJournal[patient.foodJournal.length - 1].date)
      : new Date()
  );
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const { toast } = useToast();

  const formattedSelectedDate = selectedDate 
    ? format(selectedDate, "yyyy-MM-dd") 
    : getCurrentDate();

  const journal = patient.foodJournal.find(
    (entry) => entry.date === formattedSelectedDate
  );

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    if (!selectedDate) return;
    
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const handleAddEntry = (data: any) => {
    // In a real app, this would update the patient data
    toast({
      title: "Journal Entry Added",
      description: `Food journal for ${formattedSelectedDate} has been updated.`,
    });
    setIsAddEntryOpen(false);
  };

  const hasJournalEntry = !!journal;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Food Journal</h3>
          <p className="text-muted-foreground">
            Track {patient.firstName}'s daily food intake
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigateDay('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigateDay('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                {hasJournalEntry ? "Edit Entry" : "Add Entry"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {hasJournalEntry ? "Edit Food Journal" : "Add Food Journal"}
                </DialogTitle>
              </DialogHeader>
              <MealEntry 
                date={formattedSelectedDate} 
                initialData={journal} 
                onSave={handleAddEntry} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {hasJournalEntry ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakfast</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{journal.breakfast || "No breakfast recorded"}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lunch</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{journal.lunch || "No lunch recorded"}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dinner</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{journal.dinner || "No dinner recorded"}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Snacks</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{journal.snacks || "No snacks recorded"}</p>
            </CardContent>
          </Card>
          
          {journal.extra && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extra</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{journal.extra}</p>
              </CardContent>
            </Card>
          )}
          
          {journal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{journal.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No food journal entry for this date.</p>
            <Button 
              variant="outline" 
              onClick={() => setIsAddEntryOpen(true)}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add Journal Entry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FoodJournal;
