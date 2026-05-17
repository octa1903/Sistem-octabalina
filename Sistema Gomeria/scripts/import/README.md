# Import legacy Firebird → Supabase

Loaders TS que leen el `.gdb` (Firebird ODS 10) sin engine externo y escriben
a Supabase con `service_role`. Coordinado con migrations 0017–0025.

## Setup

```bash
cd "Sistema Gomeria"
npm i -D tsx dotenv  # si todavía no están

# Variables de entorno
cp scripts/import/.env.example scripts/import/.env
# editar .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GDB_PATH, STORE_ID
```

`SUPABASE_SERVICE_ROLE_KEY` está disponible vía `supabase projects api-keys --project-ref aaplvlvewjeovitpyscg`.

## Correr

```bash
# Todos los loaders en orden
npx tsx scripts/import/runImport.ts

# Solo un loader específico (útil durante desarrollo)
npx tsx scripts/import/runImport.ts --only=banks
```

## Loaders disponibles / planeados

| # | Loader | Fuente legacy | Filas | Estado |
|---|---|---|---:|---|
| 1 | banks | BANCOS | 15 | ✓ aplicado |
| 2 | suppliers | PROVEEDORES | 810 | ✓ aplicado (781) |
| 3 | salespeople | distinct VENDEDOR/DVENDEDOR de CLIENTES + DET_PAGOS | 24 | ✓ aplicado |
| 4 | customers | CLIENTES | 5219 | ✓ aplicado (5175) |
| 5 | insurance | ASEGURADOS (39 cías placeholders + pólizas) | 11838 | ✓ aplicado |
| 6 | fiscalIdentity | NROS singleton → stores.fiscal_identity | 1 | ✓ aplicado |
| 7 | cashMovements | ENTRADAS/SALIDAS/TRANSFERENCIAS + sesiones | 31718 | ✓ aplicado |
| 8 | receiptsHeaders | FACTURAS (cabeceras minimal) | 78482 | ✓ aplicado (53690) |
| 9 | supplierInvoices | REMITOS | 24553 | ✓ aplicado |
| 10 | supplierMovements | ESTPROV (DEBE/HABER → charge/payment) | 29114 | ✓ aplicado (15658) |
| 11 | customerMovements | ESTCLIE | 110079 | ✓ aplicado (23196, recompute pendiente vía mig 0028) |
| 12 | checks | CHEQUES | 3488 | ✓ aplicado (2905, sin FK a customers/suppliers — ver nota) |
| 13 | payments | PAGOS (enriquece movements con method_id) | 36209 | ✓ aplicado (12821 movements actualizados) |
| 14 | appointments | AGENDA (opcional) | 3213 | SKIP — no hay tabla destino; AGENDA es notas, módulo calendario no existe en POS |

**Excluidos del import** (decisión 2026-05-15): `tires` y `MARCAS` → cargados manualmente por CSV.

## Cómo agregar un loader nuevo

1. Crear `loaders/<nombre>.ts` exportando `loadXxx(gdbPath: string): Promise<{ inserted, skipped, errors }>`.
2. Usar `readTable(gdbPath, relationId)` de `lib/gdbReader.ts` para obtener buffers raw.
3. Mapear cada buffer a la forma `Insert` de Supabase usando los helpers
   (`readInt32LE`, `readChar`, `findAsciiRun`, etc.).
4. Llamar `bulkInsert('<table>', rows)` de `lib/batch.ts`.
5. Registrar en `runImport.ts` → `ALL_LOADERS`.

Relation IDs vienen de `gdb-analysis/full-schema/relations_decoded.json`.

## supplierMovements: inspección antes del primer run

Los offsets físicos de Firebird ODS-10 a veces difieren del orden de declaración
(verificado en CLIENTES y PROVEEDORES). Antes del primer `--only=supplierMovements`
correr el inspector:

```bash
npx tsx scripts/import/loaders/supplierMovements.ts inspect
```

Dumpea los primeros 5 rows en hex + la extracción tentativa. Si `extracted` da
`null` o valores claramente inválidos (amount=0, prov fuera de rango), hay que
ajustar offsets en `extractMov()`. El loader usa un escaneo de FECHA por
heurística (INT32 entre 47000-70000), pero si las fechas están guardadas en
otro formato hay que reemplazar la búsqueda.

## Migraciones requeridas por loaders

| Loader | Migration | Estado |
|---|---|---|
| customers/receipts/cam (campos) | 0023 | ✓ aplicada |
| fiscalIdentity | 0024 | ✓ aplicada |
| receipts.legacy_id idempotencia | 0025 | ✓ aplicada |
| cashMovements/cash_sessions | 0026 | ✓ aplicada |
| customer_account_movements.legacy_id | 0027 | ✓ aplicada |
| recompute customer balances + trigger | 0028 | ✓ aplicada |
| payment_method "Cheque" | 0029 | ✓ aplicada |

## Idempotencia

Cada loader inserta con `legacy_id` único (unique parcial en las tablas
target). Re-correr el import duplica el insert → falla con código `23505`
y queda registrado en `errors`. Para re-importar limpio: borrar primero
las filas con `import_batch_id = ?` o usar la columna del batch para
filtrar.

Para revertir un batch:
```sql
delete from customer_account_movements where import_batch_id = '<uuid>';
delete from receipts where import_batch_id = '<uuid>';
delete from customers where import_batch_id = '<uuid>';
-- etc. en orden inverso de FK
update import_batches set status = 'rolled_back' where id = '<uuid>';
```

## Strategy de campos numéricos

El formato físico de Firebird ODS 10 tiene quirks (alignment, RDB$FORMATS
versionado). Los offsets exactos se determinaron por reverse-engineering
desde samples conocidos. Para INTEGER pequeños (CODIGOS de PK) usamos
`readInt32LE` directo. Para CHAR/VARCHAR usamos `findAsciiRun` que es
robusto ante padding pero asume que los strings son ASCII imprimibles
(latin1 OK para AR).

DOUBLE/NUMERIC/TIMESTAMP del legacy se importan en string text cuando es
posible y se reparsean en TS. Si la columna destino es numeric, se
intenta `Number(x)` y se valida.

## Bypass de triggers durante import

Los triggers de credit_limit (0019) y stock (0018) deben bypassearse para
no rechazar movimientos legacy históricos. En cada loader que inserte
charges:

```typescript
await admin.rpc('exec_sql', { sql: 'SET LOCAL session_replication_role = replica' });
// ... insert ...
```

(Requiere un RPC `exec_sql` con security definer; alternativa: importar
solo `payment` rows y reconstruir charges con `customer_account_balance`
recompute al final.)
