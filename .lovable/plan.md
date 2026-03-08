

# Training Plan Page (`/plan`) — Implementation Plan

This is a large feature with 4 major sections. Here's how it will be built:

## Architecture

```text
src/
├── pages/TrainingPlan.tsx          # Main page, orchestrates all 3 levels + generator
├── hooks/useTrainingPlanData.ts    # Fetches events + activities from Intervals.icu
├── components/plan/
│   ├── MacrocycleTimeline.tsx       # Level 1 — phase timeline + KPI projections
│   ├── EditPhasesDialog.tsx         # Modal for editing phase boundaries/types/TSS
│   ├── WeeklyCalendar.tsx           # Level 2 — 4-week rolling grid
│   ├── DayDetailPanel.tsx           # Level 3 — slide-in panel (Sheet on mobile)
│   └── PlanGenerator.tsx            # Bottom collapsible form + stepper
├── types/trainingPlan.ts            # Shared types (Phase, PlannedWorkout, etc.)
└── lib/planUtils.ts                 # Color maps, duration formatting, mock data
```

## Data Flow

1. **`useTrainingPlanData` hook** — Two Intervals.icu API calls:
   - `GET /events?category=WORKOUT` (planned workouts, next 4 weeks)
   - `GET /activities` (completed, last 4 weeks)
   - Merges planned vs completed by matching date + type

2. **Mock macrocycle data** — Since the AI plan generator isn't wired up yet, the macrocycle phases will use either stored `training_plans` data from Supabase or sensible defaults/mock data when none exists.

## Level 1 — Macrocycle Timeline

- Horizontal bar with colored phase blocks (Base=blue, Build=orange, Peak=red, Taper=green, Recovery=gray)
- Each block shows: name, weeks, target CTL range, weekly TSS, workout type icon
- 4 KPI cards below: Current→Projected CTL, Weeks to event, Total hours, Peak TSB
- "Edit Phases" button opens a Dialog with:
  - List of phases with dropdowns for type, number inputs for TSS targets
  - Phase duration adjustment (simplified — no actual drag, just week count inputs)

## Level 2 — Weekly Calendar

- 4-week grid: Mon–Sun columns, week rows
- Week header: week number, date range, phase label, TSS target vs actual with progress bar
- Day cells: workout pill (colored by type), checkmark if completed, red X if missed
- Click opens Level 3 panel
- Workout type color map: Endurance=#3B82F6, Sweet Spot=#F97316, VO2max=#EF4444, Long Ride=#8B5CF6, Recovery=#22C55E

## Level 3 — Day Detail Panel

- Uses shadcn Sheet (side on desktop, bottom on mobile via `useIsMobile`)
- Shows: workout name, type badge, duration, TSS, description text, power targets
- Planned vs actual comparison if completed
- Edit button for workout description (inline textarea)
- "Save to Intervals.icu" button (UI only, no API call yet)

## Plan Generator (bottom collapsible)

- Collapsible section using shadcn Collapsible
- 3-step form:
  1. Goal setup: event name (Input), date (DatePicker), type (Select), difficulty
  2. Availability: day checkboxes, hours slider (5–20h), longest ride dropdown
  3. Preferences: philosophy radio, fitness context dropdown, priority radio
- "Generate Plan" button triggers mock stepper animation (5 steps with delays)
- Success card with phase summary + "View in Calendar" scroll action

## Key Details

- All components follow existing dark theme (CSS variables already defined)
- Loading states use Skeleton components
- Error handling with retry, consistent with Dashboard
- Mobile: Sheet becomes bottom drawer, calendar scrolls horizontally
- Phase click in Level 1 scrolls Level 2 to that phase's weeks via refs

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/types/trainingPlan.ts` | Create — shared types |
| `src/lib/planUtils.ts` | Create — colors, mock data, utilities |
| `src/hooks/useTrainingPlanData.ts` | Create — Intervals.icu events + activities fetch |
| `src/components/plan/MacrocycleTimeline.tsx` | Create |
| `src/components/plan/EditPhasesDialog.tsx` | Create |
| `src/components/plan/WeeklyCalendar.tsx` | Create |
| `src/components/plan/DayDetailPanel.tsx` | Create |
| `src/components/plan/PlanGenerator.tsx` | Create |
| `src/pages/TrainingPlan.tsx` | Rewrite — compose all sections |

