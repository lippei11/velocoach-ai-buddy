/**
 * VeloCoach — Workout Builder Library
 *
 * Provides canonical workout-type templates derived from constitution.json.
 * Does NOT decide final duration, final TSS, or final session scaling.
 * That logic belongs in the Planning Agent / Workout Builder Agent runtime.
 */

import constitution from './constitutionData';
import type { SessionPurpose, SessionStressType, IndoorOutdoorPreference } from './velocoach-interfaces';

// =============================================================================
// WORKOUT TEMPLATE
// Describes the CHARACTER of a workout type — not final planning constraints.
// =============================================================================

interface WorkoutTemplate {
  purpose: SessionPurpose;
  stressType: SessionStressType;
  zone: string;
  ftpPctRange: [number, number] | null;
  sessionVolumeClass: "small" | "medium" | "large" | "anchor";
  cadenceRequired: boolean;
  cadenceRpm?: [number, number];
  indoorOutdoorDefault: IndoorOutdoorPreference;
  rpeRange: [number, number];
  inAppDefinition: string;
  typicalFormats: string[];
  profileRestriction?: string;
  contextualNote?: string;
  notes: string | null;
  coachNotes: string[];
}

// Canonical order for getAllTemplates()
const CANONICAL_ORDER: SessionPurpose[] = [
  "recovery",
  "endurance",
  "long_ride",
  "sweet_spot",
  "threshold",
  "vo2max",
  "climb_simulation",
  "back_to_back",
  "sprint",
];

// =============================================================================
// getTemplate
// =============================================================================

export function getTemplate(purpose: SessionPurpose): WorkoutTemplate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (constitution.workout_types as Record<string, any>)[purpose];
  if (!raw) {
    throw new Error(
      `No workout template found for purpose: "${purpose}". ` +
      `Available: ${Object.keys(constitution.workout_types).join(", ")}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cr = (constitution.cadence_recommendations as Record<string, any>)[purpose];

  // Aggregate all note-like fields into coachNotes
  const coachNotes: string[] = [];
  if (raw.notes) coachNotes.push(raw.notes);
  if (raw.fuelingNote) coachNotes.push(raw.fuelingNote);
  if (raw.pacingNote) coachNotes.push(raw.pacingNote);
  if (raw.contextualNote) coachNotes.push(raw.contextualNote);

  return {
    purpose,
    stressType: raw.stressType as SessionStressType,
    zone: raw.zone,
    ftpPctRange: raw.ftpPctRange as [number, number] | null,
    sessionVolumeClass: raw.sessionVolumeClass,
    cadenceRequired: raw.cadenceRequired,
    cadenceRpm: raw.cadenceRequired && cr ? (cr.rpmRange as [number, number]) : undefined,
    indoorOutdoorDefault: raw.indoorOutdoorDefault as IndoorOutdoorPreference,
    rpeRange: raw.rpeRange as [number, number],
    inAppDefinition: raw.inAppDefinition,
    typicalFormats: raw.typicalFormats as string[],
    profileRestriction: raw.profileRestriction,
    contextualNote: raw.contextualNote,
    notes: raw.notes ?? null,
    coachNotes,
  };
}

// =============================================================================
// getAllTemplates
// =============================================================================

export function getAllTemplates(): WorkoutTemplate[] {
  return CANONICAL_ORDER.map(getTemplate);
}

// =============================================================================
// buildDescription
// Returns a human-readable, Intervals.icu-compatible plain text description.
// =============================================================================

export function buildDescription(template: WorkoutTemplate, ftp: number): string {
  const lines: string[] = [];

  // Effort / target line
  if (template.ftpPctRange === null) {
    lines.push("Effort: maximal sprint — not FTP-relative");
  } else if (template.ftpPctRange[0] === 0) {
    const maxPct = template.ftpPctRange[1];
    const maxW = Math.round(ftp * maxPct / 100);
    lines.push(`Effort: up to ${maxPct}% FTP (up to ${maxW}W)`);
  } else {
    const [lo, hi] = template.ftpPctRange;
    const loW = Math.round(ftp * lo / 100);
    const hiW = Math.round(ftp * hi / 100);
    lines.push(`Target: ${lo}–${hi}% FTP (${loW}W–${hiW}W)`);
  }

  lines.push(`Session type: ${template.purpose}`);
  lines.push(`Volume class: ${template.sessionVolumeClass}`);
  lines.push(`RPE: ${template.rpeRange[0]}–${template.rpeRange[1]}/10`);

  if (template.cadenceRequired && template.cadenceRpm) {
    lines.push(`Cadence: ${template.cadenceRpm[0]}–${template.cadenceRpm[1]} RPM`);
  }

  if (template.typicalFormats.length > 0) {
    lines.push(`Format: ${template.typicalFormats[0]}`);
  }

  for (const note of template.coachNotes) {
    lines.push(`→ ${note}`);
  }

  return lines.join("\n");
}
