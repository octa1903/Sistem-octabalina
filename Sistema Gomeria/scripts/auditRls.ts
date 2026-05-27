// Audit lite de RLS sobre Supabase remoto:
// - Lista todas las tablas del schema public.
// - Para cada una, verifica si tiene RLS habilitado y si tiene policies.
// - Reporta tablas que NO tienen RLS o no tienen ninguna policy.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, 'import', '.env') });

const { admin } = await import('./import/lib/supabaseAdmin');

// Llamamos al schema pg_catalog via PostgREST exposed view; si no funciona
// (RLS), pedimos al usuario que lo corra en SQL editor a mano.
const sql = `
  select n.nspname as schema,
         c.relname as table,
         c.relrowsecurity as rls_enabled,
         (select count(*) from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname = 'public'
  order by c.relname;
`;
console.log('Pega esto en el SQL Editor de Supabase para auditar RLS:');
console.log('https://supabase.com/dashboard/project/aaplvlvewjeovitpyscg/sql\n');
console.log(sql);

// Intento via PostgREST por si rpc 'pg_query' existe (no por default)
try {
  const { data, error } = await admin.rpc('pg_query', { query: sql });
  if (!error && data) {
    console.log('\nResultado:');
    console.table(data);
  }
} catch {
  // ignorar
}
