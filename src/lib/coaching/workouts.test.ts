import { describe, it, expect } from 'vitest';
import { getTemplate, getAllTemplates, buildDescription } from './workouts';
import type { SessionPurpose, SessionStressType } from './velocoach-interfaces';

describe('getAllTemplates', () => {
  it('returns exactly 9 templates in canonical order', () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(9);
    const expectedOrder: SessionPurpose[] = [
      'recovery', 'endurance', 'long_ride', 'sweet_spot', 'threshold',
      'vo2max', 'climb_simulation', 'back_to_back', 'sprint',
    ];
    expect(templates.map(t => t.purpose)).toEqual(expectedOrder);
  });
});

describe('getTemplate stressType mapping', () => {
  it('returns the correct stressType for all 9 template purposes', () => {
    const expected: Record<SessionPurpose, SessionStressType> = {
      recovery:         'recovery',
      endurance:        'endurance_base',
      long_ride:        'durability',
      sweet_spot:       'threshold',
      threshold:        'threshold',
      back_to_back:     'durability',
      climb_simulation: 'threshold',
      vo2max:           'vo2max',
      sprint:           'neuromuscular',
      strength:         'strength', // not in workout_types — excluded below
    };

    const purposesWithTemplates: SessionPurpose[] = [
      'recovery', 'endurance', 'long_ride', 'sweet_spot', 'threshold',
      'vo2max', 'climb_simulation', 'back_to_back', 'sprint',
    ];

    for (const purpose of purposesWithTemplates) {
      expect(getTemplate(purpose).stressType).toBe(expected[purpose]);
    }
  });
});

describe('buildDescription', () => {
  it('returns a non-empty string for all 9 templates at ftp=250', () => {
    for (const template of getAllTemplates()) {
      const desc = buildDescription(template, 250);
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

describe('cadenceRequired', () => {
  it('is true for vo2max, climb_simulation, sprint', () => {
    expect(getTemplate('vo2max').cadenceRequired).toBe(true);
    expect(getTemplate('climb_simulation').cadenceRequired).toBe(true);
    expect(getTemplate('sprint').cadenceRequired).toBe(true);
  });

  it('is false for recovery, endurance, long_ride, sweet_spot, threshold, back_to_back', () => {
    const purposes: SessionPurpose[] = ['recovery', 'endurance', 'long_ride', 'sweet_spot', 'threshold', 'back_to_back'];
    for (const p of purposes) {
      expect(getTemplate(p).cadenceRequired).toBe(false);
    }
  });
});

describe('sprint template', () => {
  it('has ftpPctRange === null', () => {
    expect(getTemplate('sprint').ftpPctRange).toBeNull();
  });

  it('has profileRestriction === "punchy_stochastic"', () => {
    expect(getTemplate('sprint').profileRestriction).toBe('punchy_stochastic');
  });
});

describe('back_to_back template', () => {
  it('has a non-empty contextualNote', () => {
    const note = getTemplate('back_to_back').contextualNote;
    expect(note).toBeTruthy();
    expect(note!.length).toBeGreaterThan(0);
  });
});

describe('buildDescription content', () => {
  it('contains "maximal sprint" for sprint at ftp=250', () => {
    const desc = buildDescription(getTemplate('sprint'), 250);
    expect(desc).toContain('maximal sprint');
  });

  it('contains "up to 55%" for recovery at ftp=250', () => {
    const desc = buildDescription(getTemplate('recovery'), 250);
    expect(desc).toContain('up to 55%');
  });
});

describe('inAppDefinition', () => {
  it('is non-empty for all templates', () => {
    for (const template of getAllTemplates()) {
      expect(template.inAppDefinition.length).toBeGreaterThan(0);
    }
  });
});
