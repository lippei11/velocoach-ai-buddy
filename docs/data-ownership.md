
# VeloCoach — Data Ownership Rules

**Version 1.0 · March 2026**

Diese Datei ist die verbindliche Source-of-Truth-Regel für alle Agenten, Edge Functions und Lovable-Prompts.
Kein Agent darf Felder aus einer anderen als der hier definierten Tabelle lesen oder schreiben.

-----

## Tabellen-Übersicht

|Tabelle              |Zweck                                          |Status                   |
|---------------------|-----------------------------------------------|-------------------------|
|`athlete_connections`|Technische Integrationen / Verbindungszustand  |✅ Existiert              |
|`athlete_profiles`   |Importierte Athletenmetriken aus Intervals.icu |✅ Existiert              |
|`athlete_preferences`|Dauerhaftes Coaching Setup / User-Konfiguration|✅ Existiert              |
|`wellness_days`      |Trainingslastwerte (CTL, ATL, TSB, HRV)        |✅ Existiert              |
|`activities`         |Abgeschlossene Einheiten                       |✅ Existiert              |
|`plans`              |Plansnapshot zum Generierungszeitpunkt         |✅ Existiert              |
|`planned_workouts`   |Konkrete Wochen-Sessions mit Status            |✅ Existiert              |

-----

## Source of Truth pro Tabelle

### `athlete_connections`

**Zweck:** Technische Verbindung zu externen Plattformen

Darf enthalten:

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

Darf enthalten:

- `ftp`, `weight`, `max_hr`, `resting_hr`
- `intervals_athlete_id` — importierter Wert aus Sync *(nicht identisch mit `athlete_connections.intervals_athlete_id`, die für API-Calls genutzt wird)*
- `sport_types`, `raw_data`

Darf **nicht** Source of Truth sein für:

- Training Setup
- Ziel-Event-Definition
- Wochenpräferenzen

-----

### `athlete_preferences` ⚠️

**Zweck:** Dauerhaftes Coaching Setup — User-konfigurierbare Trainingspräferenzen

> **Status: Tabelle existiert noch nicht. Migration 2b (Roadmap) ist Voraussetzung.**
> Bis Migration 2b deployed ist, liegen `hours_per_week` und `available_days` in `plans`.
> Nach Migration 2b darf kein Agent diese Werte mehr aus `plans` als "aktuellen Stand" lesen.

Source of Truth für:

- `event_demand_profile`
- `event_date`
- `hours_per_week`
- `available_days`
- `prefer_outdoor_long_ride`
- `prefer_indoor_intervals`
- `training_time_of_day`
- `strength_sessions_per_week`
- weitere dauerhafte Coaching-Präferenzen

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

**Zweck:** Snapshot der Plan-Parameter zum Zeitpunkt der Generierung

Darf enthalten:

- `goal_type`, `event_date`, `hours_per_week`, `available_days` — **als Snapshot**
- `current_ctl`, `target_ctl` — **als Snapshot**
- `phases`, `rationale`, `fitness_context`
- `event_demand_profile`, `typology`, `constitution_version`

Snapshot-Regel:

- `plans` spiegelt die zum Generierungszeitpunkt verwendeten Werte wider
- Änderungen im Training Setup ändern **nicht** rückwirkend alte Plansnapshots
- Ein Plan ist nach Erstellung read-only — Anpassungen erzeugen `plan_adjustments`, keinen Update auf `plans`

-----

### `planned_workouts`

**Zweck:** Konkrete Sessions einer Planwoche mit Live-Status

Darf enthalten:

- `name`, `description`, `purpose`, `workout_type`, `stress_type`
- `planned_tss`, `executed_tss`, `completion_status`, `match_confidence`
- `intervals_icu_id` — nach Push zu Intervals.icu
- `synced_to_intervals`

-----

## Leseregel für Agenten

```
Training Setup (aktuell)    → athlete_preferences  (nach Migration 2b)
Connection State            → athlete_connections
Athlete Metrics (FTP etc.)  → athlete_profiles
Fitness Load (CTL/ATL/TSB)  → wellness_days        (NICHT plans.current_ctl)
Activity History            → activities
Plan Details (Snapshot)     → plans
Workout Status              → planned_workouts
```

-----

## Schreibregel

```
User ändert Training Setup  → athlete_preferences
User verbindet Integration  → athlete_connections
Sync läuft                  → athlete_profiles + wellness_days + activities
Plan wird generiert         → plans (snapshot) + planned_workouts
Workout abgeschlossen       → planned_workouts.executed_tss + completion_status
```

-----

## Verbote

```
✗ CTL/ATL/TSB aus plans.current_ctl lesen wenn wellness_days vorhanden
✗ Coaching Setup aus plans lesen wenn athlete_preferences existiert (nach Migration 2b)
✗ Dieselben aktuellen Setup-Werte aus zwei Tabellen gleichzeitig als "aktuellen Stand" lesen
✗ plans nach Erstellung updaten — stattdessen plan_adjustments schreiben
✗ athlete_connections für Coaching-Präferenzen verwenden
```

-----

## Übergangsregel (bis Migration 2b deployed)

Solange `athlete_preferences` nicht existiert gilt:

- `hours_per_week`, `available_days` aus dem letzten `plans`-Eintrag lesen
- `event_demand_profile` aus dem letzten `plans`-Eintrag lesen
- Nach Migration 2b: Migration muss bestehende Werte aus `plans` in `athlete_preferences` übertragen

-----

## Hinweis: `intervals_athlete_id` in zwei Tabellen

|Tabelle                                   |Bedeutung                                                            |
|------------------------------------------|---------------------------------------------------------------------|
|`athlete_connections.intervals_athlete_id`|Technische ID — wird für jeden API-Call gegen Intervals.icu verwendet|
|`athlete_profiles.intervals_athlete_id`   |Importierter Wert aus dem letzten Sync — zur Information             |

Kein Konflikt, aber `athlete_connections` ist die führende ID für API-Calls.

-----

*VeloCoach AI Buddy · Data Ownership Rules v1.0 · March 2026*
*Ablageort: `docs/data-ownership.md`*
