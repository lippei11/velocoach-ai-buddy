// @ts-nocheck — Deno edge function shim; types resolved at Deno runtime
/**
 * Thin Deno re-export shim for planningCore.
 *
 * All logic lives in src/lib/coaching/planningCore.ts (Node/app code).
 * This shim makes it importable from Deno edge functions.
 * date-fns resolves via supabase/functions/import_map.json → npm:date-fns
 */
export * from '../../../../src/lib/coaching/planningCore.ts';
