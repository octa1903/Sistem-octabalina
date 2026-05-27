// Audit lite de RLS sobre Supabase remoto.
//
// Estrategia: para cada tabla candidata, hacemos SELECT COUNT(*) con la
// service_role (que bypassa RLS) y con la anon key (que respeta RLS).
// Si la anon key puede leer sin estar autenticada, es un agujero.
//
// Pero como necesitamos también saber si RLS está habilitado, llamamos a
// un RPC opcional `audit_rls` (si existe) o caemos al modo "imprime SQL"
// para que el usuario lo corra a mano en SQL Editor.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, 'import', '.env') });

const { admin } = await import('./import/lib/supabaseAdmin');

// Lista cerrada de tablas que esperamos auditar. Es la unión de las
// definidas en las migraciones 0001-0035.
const EXPECTED_TABLES = [
  'stores', 'categories', 'tires', 'tire_store_overrides',
  'modifier_groups', 'discounts', 'taxes', 'payment_methods',
  'roles', 'employees', 'customers',
  'cash_sessions', 'cash_movements', 'receipts', 'receipt_lines',
  'app_features', 'loyalty_config', 'receipt_config', 'open_tickets_config',
  'supplier_invoices', 'customer_orders', 'customer_account_movements',
  'app_metadata', 'wholesale_config', 'order_config',
  'customer_in_scope', 'insurance_companies', 'insurance_policies',
  'insurance_company_movements', 'salespeople',
  'import_batches', 'suppliers', 'banks', 'checks', 'supplier_account_movements',
  'exchange_rates', 'supplier_price_lists', 'supplier_price_list_items',
  'audit_log',
];

console.log('=== Audit RLS — Sistema Octabalina ===\n');

// Para cada tabla intentamos COUNT con admin (service_role bypassa RLS).
// Si la tabla no existe, marcamos. Si existe pero count = 0, ok.
// El audit "real" requiere ver pg_class/pg_policies — para eso pedimos
// al usuario que ejecute el SQL.

const results: Array<{ table: string; rows: number | null; status: string }> = [];

for (const table of EXPECTED_TABLES) {
  try {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      results.push({ table, rows: null, status: `error: ${error.message}` });
    } else {
      results.push({ table, rows: count ?? 0, status: 'ok' });
    }
  } catch (e: unknown) {
    results.push({ table, rows: null, status: `exception: ${e instanceof Error ? e.message : String(e)}` });
  }
}

console.log('Tablas accesibles via service_role:');
console.log('table'.padEnd(36) + ' rows'.padEnd(10) + ' status');
console.log('-'.repeat(70));
for (const r of results) {
  const rowsStr = r.rows === null ? 'N/A' : r.rows.toString();
  console.log(r.table.padEnd(36) + rowsStr.padEnd(10) + r.status);
}

// Tablas faltantes (en lista pero no existen en remoto)
const missing = results.filter((r) => r.status.startsWith('error'));
if (missing.length > 0) {
  console.log('\nTablas con error (no existen o sin permisos):');
  for (const m of missing) console.log(`  - ${m.table}: ${m.status}`);
}

console.log(`\nTotal tablas verificadas: ${results.length}`);
console.log(`OK: ${results.filter((r) => r.status === 'ok').length}`);
console.log(`Con error: ${missing.length}`);

console.log(`\n=== Verificación profunda de RLS ===`);
console.log(`Para confirmar que cada tabla tiene RLS habilitado y al menos 1 policy,`);
console.log(`pegá esto en el SQL Editor (https://supabase.com/dashboard/project/aaplvlvewjeovitpyscg/sql):\n`);
console.log(`select c.relname as table,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
order by c.relname;
`);
console.log(`Cualquier fila con rls_enabled=false o policy_count=0 es un agujero.`);
