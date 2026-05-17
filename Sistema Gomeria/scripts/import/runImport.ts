// Orquestador del import legacy Firebird → Supabase.
//
// Uso:
//   cd "Sistema Gomeria"
//   cp scripts/import/.env.example scripts/import/.env
//   # editar .env con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GDB_PATH, STORE_ID
//   npx tsx scripts/import/runImport.ts [--only=banks,suppliers,customers]
//
// IMPORTANTE: dotenv se carga al inicio absoluto del proceso (preload via
// --import dotenv/config no funciona con tsx en ESM). Carga sincrónica
// aquí garantiza que cuando se evalúen los imports de loaders, process.env
// ya tenga las variables.

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '.env') });

// Los imports de loaders/batch DEBEN ir después de cargar .env porque
// supabaseAdmin.ts lee process.env al evaluar el módulo.
const { createBatch, finishBatch } = await import('./lib/batch');
const { loadBanks } = await import('./loaders/banks');
const { loadSuppliers } = await import('./loaders/suppliers');
const { loadCustomers } = await import('./loaders/customers');
const { loadInsurance } = await import('./loaders/insurance');
const { loadSalespeople } = await import('./loaders/salespeople');
const { loadFiscalIdentity } = await import('./loaders/fiscalIdentity');
const { loadSupplierInvoices } = await import('./loaders/supplierInvoices');
const { loadReceiptsHeaders } = await import('./loaders/receiptsHeaders');
const { loadCashMovements } = await import('./loaders/cashMovements');
const { loadSupplierMovements } = await import('./loaders/supplierMovements');
const { loadCustomerMovements } = await import('./loaders/customerMovements');
const { loadChecks } = await import('./loaders/checks');
const { loadPayments } = await import('./loaders/payments');

const GDB = process.env.GDB_PATH;
const STORE_ID = process.env.STORE_ID;
if (!GDB) throw new Error('GDB_PATH no definido (ver .env.example)');
if (!STORE_ID) throw new Error('STORE_ID no definido (ver .env.example)');

interface LoaderCtx {
  gdbPath: string;
  storeId: string;
  batchId: string;
}

interface LoaderDef {
  name: string;
  run: (ctx: LoaderCtx) => Promise<{ inserted: number; skipped: number; errors: unknown[] }>;
}

const ALL_LOADERS: LoaderDef[] = [
  { name: 'banks', run: ({ gdbPath }) => loadBanks(gdbPath) },
  { name: 'suppliers', run: ({ gdbPath }) => loadSuppliers(gdbPath) },
  { name: 'customers', run: ({ gdbPath, storeId, batchId }) => loadCustomers(gdbPath, storeId, batchId) },
  { name: 'insurance', run: ({ gdbPath, storeId, batchId }) => loadInsurance(gdbPath, storeId, batchId) },
  { name: 'salespeople', run: ({ gdbPath, storeId }) => loadSalespeople(gdbPath, storeId) },
  { name: 'fiscalIdentity', run: ({ gdbPath, storeId }) => loadFiscalIdentity(gdbPath, storeId) },
  { name: 'supplierInvoices', run: ({ gdbPath, storeId }) => loadSupplierInvoices(gdbPath, storeId) },
  { name: 'receiptsHeaders', run: ({ gdbPath, storeId, batchId }) => loadReceiptsHeaders(gdbPath, storeId, batchId) },
  { name: 'cashMovements', run: ({ gdbPath, storeId, batchId }) => loadCashMovements(gdbPath, storeId, batchId) },
  { name: 'supplierMovements', run: ({ gdbPath, storeId, batchId }) => loadSupplierMovements(gdbPath, storeId, batchId) },
  { name: 'customerMovements', run: ({ gdbPath, storeId, batchId }) => loadCustomerMovements(gdbPath, storeId, batchId) },
  { name: 'checks', run: ({ gdbPath, storeId, batchId }) => loadChecks(gdbPath, storeId, batchId) },
  { name: 'payments', run: ({ gdbPath, storeId, batchId }) => loadPayments(gdbPath, storeId, batchId) },
];

async function main() {
  const argOnly = process.argv.find(a => a.startsWith('--only='));
  const onlySet = argOnly ? new Set(argOnly.slice('--only='.length).split(',')) : null;
  const loaders = onlySet ? ALL_LOADERS.filter(l => onlySet.has(l.name)) : ALL_LOADERS;

  if (loaders.length === 0) {
    console.error('No hay loaders para correr. Loaders disponibles:', ALL_LOADERS.map(l => l.name).join(', '));
    process.exit(1);
  }

  const batchId = await createBatch('firebird:DataBRPVta.gdb', `loaders: ${loaders.map(l => l.name).join(',')}`);
  console.log(`Import batch ${batchId} started.`);

  let total = 0, inserted = 0, skipped = 0;
  const allErrors: unknown[] = [];

  for (const loader of loaders) {
    const t0 = Date.now();
    try {
      console.log(`\n=== ${loader.name} ===`);
      const r = await loader.run({ gdbPath: GDB, storeId: STORE_ID, batchId });
      inserted += r.inserted;
      skipped += r.skipped;
      allErrors.push(...r.errors);
      console.log(`  → inserted ${r.inserted}, skipped ${r.skipped}, errors ${r.errors.length} (${Date.now() - t0}ms)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${loader.name}] FATAL: ${msg}`);
      allErrors.push({ loader: loader.name, fatal: msg });
    }
  }

  await finishBatch(batchId, allErrors.length === 0 ? 'completed' : 'failed', {
    total: inserted + skipped,
    inserted,
    skipped,
    errors: allErrors.slice(0, 100), // cap para evitar jsonb gigante
  });

  console.log(`\nImport batch ${batchId} done. Inserted: ${inserted}, skipped: ${skipped}, errors: ${allErrors.length}`);
  if (allErrors.length > 0) process.exit(2);
}

main().catch(e => {
  console.error('Fatal in main:', e);
  process.exit(1);
});
