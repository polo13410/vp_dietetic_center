
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MealEntryProps {
  date: string;
  initialData?: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snacks: string;
    extra: string;
    notes: string;
  };
  onSave: (data: any) => void;
}

const MealEntry = ({ date, initialData, onSave }: MealEntryProps) => {
  const [formData, setFormData] = useState({
    breakfast: initialData?.breakfast || "",
    lunch: initialData?.lunch || "",
    dinner: initialData?.dinner || "",
    snacks: initialData?.snacks || "",
    extra: initialData?.extra || "",
    notes: initialData?.notes || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date,
      ...formData
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="breakfast">Breakfast</Label>
        <Textarea
          id="breakfast"
          name="breakfast"
          placeholder="What did the patient have for breakfast?"
          value={formData.breakfast}
          onChange={handleChange}
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="lunch">Lunch</Label>
        <Textarea
          id="lunch"
          name="lunch"
          placeholder="What did the patient have for lunch?"
          value={formData.lunch}
          onChange={handleChange}
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="dinner">Dinner</Label>
        <Textarea
          id="dinner"
          name="dinner"
          placeholder="What did the patient have for dinner?"
          value={formData.dinner}
          onChange={handleChange}
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="snacks">Snacks</Label>
        <Textarea
          id="snacks"
          name="snacks"
          placeholder="What snacks did the patient have?"
          value={formData.snacks}
          onChange={handleChange}
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="extra">Extra Consumption</Label>
        <Textarea
          id="extra"
          name="extra"
          placeholder="Any additional food or drinks?"
          value={formData.extra}
          onChange={handleChange}
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Additional notes about the patient's diet for this day"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="submit">Save Journal Entry</Button>
      </div>
    </form>
  );
};

export default MealEntry;
