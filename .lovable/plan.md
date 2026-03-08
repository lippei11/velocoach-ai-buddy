

## Problem

The Intervals.icu connection is active and returns data, but the Supabase tables are empty because the user never clicked "Sync now" in Settings. The Dashboard shows "Noch keine Daten" with a confusing "Ersten Sync starten" button that navigates to Settings instead of syncing directly.

Additionally, the `lastSyncAt` field is misleadingly set by the legacy `fetch` proxy action, not by actual data persistence.

## Plan

### 1. Auto-sync on Dashboard load when tables are empty but connected

In `useIntervalsData.ts`, after detecting that the connection exists but tables are empty, automatically trigger a sync via the `intervals-proxy` `sync` action, then re-fetch local data.

### 2. Fix legacy fetch updating lastSyncAt

In `intervals-proxy/index.ts`, remove the `last_sync_at` update from the `fetch` action (lines 373-376). Only the `sync` action should set this timestamp.

### 3. Improve Dashboard no-data state

Update the "no-data" state to show a "Jetzt synchronisieren" button that triggers sync directly from the Dashboard (not navigate to Settings), with a spinner while syncing.

### Technical Details

- `useIntervalsData.ts`: Add a `syncAndReload` function that calls `intervals-proxy` with `action: "sync"`, then re-fetches from Supabase tables
- On first load: if `connected === true` and both tables return 0 rows, auto-call `syncAndReload`
- Dashboard "no-data" state: replace Settings navigation with direct sync button
- Edge function: remove `last_sync_at` update from `fetch` action

