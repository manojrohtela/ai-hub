export interface Meal {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  prep_minutes: number;
}

export interface DayPlan {
  day: string;
  meals: Meal[];
  total_calories: number;
  total_protein_g: number;
}

export interface PlanResponse {
  goal: string;
  diet_type: string;
  daily_calorie_target: number;
  days: DayPlan[];
  shopping_list: string[];
  tips: string[];
}

export interface ChatResponse {
  answer: string;
}
