export type PhaseType = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";

export interface Phase {
  id: string;
  type: PhaseType;
  startDate: string;
  endDate: string;
  weeks: number;
  targetCTLRange: [number, number];
  weeklyTSSTarget: number;
  workoutFocus: string;
}

export interface PlannedWorkout {
  id: string;
  date: string;
  name: string;
  category: string;
  description?: string;
  duration?: number; // seconds
  tssTarget?: number;
  workoutType: WorkoutType;
  color: string;
}

export interface CompletedWorkout {
  id: string;
  date: string;
  name: string;
  type: string;
  movingTime: number;
  tss: number | null;
  avgPower: number | null;
  ftp: number | null;
}

export type WorkoutType = "endurance" | "sweetspot" | "vo2max" | "longride" | "recovery" | "rest" | "threshold" | "durability" | "strength";

export interface DayData {
  date: string;
  planned?: PlannedWorkout;
  completed?: CompletedWorkout;
}

export interface WeekData {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase?: Phase;
  phaseWeekLabel?: string;
  tssTarget: number;
  tssActual: number;
  days: DayData[];
}

export interface PlanGeneratorForm {
  eventName: string;
  eventDate: Date | undefined;
  eventType: string;
  difficulty: string;
  trainingDays: string[];
  hoursPerWeek: number;
  longestRide: string;
  philosophy: string;
  fitnessContext: string;
  priority: string;
}

export interface GeneratedPlanResult {
  phases: Phase[];
  workouts: PlannedWorkout[];
  totalWorkouts: number;
  currentCTL: number;
  projectedCTL: number;
}
