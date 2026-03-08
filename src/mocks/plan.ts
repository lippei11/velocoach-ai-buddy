import { PhaseType, WorkoutType } from "@/types/trainingPlan";

/** Default training days (0-indexed from Monday) */
export const MOCK_TRAINING_DAYS = [1, 3, 5, 6]; // Tue, Thu, Sat, Sun

/** Workout templates per phase type */
export const WORKOUT_TEMPLATES: Record<
  PhaseType,
  Array<{ name: string; type: WorkoutType; tss: number; duration: number }>
> = {
  BASE: [
    { name: "Endurance", type: "endurance", tss: 65, duration: 5400 },
    { name: "Recovery Spin", type: "recovery", tss: 30, duration: 2700 },
    { name: "Long Ride", type: "longride", tss: 110, duration: 10800 },
    { name: "Z2 Endurance", type: "endurance", tss: 75, duration: 5400 },
  ],
  BUILD: [
    { name: "Sweet Spot", type: "sweetspot", tss: 85, duration: 4500 },
    { name: "Threshold Intervals", type: "sweetspot", tss: 90, duration: 4500 },
    { name: "Long Ride", type: "longride", tss: 130, duration: 12600 },
    { name: "Endurance", type: "endurance", tss: 70, duration: 5400 },
  ],
  PEAK: [
    { name: "VO2max Intervals", type: "vo2max", tss: 95, duration: 3600 },
    { name: "Race Simulation", type: "vo2max", tss: 120, duration: 7200 },
    { name: "Sweet Spot", type: "sweetspot", tss: 80, duration: 4500 },
    { name: "Endurance", type: "endurance", tss: 60, duration: 4500 },
  ],
  TAPER: [
    { name: "Opener", type: "vo2max", tss: 45, duration: 2700 },
    { name: "Easy Spin", type: "recovery", tss: 25, duration: 2700 },
    { name: "Short Sweet Spot", type: "sweetspot", tss: 50, duration: 3600 },
    { name: "Recovery", type: "recovery", tss: 20, duration: 1800 },
  ],
  RECOVERY: [
    { name: "Easy Spin", type: "recovery", tss: 25, duration: 2700 },
    { name: "Recovery Ride", type: "recovery", tss: 30, duration: 3600 },
    { name: "Easy Spin", type: "recovery", tss: 25, duration: 2700 },
    { name: "Rest", type: "rest", tss: 0, duration: 0 },
  ],
};

/** Phase distribution ratios for plan generation */
export const PHASE_DISTRIBUTION = {
  taperWeeks: 2,
  peakRatio: 0.15,
  peakMax: 3,
  buildRatio: 0.4,
  buildMax: 8,
};

/** Phase CTL ranges and TSS targets */
export const PHASE_DEFAULTS: Record<
  PhaseType,
  { ctlRange: [number, number]; weeklyTSS: number; focus: string }
> = {
  BASE: { ctlRange: [48, 62], weeklyTSS: 350, focus: "Z1-Z2 Endurance" },
  BUILD: { ctlRange: [62, 75], weeklyTSS: 420, focus: "Threshold + Sweet Spot" },
  PEAK: { ctlRange: [75, 85], weeklyTSS: 480, focus: "VO2max + Race-Specific" },
  TAPER: { ctlRange: [72, 80], weeklyTSS: 280, focus: "Volume ↓, Intensity maintained" },
  RECOVERY: { ctlRange: [40, 50], weeklyTSS: 200, focus: "Active Recovery" },
};
