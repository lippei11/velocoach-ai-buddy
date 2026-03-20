/**
 * planningCore.ts — re-export shim for the Node/Vite build.
 *
 * The implementation has moved to supabase/functions/_shared/planningCore.ts
 * so that Supabase edge functions can be deployed without bundling paths
 * outside the functions directory tree.
 *
 * This file re-exports everything from the deploy-safe source of truth.
 * No logic lives here.
 */
export * from '../../../supabase/functions/_shared/planningCore.ts';
