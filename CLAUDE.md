# CLAUDE.md — VeloCoach AI Buddy

Read this file at the start of every task. It is the authoritative project context.

## What is VeloCoach?

An AI-supported cycling coaching app for hobbyist athletes (5–15h/week). It generates structured training plans using classical periodization (Base → Build → Peak → Taper) with user-selectable intensity distribution strategy (Polarized, Pyramidal, SS/Threshold). All planning is driven by a Coach Constitution (sports science ruleset). Connected to Intervals.icu for activity/wellness data.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Edge Functions in Deno)
- **LLM Calls:** Anthropic API (Claude Sonnet 4.6 for planning, Claude Sonnet 4.5 for workouts)
- **Package Manager:** Bun (use `bun install`, `bun run dev`, `bun test`)
- **Testing:** Vitest

## Project Structure

```
src/
  pages/              → Route pages (Dashboard, TrainingPlan, Settings, Chat, etc.)
  components/
    plan/             → Plan-specific components (wizard, calendar, panels)
    settings/         → Connection cards
    ui/               → shadcn/ui primitives (DO NOT EDIT)
  hooks/              → React hooks (useActivePlan, useAthletePreferences, etc.)
  lib/coaching/       → Client-side coaching logic (re-exports from _shared/)
  integrations/supabase/ → Supabase client + generated types
  types/              → UI-facing type definitions
  mocks/              → Mock data for development

supabase/
  functions/
    _shared/          → Shared code for edge functions
      planningCore.ts → SOURCE OF TRUTH for macro planning + block derivation
      constitution.json → Machine-readable Constitution v7 constants
      workoutsCore.ts → Workout generation helpers
    compute-athlete-context/ → Compiles AthleteState from all DB tables
    generate-week-skeleton/  → LLM-powered weekly plan generation
    build-workouts/          → LLM-powered workout detail generation
    create-plan/             → Plan creation orchestrator (TO BE BUILT)
    ai-coach/                → Chat-based coaching agent
    intervals-proxy/         → Intervals.icu API proxy + sync
    dexcom-sync/             → Dexcom CGM sync
  migrations/         → SQL migrations (applied in order)

docs/
  data-ownership.md   → Authoritative data ownership rules
  architecture.md     → Operative architecture reference (5-level hierarchy)
  implementation-tasks.md → Sequenced tasks for Claude Code
```

## Mandatory Reference Documents

Before making changes to planning logic, data access, or edge functions, read:

1. **Coach Constitution v7** — sports science ruleset. All planning must comply.
1. **`docs/constitution-v7-amendments.md`** — clarifications to Constitution (e.g., typology is user-selectable).
1. **`docs/data-ownership.md`** — which table owns which data. Violations are bugs.
1. **`docs/architecture.md`** — pipeline, 5-level hierarchy, data model, invariants.

## 5-Level Planning Hierarchy

This is the core product architecture. Every planning feature maps to one of these levels.

```
Level 1: TRAINING PLAN (Makrozyklus)
  What:    Goal, event, strategy → phase structure with block boundaries
  Stored:  plans + blocks tables
  Trigger: User creates plan via wizard on /plan page

Level 2: BLOCK PLAN (Mesozyklus)
  What:    Refinement of upcoming block — constraints, schedule, focus
  Stored:  blocks.user_inputs_json updated
  Trigger: Block approaching → user prompted to review/confirm

Level 3: WEEKLY PLAN (Mikrozyklus)
  What:    Concrete session slots for one week (types, durations, TSS)
  Stored:  week_skeleton_cache
  Trigger: generate-week-skeleton (LLM call)

Level 4: SESSION PLAN (Einzeltraining)
  What:    Detailed workout with intervals, cadence, ICU codes
  Stored:  planned_workouts
  Trigger: User manually triggers build-workouts (cost control)

Level 5: CHAT ADJUSTMENTS
  What:    Ad-hoc changes to sessions, schedule, constraints
  Stored:  plan_adjustments
  Trigger: User via chat interface
```

LLM calls happen at Level 3 and Level 4. Level 4 is always user-triggered, never automatic.

## Key Architectural Rules

1. **Plans are snapshots.** Read-only after creation. Changes → `plan_adjustments`.
1. **Blocks are first-class records.** Generated from phase + deload pattern at plan creation. Own lifecycle (upcoming → active → completed). Accept user inputs before activation.
1. **`planningCore.ts` lives in `supabase/functions/_shared/`.** `src/lib/coaching/planningCore.ts` is a re-export shim. Edit only the `_shared/` version.
1. **Server-side orchestration.** `create-plan` is the orchestrator. No multi-step frontend pipelines.
1. **CTL/ATL/TSB from `wellness_days` only.** Never from `plans.current_ctl`.
1. **Constitution enforcement is TypeScript, not LLM.** LLM generates; validators enforce.
1. **`generatePlanStructure()` is a pure function** usable client-side for instant previews and server-side for persistence.
1. **`as any` casts = stale types.** Regenerate after every migration.

## Data Ownership (Summary)

|Data                          |Source of Truth        |Written By                                  |
|------------------------------|-----------------------|--------------------------------------------|
|Training setup defaults       |`athlete_preferences`  |User via Settings / Onboarding              |
|Imported metrics (FTP, weight)|`athlete_profiles`     |intervals-proxy sync                        |
|Fitness load (CTL/ATL/TSB)    |`wellness_days`        |intervals-proxy sync                        |
|Activity history              |`activities`           |intervals-proxy sync                        |
|Plan config (snapshot)        |`plans`                |create-plan edge function                   |
|Block structure + user inputs |`blocks`               |create-plan (initial) + block-plan (updates)|
|Weekly session slots          |`week_skeleton_cache`  |generate-week-skeleton                      |
|Detailed workouts             |`planned_workouts`     |build-workouts (user-triggered)             |
|Compiled athlete context      |`athlete_state` (cache)|compute-athlete-context                     |

## Current Phase: Phase 1 — Plan Creation Flow

**Goal:** User creates plan on `/plan`, sees phase/block timeline, sees real weekly skeleton.

**See:** `docs/implementation-tasks.md` for sequenced tasks.

## Do NOT

- Edit `src/components/ui/` (shadcn primitives)
- Put planning logic in frontend components
- Read current setup from `plans` when `athlete_preferences` exists
- Trust LLM output without validation
- Call `build-workouts` automatically (user-triggered only)
- Remove debug flows — hide behind `import.meta.env.DEV`
- UPDATE existing `plans` rows
