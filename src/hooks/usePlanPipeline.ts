import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  WeekSkeleton,
  WeekContext,
  BlockContext,
  CreatePlanResult,
} from "@/types/pipeline";

interface CreatePlanInputs {
  eventDemandProfile: string;
  eventName?: string;
  eventDate?: string;
  hoursPerWeek: number;
  availableDays: string[];
  strengthSessionsPerWeek?: number;
  entryState: "fresh_start" | "mid_training" | "returning_after_break";
  typology?: "PYRAMIDAL" | "POLARIZED" | "SS_THRESHOLD";
  vacationWeeks?: string[];
}

export function usePlanPipeline() {
  const [skeleton, setSkeleton] = useState<WeekSkeleton | null>(null);
  const [weekContext, setWeekContext] = useState<WeekContext | null>(null);
  const [blockContext, setBlockContext] = useState<BlockContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPlan = useCallback(async (inputs: CreatePlanInputs): Promise<CreatePlanResult> => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("create-plan", {
      body: inputs,
    });
    setLoading(false);
    if (fnError) {
      setError(fnError.message);
      throw fnError;
    }
    const result = data as CreatePlanResult;
    setSkeleton(result.weekSkeleton);
    setWeekContext(result.weekContext);
    setBlockContext(result.blockContext);
    return result;
  }, []);

  const loadCurrentWeek = useCallback(async (planId: string, weekStartDate?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("generate-week-skeleton", {
      body: { planId, weekStartDate },
    });
    setLoading(false);
    if (fnError) {
      setError(fnError.message);
      return;
    }
    setSkeleton(data?.weekSkeleton ?? null);
    setWeekContext(data?.weekContext ?? null);
    setBlockContext(data?.blockContext ?? null);
  }, []);

  return {
    createPlan,
    loadCurrentWeek,
    skeleton,
    weekContext,
    blockContext,
    loading,
    error,
  };
}
