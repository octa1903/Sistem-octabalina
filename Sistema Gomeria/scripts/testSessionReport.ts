// Smoke test del RPC build_session_report (migration 0035).
// Busca una sesión que TENGA receipts asociados para verificar el cálculo
// real de totales/pagos.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, 'import', '.env') });

const { admin } = await import('./import/lib/supabaseAdmin');

// Buscar una cash_session_id que aparezca en receipts (tiene ventas reales).
const { data: receiptSessions } = await admin
  .from('receipts')
  .select('cash_session_id')
  .eq('status', 'completed')
  .limit(20);

const candidateIds = Array.from(
  new Set((receiptSessions ?? []).map((r) => (r as { cash_session_id: string }).cash_session_id)),
);

if (candidateIds.length === 0) {
  console.error('No hay receipts completed con cash_session_id.');
  process.exit(1);
}

console.log(`=== Test RPC build_session_report ===\n`);
console.log(`Probando con ${candidateIds.length} sesiones que tienen receipts.\n`);

let okCount = 0;
let errCount = 0;
let withDataCount = 0;

for (const sessionId of candidateIds) {
  const { data, error } = await admin.rpc('build_session_report', { p_session_id: sessionId });
  if (error) {
    console.error(`  ✗ ${sessionId}: ${error.message}`);
    errCount++;
    continue;
  }
  okCount++;
  const report = data as {
    session: { status: string };
    totals: { total: number };
    counts: { sale_count: number };
    payments: unknown[];
    report_kind: 'X' | 'Z';
  };
  if (report.counts.sale_count > 0) {
    withDataCount++;
    if (withDataCount <= 3) {
      console.log(
        `  ✓ ${sessionId.slice(0, 8)} [${report.report_kind}]: ${report.counts.sale_count} ventas, total ${report.totals.total}, ${report.payments.length} métodos`,
      );
    }
  }
}

console.log(`\nResultado:`);
console.log(`  ✓ OK: ${okCount}`);
console.log(`  ✗ Error: ${errCount}`);
console.log(`  Con datos: ${withDataCount}`);
