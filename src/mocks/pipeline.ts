// Mock pipeline response for UI development
import { PipelineResponse, SessionSlot } from "@/types/pipeline";
import { format, addDays, startOfWeek } from "date-fns";

function mockDate(dayOffset: number): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(addDays(monday, dayOffset), "yyyy-MM-dd");
}

const mockSlots: SessionSlot[] = [
  {
    day: 1, // Tue
    plannedDate: mockDate(1),
    slotType: "endurance_base",
    purpose: "endurance",
    priority: "medium",
    durationMinutes: 90,
    targetTss: 65,
    indoorOutdoor: "indoor_preferred",
    rationaleShort: "Aerobic base session. Maintain Z2 intensity to develop mitochondrial density.",
  },
  {
    day: 3, // Thu
    plannedDate: mockDate(3),
    slotType: "threshold",
    purpose: "sweet_spot",
    priority: "high",
    durationMinutes: 75,
    targetTss: 85,
    indoorOutdoor: "indoor_only",
    rationaleShort: "Key session: 3×12min sweet spot intervals to raise FTP ceiling.",
  },
  {
    day: 5, // Sat
    plannedDate: mockDate(5),
    slotType: "endurance_base",
    purpose: "long_ride",
    priority: "high",
    durationMinutes: 180,
    targetTss: 130,
    indoorOutdoor: "outdoor_preferred",
    rationaleShort: "Weekend long ride. Build fatigue resistance and fuel strategy practice.",
  },
  {
    day: 6, // Sun
    plannedDate: mockDate(6),
    slotType: "recovery",
    purpose: "recovery",
    priority: "low",
    durationMinutes: 45,
    targetTss: 25,
    indoorOutdoor: "flexible",
    rationaleShort: "Active recovery spin. Keep legs moving without accumulating stress.",
  },
];

export const MOCK_PIPELINE_RESPONSE: PipelineResponse = {
  weekSkeleton: {
    slots: mockSlots,
    weekFocus: "Aerobe Basis + Long Ride",
    rationaleShort:
      "Woche 3 der Base-Phase: Volumen wird leicht gesteigert. Eine Key Session (Sweet Spot) und ein Long Ride bilden die Hauptbelastung.",
    weeklyStressBudget: {
      weeklyTssTarget: 305,
      maxThresholdSessions: 2,
      maxVo2Sessions: 0,
      maxNeuromuscularSessions: 0,
      maxDurabilityBlocks: 1,
      plannedThreshold: 1,
      plannedVo2: 0,
      plannedNeuromuscular: 0,
      plannedDurability: 0,
      plannedStrength: 0,
      plannedLongRide: true,
      exceptionApplied: false,
      typology: "PYRAMIDAL",
    },
  },
  weekContext: {
    phase: "base",
    weekNumberInPhase: 3,
    weekNumberInPlan: 3,
    isDeloadWeek: false,
    isFirstWeekOfPhase: false,
    isLastWeekOfPhase: false,
    weeksUntilEvent: 14,
  },
  planStructure: {
    totalWeeks: 16,
    macroStrategy: "Base Heavy",
    currentPhase: "base",
    weeksUntilEvent: 14,
  },
};
