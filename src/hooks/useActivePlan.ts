import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PlanStructure } from "@/lib/coaching/planningCore";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

export interface ActivePlan {
  plan: PlanRow;
  planStructure: PlanStructure | null;
  blocks: BlockRow[];
}

export function useActivePlan() {
  const [data, setData] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) {
      setError(planError.message);
      setLoading(false);
      return;
    }

    if (!plan) {
      setData(null);
      setLoading(false);
      return;
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("*")
      .eq("plan_id", plan.id)
      .order("block_number", { ascending: true });

    if (blocksError) {
      setError(blocksError.message);
      setLoading(false);
      return;
    }

    const planStructure = plan.plan_structure_json
      ? (plan.plan_structure_json as unknown as PlanStructure)
      : null;

    setData({ plan, planStructure, blocks: blocks ?? [] });
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
