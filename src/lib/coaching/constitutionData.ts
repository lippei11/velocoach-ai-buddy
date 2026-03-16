// Re-export helper — keeps frontend code decoupled from supabase/ path
import constitution from '../../../supabase/functions/_shared/constitution.json';
export default constitution;
export type ConstitutionData = typeof constitution;
