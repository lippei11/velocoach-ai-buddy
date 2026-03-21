# Constitution v7 — Amendments & Clarifications

**This file tracks clarifications to the Coach Constitution v7 that do not change its rules but make implicit design decisions explicit. These clarifications are binding for implementation.**

-----

## Amendment 1: Typology is User-Selectable at Plan Creation

**Date:** March 2026  
**Affects:** S4.1 (Typology Selection Logic), S10 (ADJUST_TYPOLOGY), S11.2 (TYPOLOGY_MISMATCH)

### Clarification

S4.1 defines typology selection as “heuristic defaults.” S11.2 references “selected typology” implying user choice. S10 allows ADJUST_TYPOLOGY via chat. These three sections together establish that typology is not system-imposed but user-confirmable.

**Explicit rule (missing from v7 text, now stated):**

At plan creation, the system computes a recommended typology from `event_demand_profile × hours_per_week` using S4.1 + S4a.1 tables. This recommendation is presented to the athlete as a default. The athlete may:

1. **Accept** the recommendation (default path, no action needed)
1. **Override** with a different typology — triggers TYPOLOGY_MISMATCH soft warning (S11.2) if the override conflicts with hours_per_week support

The selected typology (whether default or override) is stored on the `plans` row as `typology` and on `plans.plan_structure_json`. It drives TID priors (S4.2), phase emphasis, and session allocation for the entire plan duration.

### Typology Options Shown to User

|Typology    |User-Facing Label     |When Recommended                               |
|------------|----------------------|-----------------------------------------------|
|PYRAMIDAL   |Pyramidal (balanced)  |6–10h/week, most profiles. System default.     |
|POLARIZED   |Polarized (80/20)     |>10h/week, strong aerobic base, endurance goals|
|SS_THRESHOLD|Sweet Spot / Threshold|≤8h/week, ftp_build, time_trial                |

LINEAR is never user-selectable — it is system-imposed during re-entry (S6.2) only.

### Mismatch Conditions (from S4.1 + S4a.1)

|Selected    |Condition          |Warning                                                                                                                                          |
|------------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
|POLARIZED   |hours_per_week < 8 |“Polarized training needs sufficient low-intensity volume. With {hours}h/week, the Z1–Z2 base may be insufficient. Pyramidal is recommended.”    |
|SS_THRESHOLD|hours_per_week > 12|“With {hours}h/week you have enough volume for a polarized or pyramidal approach. SS/Threshold may cause cumulative fatigue. Consider Pyramidal.”|

These are soft warnings — the user’s choice is respected and stored.

### Impact on Constitution JSON

No changes to `constitution.json` needed. The `typology_defaults` field already contains “defaults” — the field name is correctly named. `compute-athlete-context` uses it as a default that can be overridden.

-----

*VeloCoach · Constitution v7 Amendments · March 2026*
