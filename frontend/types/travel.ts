/** Mirrors the Pydantic models in backend/models/travel.py. */

export type TravelCategory =
  "beach" | "cold" | "city" | "adventure" | "culture" | "nature";

export type BudgetLevel = "low" | "medium" | "high";

export type Month =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export interface TravelPreferences {
  destination: string | null;
  country: string | null;
  category: TravelCategory | null;
  month: Month | null;
  travelers: number | null;
  budget_level: BudgetLevel | null;
  max_budget: number | null;
}

export interface Recommendation {
  id: number;
  name: string;
  destination: string;
  country: string;
  category: string;
  description: string;
  days: number;
  price: number;
  max_people: number;
  best_months: string[];
  score: number;
  match_reasons: string[];
}

export interface RecommendationResponse {
  preferences: TravelPreferences;
  recommendations: Recommendation[];
}
