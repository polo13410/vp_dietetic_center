
import { format } from "date-fns";

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  status: "active" | "archived";
  createdAt: string;
  healthData: {
    height: number; // in cm
    weight: number; // in kg
    bmi: number;
    bloodPressure: string;
    allergies: string[];
    conditions: string[];
    medications: string[];
  };
  indicators: {
    date: string;
    weight: number;
    bmi: number;
    bodyFat?: number;
    muscleMass?: number;
    waterPercentage?: number;
  }[];
  foodJournal: {
    date: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    snacks: string;
    extra: string;
    notes: string;
  }[];
}

// Generate dummy patient data
export const patients: Patient[] = [
  {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "(555) 123-4567",
    dateOfBirth: "1985-06-15",
    gender: "Female",
    status: "active",
    createdAt: "2023-01-15T09:00:00Z",
    healthData: {
      height: 165,
      weight: 68,
      bmi: 25.0,
      bloodPressure: "120/80",
      allergies: ["Peanuts", "Shellfish"],
      conditions: ["Hypertension"],
      medications: ["Lisinopril"],
    },
    indicators: [
      {
        date: "2023-01-15",
        weight: 70,
        bmi: 25.7,
        bodyFat: 28,
        muscleMass: 45,
        waterPercentage: 55,
      },
      {
        date: "2023-02-15",
        weight: 69,
        bmi: 25.3,
        bodyFat: 27,
        muscleMass: 46,
        waterPercentage: 56,
      },
      {
        date: "2023-03-15",
        weight: 68,
        bmi: 25.0,
        bodyFat: 26,
        muscleMass: 47,
        waterPercentage: 57,
      },
    ],
    foodJournal: [
      {
        date: "2023-03-14",
        breakfast: "Oatmeal with berries and a cup of coffee",
        lunch: "Grilled chicken salad with olive oil dressing",
        dinner: "Salmon with steamed vegetables and quinoa",
        snacks: "Apple and a handful of almonds",
        extra: "Green tea in the afternoon",
        notes: "Felt energetic throughout the day",
      },
      {
        date: "2023-03-15",
        breakfast: "Greek yogurt with honey and granola",
        lunch: "Turkey sandwich on whole grain bread with lettuce and tomato",
        dinner: "Vegetable stir-fry with tofu",
        snacks: "Banana and a protein bar",
        extra: "Herbal tea before bed",
        notes: "Slightly hungry in the afternoon",
      },
    ],
  },
  {
    id: 2,
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "(555) 987-6543",
    dateOfBirth: "1978-11-23",
    gender: "Male",
    status: "active",
    createdAt: "2023-02-05T14:30:00Z",
    healthData: {
      height: 180,
      weight: 85,
      bmi: 26.2,
      bloodPressure: "130/85",
      allergies: ["Lactose"],
      conditions: ["Type 2 Diabetes"],
      medications: ["Metformin"],
    },
    indicators: [
      {
        date: "2023-02-05",
        weight: 88,
        bmi: 27.2,
        bodyFat: 24,
        muscleMass: 60,
        waterPercentage: 50,
      },
      {
        date: "2023-03-05",
        weight: 86,
        bmi: 26.5,
        bodyFat: 23,
        muscleMass: 61,
        waterPercentage: 51,
      },
      {
        date: "2023-04-05",
        weight: 85,
        bmi: 26.2,
        bodyFat: 22,
        muscleMass: 62,
        waterPercentage: 52,
      },
    ],
    foodJournal: [
      {
        date: "2023-04-04",
        breakfast: "Scrambled eggs with whole grain toast",
        lunch: "Tuna salad with light mayo on mixed greens",
        dinner: "Lean beef stir-fry with brown rice",
        snacks: "Greek yogurt with berries",
        extra: "Black coffee, no sugar",
        notes: "Glucose levels stable today",
      },
      {
        date: "2023-04-05",
        breakfast: "Protein smoothie with spinach and berries",
        lunch: "Grilled chicken wrap with vegetables",
        dinner: "Baked cod with sweet potato and broccoli",
        snacks: "Cottage cheese with pineapple",
        extra: "Sparkling water",
        notes: "Felt a bit hungry before dinner",
      },
    ],
  },
  {
    id: 3,
    firstName: "Emma",
    lastName: "Wilson",
    email: "emma.wilson@example.com",
    phone: "(555) 456-7890",
    dateOfBirth: "1990-03-08",
    gender: "Female",
    status: "archived",
    createdAt: "2022-11-10T11:15:00Z",
    healthData: {
      height: 170,
      weight: 62,
      bmi: 21.5,
      bloodPressure: "110/70",
      allergies: ["Gluten"],
      conditions: ["Celiac Disease"],
      medications: [],
    },
    indicators: [
      {
        date: "2022-11-10",
        weight: 64,
        bmi: 22.1,
        bodyFat: 22,
        muscleMass: 48,
        waterPercentage: 58,
      },
      {
        date: "2022-12-10",
        weight: 63,
        bmi: 21.8,
        bodyFat: 21,
        muscleMass: 49,
        waterPercentage: 59,
      },
      {
        date: "2023-01-10",
        weight: 62,
        bmi: 21.5,
        bodyFat: 20,
        muscleMass: 50,
        waterPercentage: 60,
      },
    ],
    foodJournal: [
      {
        date: "2023-01-09",
        breakfast: "Gluten-free oatmeal with almond milk and sliced banana",
        lunch: "Quinoa bowl with roasted vegetables and chickpeas",
        dinner: "Grilled chicken with rice noodles and vegetables",
        snacks: "Rice cakes with almond butter",
        extra: "Herbal tea",
        notes: "No digestive issues today",
      },
      {
        date: "2023-01-10",
        breakfast: "Gluten-free toast with avocado and eggs",
        lunch: "Large salad with tuna and olive oil dressing",
        dinner: "Gluten-free pasta with tomato sauce and ground turkey",
        snacks: "Apple slices with cinnamon",
        extra: "Chamomile tea",
        notes: "Felt good all day, no symptoms",
      },
    ],
  },
];

export const getCurrentDate = (): string => {
  return format(new Date(), "yyyy-MM-dd");
};

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, "MMM d, yyyy");
  } catch (error) {
    console.error("Invalid date format:", error);
    return dateString;
  }
};

export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};
