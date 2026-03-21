# VeloCoach — Phase 1 Implementation Tasks V2

**Phase:** Phase 1 — Plan Creation Flow with Block Structure  
**Goal:** User creates a plan on `/plan`, sees phase/block timeline, sees real weekly skeleton.

Each task = one Claude Code invocation. Execute in order. Each has clear done criteria.

-----

## Task 1: Schema Migration

**Create file:** `supabase/migrations/20260322_plan_creation_v2.sql`

```sql
-- ============================================================
-- plans: new columns for plan creation flow
-- ============================================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS plan_start_date date,
  ADD COLUMN IF NOT EXISTS macro_strategy text,
  ADD COLUMN IF NOT EXISTS plan_structure_json jsonb,
  ADD COLUMN IF NOT EXISTS entry_state text DEFAULT 'fresh_start',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Ensure status column exists with correct default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.plans ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- ============================================================
-- blocks: mesocycle records derived from plan phases
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.plans NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  phase text NOT NULL,
  block_number integer NOT NULL,
  block_number_in_phase integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  weeks integer NOT NULL,
  load_weeks integer NOT NULL,
  deload_week_numbers jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'upcoming',
  user_inputs_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blocks_plan_id ON public.blocks (plan_id);
CREATE INDEX IF NOT EXISTS blocks_user_status ON public.blocks (user_id, status);
CREATE INDEX IF NOT EXISTS blocks_user_dates ON public.blocks (user_id, start_date, end_date);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocks'
      AND policyname = 'own data only'
  ) THEN
    CREATE POLICY "own data only" ON public.blocks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- athlete_preferences: formalize columns used by hook
-- ============================================================
ALTER TABLE public.athlete_preferences
  ADD COLUMN IF NOT EXISTS goal_type text,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS constraints_notes text;
```

**Done criteria:**

- Migration file exists and is valid SQL
- `bun run build` succeeds

**Human step after Task 1:**

```bash
supabase db push   # or apply via dashboard
supabase gen types typescript --project-id gdjhztmsmhqftuidzqfa > src/integrations/supabase/types.ts
```

-----

## Task 2: Block Derivation Function in planningCore.ts

**Modify file:** `supabase/functions/_shared/planningCore.ts`

**What:** Add a `deriveBlocksFromPlan()` function that takes a `PlanStructure` and returns an array of block records. This is a pure function with no DB access.

**Add type:**

```typescript
export interface DerivedBlock {
  phase: Phase;
  blockNumber: number;           // 1-indexed within plan
  blockNumberInPhase: number;    // 1-indexed within phase
  startDate: string;             // ISO date
  endDate: string;               // ISO date
  weeks: number;
  loadWeeks: number;
  deloadWeekNumbers: number[];   // plan-level week numbers
}
```

**Add function:** `export function deriveBlocksFromPlan(plan: PlanStructure): DerivedBlock[]`

**Logic:**

- Iterate over `plan.phases`
- For each phase, use `phase.deloadStrategy.defaultPattern` to determine block interval (3 or 4 weeks)
- If pattern is `"none"` (peak/taper): entire phase = 1 block, no deload weeks
- If pattern is `"every_3_weeks"` or `"every_4_weeks"`: split phase into blocks of that interval
- Last block may be shorter if phase weeks don’t divide evenly. If shorter block has no matching deload week in `phase.deloadWeeks`, it has 0 deload weeks.
- Compute `startDate` and `endDate` from `plan.planStartDate` and cumulative week offsets
- `deloadWeekNumbers` = intersection of `phase.deloadWeeks` with the block’s week range

**Also export from `src/lib/coaching/planningCore.ts` (the shim):** Add re-export for `DerivedBlock` type and `deriveBlocksFromPlan` function.

**Add tests:** `src/lib/coaching/blockDerivation.test.ts`

- Test 12-week plan with base(6w, every_3_weeks) + build(3w, every_3_weeks) + peak(1w, none) + taper(2w, none)
- Verify correct number of blocks, correct week ranges, correct deload placement
- Test edge case: phase weeks not evenly divisible by interval

**Done criteria:**

- Function exists and is exported
- Tests pass (`bun test`)
- Re-export shim updated

-----

## Task 3: create-plan Edge Function

**Create file:** `supabase/functions/create-plan/index.ts`

**Dependencies:** Task 1 (migration) + Task 2 (deriveBlocksFromPlan)

**Input contract:**

```typescript
{
  eventDemandProfile: string,
  eventName?: string,
  eventDate?: string,
  hoursPerWeek: number,
  availableDays: string[],
  strengthSessionsPerWeek?: number,
  entryState: "fresh_start" | "mid_training" | "returning_after_break",
  typology?: "PYRAMIDAL" | "POLARIZED" | "SS_THRESHOLD",  // if absent, system derives default
  vacationWeeks?: string[]  // ISO date Mondays of known vacation weeks
}
```

**Logic (in order):**

1. Auth check (pattern from `compute-athlete-context`)
1. Archive existing active plan: `UPDATE plans SET status='archived', archived_at=now() WHERE user_id=X AND status='active'`
1. Call `compute-athlete-context` via Supabase internal function invoke
1. Read fresh `athlete_state` from `athlete_state` table
1. Call `generatePlanStructure()` (import from `../_shared/planningCore.ts`)
1. Call `deriveBlocksFromPlan()` on the result
1. INSERT into `plans` — full snapshot including `plan_structure_json`, `macro_strategy`, `typology`, `constitution_version`, `entry_state`, `current_ctl` from athlete_state
1. INSERT all blocks into `blocks` table. Set first block’s status to `'active'` if its date range includes today. Mark vacation weeks in the relevant block’s `user_inputs_json`.
1. Call `generate-week-skeleton` via Supabase internal invoke with `{ planId: newPlanId, weekStartDate: currentMonday }`
1. Return `{ planId, planStructure, blocks, weekContext, weekSkeleton }`

**Reference patterns:** Copy CORS, auth, client patterns from `compute-athlete-context/index.ts`.

**Do NOT call `build-workouts`.** Skeleton only. Cost control.

**Done criteria:**

- Function deploys without error
- POST with valid inputs returns plan + blocks + skeleton
- `plans` table has new row with plan_structure_json
- `blocks` table has block rows matching the plan’s phase structure
- Old active plan is archived

-----

## Task 4: Modify generate-week-skeleton for planId + Block Context

**Modify file:** `supabase/functions/generate-week-skeleton/index.ts`

**Changes:**

1. Parse optional `planId` from request body
1. If `planId` provided:
- Query `plans.plan_structure_json` WHERE id=planId AND user_id=user.id
- Parse into PlanStructure (use for getWeekContext, budget computation)
- Query `blocks` WHERE plan_id=planId AND start_date <= weekStartDate AND end_date >= weekStartDate
- Include block context in the user prompt: block number, week-in-block, is-deload, block user_inputs
- If block has `user_inputs_json.availableDays`, use that instead of athlete_state’s availableDays
1. If no `planId`: existing behavior unchanged (backwards compat for debug)
1. Include block context in the response:
   
   ```json
   "blockContext": {
     "blockNumber": 2,
     "blockNumberInPhase": 2,
     "phase": "base",
     "weekInBlock": 2,
     "isDeloadWeek": false,
     "blockWeeks": 3,
     "blockLoadWeeks": 2
   }
   ```

**Done criteria:**

- Debug flow (no planId) still works
- With planId: uses stored plan, includes block context
- Block user_inputs override plan-level defaults

-----

## Task 5: useActivePlan Hook

**Create file:** `src/hooks/useActivePlan.ts`

**Logic:**

- Query `plans` WHERE status=‘active’ ORDER BY created_at DESC LIMIT 1
- If plan found: query `blocks` WHERE plan_id = plan.id ORDER BY block_number ASC
- Parse `plan_structure_json` into typed PlanStructure
- Return `{ plan, blocks, loading, error, refetch }`

**Types:** Use generated Supabase types (no `as any`). If types are stale, this task is blocked until Task 1 human step is done.

**Done criteria:**

- Returns null when no active plan
- Returns plan + blocks when one exists
- No `as any` casts

-----

## Task 6: usePlanPipeline Hook

**Create file:** `src/hooks/usePlanPipeline.ts`

**API:**

```typescript
{
  createPlan: (inputs) => Promise<CreatePlanResult>,
  loadCurrentWeek: (planId, weekStartDate?) => Promise<void>,
  skeleton: WeekSkeleton | null,
  weekContext: WeekContext | null,
  blockContext: BlockContext | null,
  loading: boolean,
  error: string | null,
}
```

**Logic:**

- `createPlan()`: single call to `supabase.functions.invoke("create-plan", { body })`. Returns full result.
- `loadCurrentWeek()`: single call to `supabase.functions.invoke("generate-week-skeleton", { body: { planId, weekStartDate } })`. Updates state.
- No multi-step orchestration. Each method = one edge function call.

**Done criteria:**

- Compiles. Two methods, each calling one edge function.

-----

## Task 7: PlanCreationWizard Component

**Create file:** `src/components/plan/PlanCreationWizard.tsx`

**Props:** `{ onPlanCreated: (result: CreatePlanResult) => void }`

**4 Steps:**

**Step 1 — “Goal & Event”:**

- `event_demand_profile` — Select (use `DEMAND_PROFILES` from existing SettingsPage)
- `event_name` — Optional text
- `event_date` — Optional date picker (Calendar + Popover, same as Onboarding)
- `entry_state` — Select: “Starting fresh” / “Currently training consistently” / “Returning after a break”

**Step 2 — “Strategy & Schedule”:**

- `hours_per_week` — Slider (3–15h, pre-filled from `useAthletePreferences`)
- `available_days` — Day toggle (pre-filled from `useAthletePreferences`)
- `strength_sessions_per_week` — Slider (0–4)
- `typology` — Radio group: Pyramidal (balanced) / Polarized (80/20) / Sweet Spot/Threshold. System computes recommended default from `event_demand_profile × hours_per_week` (use `constitution.json → typology_defaults` mapping + S4a.1 logic). Pre-select the recommendation. If user overrides and hours don’t support the choice, show soft warning (TYPOLOGY_MISMATCH from Constitution S11.2). See `docs/constitution-v7-amendments.md` for mismatch conditions.
- `prefer_outdoor_long_ride` / `prefer_indoor_intervals` — Toggles (pre-filled from Settings)
- Optional: `vacationWeeks` — date picker for known vacation weeks

**Step 3 — “Phase & Block Preview”:**

- Import `generatePlanStructure` from `@/lib/coaching/planningCore`
- Import `deriveBlocksFromPlan` from `@/lib/coaching/planningCore`
- Call both client-side with wizard inputs → instant preview, no network call
- Display: phase timeline with colored bars, block boundaries, deload weeks marked
- Display: summary cards (total weeks, phase durations, number of blocks)
- User can adjust phase durations ±1–2 weeks (with visual warning if outside Constitution S8.1 bounds — implement as soft warning, not hard block)
- Vacation weeks highlighted if set in Step 2

**Step 4 — “Confirm”:**

- Summary of all inputs from Steps 1–3
- “Create Plan” button → `usePlanPipeline.createPlan()`
- Loading state with progress message (“Creating plan… Generating first week…”)
- On success: `onPlanCreated(result)`

**UI:** Use existing shadcn components (Card, Select, Slider, Button, Calendar, Popover). Step indicator at top. Forward/back navigation between steps. German labels matching existing UI.

**Done criteria:**

- All 4 steps render
- Step 3 shows instant preview from pure function
- “Create Plan” calls the edge function
- Calls onPlanCreated on success

-----

## Task 8: Wire TrainingPlan Page

**Modify file:** `src/pages/TrainingPlan.tsx`

**Changes:**

- Remove `MOCK_PIPELINE_RESPONSE` import
- Use `useActivePlan()` to check for active plan
- Use `usePlanPipeline()` for loading and creating

**State machine:**

```
no plan → show PlanCreationWizard as full page content
plan exists, skeleton not loaded → call loadCurrentWeek(plan.id), show loading
plan exists, skeleton loaded → show full plan view:
  - MacrocycleTimeline (phases from plan.plan_structure_json)
  - Block timeline (from blocks, color-coded, current block highlighted)
  - WeeklyCalendar (from skeleton)
  - Side panels
plan just created → use response data directly (no extra load needed)
```

- Add “New Plan” button in header → resets to wizard state
- Keep mobile drawer support

**Done criteria:**

- No mock data references
- Empty state = wizard
- After creation, real plan/blocks/skeleton displayed
- Macrocycle + block timeline visible

-----

## Task 9: Simplify Onboarding

**Modify file:** `src/pages/Onboarding.tsx`

**Changes:**

- Step 2: save `hours_per_week`, `available_days`, `event_demand_profile` to `athlete_preferences`
- Remove `event_date` from onboarding (plan-level decision)
- On “Save & Continue”: `navigate("/plan")`
- Wizard will run on `/plan` when user arrives with no plan

**Done criteria:**

- Saves preferences, navigates to /plan
- No plan creation in Onboarding

-----

## Task 10: Dashboard Debug Behind Flag

**Modify file:** `src/pages/Dashboard.tsx`

- Wrap debug section in:
  
  ```tsx
  {(import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) && (
    // ... debug UI
  )}
  ```
- No other changes.

**Done criteria:**

- Debug visible in dev mode or with `?debug=true`
- Hidden in production

-----

## Task 11: Type Safety Cleanup

**Modify file:** `src/hooks/useAthletePreferences.ts`

- Remove all `as any` casts
- Use generated Supabase types for `.from("athlete_preferences")`
- Properly type the data response

**Dependencies:** Task 1 human step (types regenerated)

**Done criteria:**

- No `as any` in file
- Build succeeds
- Hook works

-----

## Phase 2 Tasks (Not Yet — Listed for Context)

These are NOT implemented in Phase 1 but are designed for:

- **Block Planning Touchpoint:** UI for editing upcoming blocks (user_inputs_json), notification when block approaches
- **Full Mid-Cycle Entry:** Retrospective planStartDate computation when `entry_state=mid_training`
- **Plans List Page:** Archive/history view
- **Phase Duration Editing:** Adjust ±weeks with Constitution guardrails in Step 3
- **Weekly Context Overrides:** Move WeeklyContextInputs to Plan page, trigger skeleton regeneration

-----

## Execution Notes

- **One task per Claude Code invocation.** Don’t combine.
- **Read `CLAUDE.md` first.** Then `docs/architecture.md` for the task’s domain.
- **Test after each task:** `bun run build` for TS, `bun test` for unit tests.
- **Don’t edit `src/components/ui/`.**
- **Don’t call `build-workouts`** — skeleton only in Phase 1.
- **`generatePlanStructure()` and `deriveBlocksFromPlan()` are pure functions.** They can be used client-side for previews without any DB or network dependency.

-----

*VeloCoach AI Buddy · Phase 1 Implementation Tasks V2 · March 2026*
