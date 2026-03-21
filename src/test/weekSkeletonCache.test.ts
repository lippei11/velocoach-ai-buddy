/**
 * weekSkeletonCache.test.ts
 *
 * Unit tests for the input fingerprint logic used by generate-week-skeleton
 * to decide whether to return a cached WeekSkeleton or re-run the LLM.
 *
 * The fingerprint is a 16-char hex prefix of SHA-256 over the four inputs
 * that determine whether a cached skeleton is still valid:
 *   - userId               (per-user isolation)
 *   - weekStartDate        (which week)
 *   - athleteStateComputedAt (invalidates when compute-athlete-context reruns)
 *   - planningModel        (model changes can affect slot allocation)
 *
 * Invariants:
 *   1. Same inputs → same fingerprint (stable/deterministic)
 *   2. Different weekStartDate → different fingerprint
 *   3. Different athleteStateComputedAt → different fingerprint (primary staleness signal)
 *   4. Different planningModel → different fingerprint
 *   5. Different userId → different fingerprint
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the fingerprint logic so this test has no Deno runtime dependency.
// This is the exact same algorithm used in generate-week-skeleton/index.ts.
// ---------------------------------------------------------------------------

async function computeInputFingerprint(
  userId: string,
  weekStartDate: string,
  athleteStateComputedAt: string,
  planningModel: string
): Promise<string> {
  const raw = [userId, weekStartDate, athleteStateComputedAt, planningModel].join(":");
  const data = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = "user-aaaa-1111";
const USER_B = "user-bbbb-2222";
const WEEK_1 = "2026-03-16";
const WEEK_2 = "2026-03-23";
const COMPUTED_AT_V1 = "2026-03-21T08:00:00.000Z";
const COMPUTED_AT_V2 = "2026-03-21T09:30:00.000Z";
const MODEL_SONNET = "claude-sonnet-4-5-20251022";
const MODEL_OPUS   = "claude-opus-4-6";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeInputFingerprint", () => {
  it("returns a 16-character hex string", async () => {
    const fp = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]+$/);
  });

  it("is stable — same inputs always produce the same fingerprint", async () => {
    const fp1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fp2 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    expect(fp1).toBe(fp2);
  });

  it("changes when weekStartDate changes (cache miss for different week)", async () => {
    const fp1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fp2 = await computeInputFingerprint(USER_A, WEEK_2, COMPUTED_AT_V1, MODEL_SONNET);
    expect(fp1).not.toBe(fp2);
  });

  it("changes when athleteStateComputedAt changes (primary staleness signal)", async () => {
    const fp1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fp2 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V2, MODEL_SONNET);
    expect(fp1).not.toBe(fp2);
  });

  it("changes when planningModel changes (model swap invalidates cache)", async () => {
    const fp1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fp2 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_OPUS);
    expect(fp1).not.toBe(fp2);
  });

  it("changes when userId changes (users are isolated)", async () => {
    const fp1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fp2 = await computeInputFingerprint(USER_B, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    expect(fp1).not.toBe(fp2);
  });

  it("first run is a cache miss; identical second run would be a cache hit", async () => {
    // Simulate: compute fingerprint for two consecutive identical requests.
    // Both fingerprints must match so the second request can hit the cache.
    const fpRequest1 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fpRequest2 = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    expect(fpRequest1).toBe(fpRequest2); // same fp → cache hit on second call
  });

  it("changed athleteStateComputedAt invalidates a previously cached skeleton", async () => {
    // Simulate: athlete reruns compute-athlete-context (computed_at advances).
    const fpBeforeRecompute = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V1, MODEL_SONNET);
    const fpAfterRecompute  = await computeInputFingerprint(USER_A, WEEK_1, COMPUTED_AT_V2, MODEL_SONNET);
    // Different fingerprints → the DB lookup will find no matching row → cache miss.
    expect(fpBeforeRecompute).not.toBe(fpAfterRecompute);
  });
});
