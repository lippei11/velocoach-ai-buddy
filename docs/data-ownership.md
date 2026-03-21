# VeloCoach — Data Ownership Rules

**Version 2.0 · March 2026**

Diese Datei ist die verbindliche Source-of-Truth-Regel für alle Agenten, Edge Functions und Claude Code Tasks.
Kein Agent darf Felder aus einer anderen als der hier definierten Tabelle lesen oder schreiben.

Siehe `docs/architecture.md` für die 5-Level-Planungshierarchie, die diese Datenstruktur motiviert.

-----

## Tabellen-Übersicht

### Source-of-Truth-Tabellen

|Tabelle              |Zweck                                          |Planungsebene  |Status     |
|---------------------|-----------------------------------------------|---------------|-----------|
|`athlete_connections`|Technische Integrationen / Verbindungszustand  |—              |✅ Existiert|
|`athlete_profiles`   |Importierte Athletenmetriken aus Intervals.icu |—              |✅ Existiert|
|`athlete_preferences`|Dauerhaftes Coaching Setup / User-Konfiguration|Defaults für L1|✅ Existiert|
|`wellness_days`      |Trainingslastwerte (CTL, ATL, TSB, HRV)        |Input für L1–L3|✅ Existiert|
|`activities`         |Abgeschlossene Einheiten                       |Input für L1–L3|✅ Existiert|
|`plans`              |Plansnapshot zum Generierungszeitpunkt         |Level 1        |✅ Existiert|
|`blocks`             |Mesozyklus-Records mit User-Inputs             |Level 1 + 2    |⏳ Phase 1  |
|`planned_workouts`   |Konkrete Sessions mit Status + ICU-Codes       |Level 4        |✅ Existiert|
|`plan_adjustments`   |Änderungen am Plan über Chat                   |Level 5        |✅ Existiert|

### Cache-Tabellen

|Tabelle              |Zweck                              |Invalidiert durch             |Status     |
|---------------------|-----------------------------------|------------------------------|-----------|
|`athlete_state`      |Kompilierter Athletenkontext (JSON)|Re-Run compute-athlete-context|✅ Existiert|
|`week_skeleton_cache`|Validiertes WeekSkeleton pro Woche |Input-Fingerprint-Änderung    |✅ Existiert|

-----

## Source of Truth pro Tabelle

### `athlete_connections`

**Zweck:** Technische Verbindung zu externen Plattformen

Source of Truth für:

- `intervals_athlete_id` — technische ID für API-Calls
- `intervals_api_key`
- `connection_status`, `connected_at`, `last_sync_at`, `last_error`
- Dexcom-Verbindungsfelder

Darf **nicht** Source of Truth sein für:

- `event_demand_profile`
- `hours_per_week`
- `available_days`
- Coaching-Präferenzen jeglicher Art

-----

### `athlete_profiles`

**Zweck:** Importierte oder abgeleitete Athletenmetriken aus Intervals.icu

Source of Truth für:

- `ftp`, `weight`, `max_hr`, `resting_hr`
- `intervals_athlete_id` — importierter Wert aus Sync
- `sport_types`, `raw_data`

Darf **nicht** Source of Truth sein für:

- Training Setup
- Ziel-Event-Definition
- Wochenpräferenzen

-----

### `athlete_preferences`

**Zweck:** Dauerhaftes Coaching Setup — User-konfigurierbare Trainingspräferenzen.
Diese Werte dienen als **Defaults** für die Plan-Erstellung. Bei Plan-Erstellung werden sie als Snapshot in `plans` kopiert.

Source of Truth für:

- `event_demand_profile` — Default für neue Pläne
- `event_name` — Default für neue Pläne
- `event_date` — Default für neue Pläne
- `goal_type` — Default für neue Pläne
- `hours_per_week` — Default Wochenstunden
- `available_days` — Default verfügbare Tage
- `prefer_outdoor_long_ride` — Dauerhafte Stilpräferenz
- `prefer_indoor_intervals` — Dauerhafte Stilpräferenz
- `training_time_of_day` — Dauerhafte Stilpräferenz
- `strength_sessions_per_week` — Default
- `constraints_notes` — Freitext-Einschränkungen

Darf **nicht** Source of Truth sein für:

- Aktuelle Plan-Konfiguration → dafür `plans` lesen
- Aktuelle Block-Konfiguration → dafür `blocks` lesen
- Typology des aktiven Plans → dafür `plans.typology` lesen

-----

### `wellness_days`

**Zweck:** Trainingslastwerte aus Intervals.icu Sync

Source of Truth für:

- `ctl`, `atl`, `tsb`, `ramp_rate`
- `hrv`, `resting_hr`, `sleep_score`, `weight`

> ⚠️ CTL/ATL/TSB **immer** aus `wellness_days` lesen — niemals aus `plans.current_ctl`.
> `plans.current_ctl` ist ein Snapshot-Wert zum Generierungszeitpunkt, keine aktuelle Metrik.

-----

### `activities`

**Zweck:** Abgeschlossene Trainingseinheiten aus Intervals.icu

Source of Truth für:

- Aktivitätshistorie, TSS-History, NP, IF, HR, Distanz
- Basis für `durability_score`, `recent_execution_quality`, `power_hr_decoupling`

-----

### `plans`

**Zweck:** Snapshot der Plan-Parameter zum Zeitpunkt der Generierung (Level 1)

Darf enthalten:

- `event_demand_profile`, `event_name`, `event_date`, `goal_type` — **als Snapshot**
- `hours_per_week`, `available_days` — **als Snapshot**
- `plan_start_date` — Startdatum des Plans
- `plan_structure_json` — vollständige PlanStructure (Phasen, Deload-Schedule, Macro-Strategie)
- `macro_strategy` — base_heavy / balanced / specificity_heavy / compressed
- `typology` — PYRAMIDAL / POLARIZED / SS_THRESHOLD — System-Empfehlung oder User-Override (siehe `constitution-v7-amendments.md`)
- `entry_state` — fresh_start / mid_training / returning_after_break
- `current_ctl`, `target_ctl` — **als Snapshot**
- `fitness_context`, `rationale`
- `constitution_version` — gesperrt bei Erstellung
- `status` — active / archived
- `archived_at` — Zeitpunkt der Archivierung

**Snapshot-Regel:**

- `plans` spiegelt die zum Generierungszeitpunkt verwendeten Werte wider
- Änderungen im Training Setup ändern **nicht** rückwirkend alte Plansnapshots
- Ein Plan ist nach Erstellung **read-only** — Anpassungen erzeugen `plan_adjustments`, keinen UPDATE auf `plans`
- Neuer Plan = alter Plan archivieren (`status='archived'`, `archived_at=now()`) + neuen INSERT

-----

### `blocks`

**Zweck:** Mesozyklus-Records — planbare Einheiten innerhalb einer Phase (Level 1 + Level 2)

Erstellt bei Plan-Erstellung (Level 1). Aktualisiert durch User vor Block-Start (Level 2).

Source of Truth für:

- `phase`, `block_number`, `block_number_in_phase`
- `start_date`, `end_date`, `weeks`, `load_weeks`
- `deload_week_numbers` — Array der Deload-Wochen (Plan-Level Wochennummern)
- `status` — upcoming / active / completed
- `user_inputs_json` — User-Overrides pro Block: `{ availableDays?, constraints?, vacationWeeks?, focusNotes? }`

**Block-Regeln:**

- Blöcke werden bei Plan-Erstellung deterministisch aus Phase + Deload-Pattern abgeleitet
- `user_inputs_json` darf VOR Block-Aktivierung vom User bearbeitet werden (Level 2 Touchpoint)
- Block-User-Inputs überschreiben Plan-Level-Defaults für die Wochen dieses Blocks
- `status` wird automatisch aktualisiert: `upcoming` → `active` (wenn Startdatum erreicht) → `completed` (wenn Enddatum überschritten)

-----

### `planned_workouts`

**Zweck:** Konkrete Sessions einer Planwoche mit Live-Status (Level 4)

Source of Truth für:

- `name`, `description`, `purpose`, `workout_type`, `stress_type`
- `planned_tss`, `executed_tss`, `completion_status`, `match_confidence`
- `intervals_icu_id` — nach Push zu Intervals.icu
- `synced_to_intervals`

> ⚠️ Wird nur durch expliziten User-Trigger (`build-workouts`) erzeugt, nicht automatisch bei Plan-Erstellung.

-----

### `plan_adjustments`

**Zweck:** Änderungen am Plan über Chat-Aktionen (Level 5)

Source of Truth für:

- `reason`, `trigger_type`
- `affected_workout_ids`
- `changes` — JSON mit konkreten Änderungen
- `explanation` — Coach-Erklärung der Änderung

> Plans werden NICHT aktualisiert. Alle Änderungen werden als `plan_adjustments`-Rows geschrieben.

-----

### `athlete_state` (Cache)

**Zweck:** Kompilierter Athletenkontext aus allen Source-of-Truth-Tabellen

- Wird durch `compute-athlete-context` erzeugt/aktualisiert
- Enthält abgeleitete Werte: `confidence`, `durabilityScore`, `readinessLevel`, `reentryContext`, etc.
- Wird von `generate-week-skeleton` und `create-plan` gelesen
- Ist **kein** Source of Truth — bei Diskrepanz immer die Quell-Tabellen konsultieren

-----

### `week_skeleton_cache` (Cache)

**Zweck:** Validiertes WeekSkeleton pro User pro Woche

- Keyed by `(user_id, week_start_date)`
- `input_fingerprint` kodiert alle Inputs — Mismatch = Cache stale
- Nur erfolgreich validierte WeekSkeletons werden gecacht
- Wird durch `generate-week-skeleton` geschrieben und gelesen

-----

## Leseregel für Agenten

```
Training Setup (Defaults)   → athlete_preferences
Aktiver Plan                → plans WHERE status='active'
Block-Kontext für Woche     → blocks WHERE plan_id=X AND start_date <= week AND end_date >= week
Block-User-Overrides        → blocks.user_inputs_json
Connection State            → athlete_connections
Athlete Metrics (FTP etc.)  → athlete_profiles
Fitness Load (CTL/ATL/TSB)  → wellness_days        (NICHT plans.current_ctl)
Activity History            → activities
Kompilierter Kontext        → athlete_state         (Cache, nicht Source of Truth)
Weekly Skeleton             → week_skeleton_cache   (Cache)
Workout Status              → planned_workouts
Plan-Änderungen             → plan_adjustments
```

-----

## Schreibregel

```
User ändert Training Setup  → athlete_preferences
User erstellt Plan          → create-plan Edge Function → plans (snapshot) + blocks
User passt Block an         → blocks.user_inputs_json (Level 2)
User verbindet Integration  → athlete_connections
Sync läuft                  → athlete_profiles + wellness_days + activities
Athletenkontext kompiliert  → athlete_state (cache)
Weekly Skeleton generiert   → week_skeleton_cache
User triggert Workouts      → build-workouts → planned_workouts
Workout abgeschlossen       → planned_workouts.executed_tss + completion_status
Chat-Anpassung              → plan_adjustments
```

-----

## Verbote

```
✗ CTL/ATL/TSB aus plans.current_ctl lesen wenn wellness_days vorhanden
✗ Coaching Setup aus plans lesen wenn athlete_preferences existiert
✗ Typology aus athlete_preferences lesen — Typology gehört zum Plan (plans.typology)
✗ Dieselben aktuellen Setup-Werte aus zwei Tabellen gleichzeitig als "aktuellen Stand" lesen
✗ plans nach Erstellung updaten — stattdessen plan_adjustments schreiben
✗ blocks nach Aktivierung strukturell ändern (start_date, end_date, weeks) — nur user_inputs_json
✗ athlete_connections für Coaching-Präferenzen verwenden
✗ athlete_state als Source of Truth behandeln — es ist ein Cache
✗ build-workouts automatisch aufrufen — immer User-Trigger
```

-----

## Hinweis: `intervals_athlete_id` in zwei Tabellen

|Tabelle                                   |Bedeutung                                                            |
|------------------------------------------|---------------------------------------------------------------------|
|`athlete_connections.intervals_athlete_id`|Technische ID — wird für jeden API-Call gegen Intervals.icu verwendet|
|`athlete_profiles.intervals_athlete_id`   |Importierter Wert aus dem letzten Sync — zur Information             |

Kein Konflikt, aber `athlete_connections` ist die führende ID für API-Calls.

-----

## Hinweis: Typology-Ownership

Typology (`PYRAMIDAL`, `POLARIZED`, `SS_THRESHOLD`) wird bei Plan-Erstellung bestimmt:

- System berechnet Empfehlung aus `event_demand_profile × hours_per_week` (Constitution S4.1)
- User kann im Wizard überschreiben (mit Mismatch-Warnung, siehe `constitution-v7-amendments.md`)
- Gespeichert auf `plans.typology` — nicht in `athlete_preferences`
- Aktive Typology = `plans.typology` des aktiven Plans

-----

*VeloCoach AI Buddy · Data Ownership Rules v2.0 · March 2026*
*Ablageort: `docs/data-ownership.md`*
