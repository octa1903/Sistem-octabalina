// Cliente Supabase con service_role para bypass RLS durante el import.
// El service_role NUNCA debe exponerse al frontend ni commitearse.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error('SUPABASE_URL no definida (ver scripts/import/.env.example)');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no definida');

export const admin: SupabaseClient<Database> = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
