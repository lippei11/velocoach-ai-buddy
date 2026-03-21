

## Problem
The debug buttons row (Test Context, Test Week Skeleton, Test Build Workouts, Aktualisieren) is in a horizontal flex container. On the current 402px viewport, buttons overflow and are clipped/hidden.

## Fix
Make the debug button row wrap on small screens so all buttons remain visible.

### File: `src/pages/Dashboard.tsx` (~line 308)
Change the button container from `flex items-center gap-2` to `flex flex-wrap items-center gap-2` so buttons wrap to the next line on narrow viewports.

### Scope
- Single line change in one file
- No logic changes, no new components

