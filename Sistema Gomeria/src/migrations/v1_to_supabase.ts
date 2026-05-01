// @ts-nocheck — script one-shot ya ejecutado el 2026-04-29.
// Se preserva como referencia histórica; los tipos legacy (AppDataV1)
// se desviaron del modelo actual. Si alguna vez se necesita re-migrar,
// refactor completo contra el nuevo schema.
// ═══════════════════════════════════════════════════
// v1_to_supabase.ts
// Migrador one-shot: localStorage v1 (Tire/Sale/Client/Invoice/Order)
// → Supabase v2 (Tire+Override / Receipt / Customer / SupplierInvoice / CustomerOrder)
// ═══════════════════════════════════════════════════

import { supabase } from '@/services/supabaseClient';
import { categoryService } from '@/services/categoryService';
import { storeService } from '@/services/storeService';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { ensureNoError } from '@/services/supabaseHelpers';
import type {
  Tire as TireV1,
  Client as ClientV1,
  Sale as SaleV1,
  Invoice as InvoiceV1,
  Order as OrderV1,
  AppDataV1,
} from '@/types';

const MIGRATION_FLAG = 'balina_migrated_to_supabase_at';
const SYSTEM_EMPLOYEE_PIN_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000'; // dummy, no login

export interface MigrationReport {
  startedAt: string;
  finishedAt?: string;
  defaultStoreId?: string;
  systemEmployeeId?: string;
  categoriesCreated: number;
  tiresMigrated: number;
  overridesCreated: number;
  customersMigrated: number;
  receiptsMigrated: number;
  supplierInvoicesMigrated: number;
  customerOrdersMigrated: number;
  errors: string[];
}

interface MigrationOptions {
  /** Si true, no escribe en Supabase. Solo valida y reporta. */
  dryRun?: boolean;
  /** Nombre de la tienda default a crear si no existe ninguna. */
  defaultStoreName?: string;
  /** Si se provee, no leer de localStorage; usar este dump JSON. */
  inputData?: AppDataV1;
}

// ═══════════════════════════════════════════════════
// Lectura de v1 desde localStorage
// ═══════════════════════════════════════════════════

const KEYS = {
  tires: 'balina_tires',
  clients: 'balina_clients',
  sales: 'balina_sales',
  invoices: 'balina_invoices',
  orders: 'balina_orders',
  orderConfig: 'balina_order_config',
  wholesaleConfig: 'balina_wholesale_config',
  employeeHash: 'balina_employee_hash',
  lastBackup: 'balina_last_backup',
};

function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readLocalV1(): AppDataV1 {
  return {
    tires: readKey<AppDataV1['tires']>(KEYS.tires, []),
    clients: readKey<ClientV1[]>(KEYS.clients, []),
    sales: readKey<SaleV1[]>(KEYS.sales, []),
    invoices: readKey<InvoiceV1[]>(KEYS.invoices, []),
    orders: readKey<OrderV1[]>(KEYS.orders, []),
    orderConfig: readKey(KEYS.orderConfig, {
      enabled: true,
      workDays: [true, true, true, true, true, true, false],
      blockedDates: [],
      minDaysAhead: 1,
      maxDaysAhead: 30,
      timeSlots: ['Mañana 09:00-12:00', 'Tarde 14:00-18:00', 'A coordinar'],
      maxOrdersPerDay: 10,
    }),
    wholesaleConfig: readKey(KEYS.wholesaleConfig, {
      globalDiscount: 10,
      minUnitsPerItem: 4,
      minOrderAmount: 0,
    }),
    employeeHash: readKey<string>(KEYS.employeeHash, ''),
    lastBackup: readKey<string | null>(KEYS.lastBackup, null),
  };
}

// ═══════════════════════════════════════════════════
// Migración principal
// ═══════════════════════════════════════════════════

export async function migrateLocalToSupabase(
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const report: MigrationReport = {
    startedAt: new Date().toISOString(),
    categoriesCreated: 0,
    tiresMigrated: 0,
    overridesCreated: 0,
    customersMigrated: 0,
    receiptsMigrated: 0,
    supplierInvoicesMigrated: 0,
    customerOrdersMigrated: 0,
    errors: [],
  };

  // 0. ¿Ya migrado?
  if (!options.dryRun) {
    const already = localStorage.getItem(MIGRATION_FLAG);
    if (already) {
      report.errors.push(`Migración ya completada en ${already}. Borrá la flag para re-correr.`);
      report.finishedAt = new Date().toISOString();
      return report;
    }
  }

  const v1 = options.inputData ?? readLocalV1();

  // 1. Tienda default
  let defaultStoreId: string;
  try {
    const stores = await storeService.getAll();
    let defaultStore = stores[0];
    if (!defaultStore) {
      if (options.dryRun) {
        defaultStoreId = '<dry-run-default-store>';
      } else {
        defaultStore = await storeService.save({
          name: options.defaultStoreName ?? 'Baliña Ruedas — Principal',
          posDeviceName: 'TPV 1',
          active: true,
        } as never);
        defaultStoreId = defaultStore.id;
      }
    } else {
      defaultStoreId = defaultStore.id;
    }
    report.defaultStoreId = defaultStoreId;
  } catch (e) {
    report.errors.push(`No se pudo crear/leer tienda default: ${(e as Error).message}`);
    return finalize(report);
  }

  // 2. Mapeo de categorías legacy → id v2
  const catMap = new Map<string, string>();
  const allCats = await categoryService.getAll();
  for (const c of allCats) catMap.set(c.name, c.id);

  // Categorías legacy que pueden no estar seedeadas
  const legacyCats = Array.from(new Set(v1.tires.map(t => t.category).filter(Boolean)));
  for (const name of legacyCats) {
    if (!catMap.has(name)) {
      if (options.dryRun) {
        catMap.set(name, `<dry:${name}>`);
        report.categoriesCreated += 1;
      } else {
        const c = await categoryService.save({ name, color: '#6b7280', sortOrder: 999 } as never);
        catMap.set(name, c.id);
        report.categoriesCreated += 1;
      }
    }
  }

  // 3. Empleado sistema (para ancla de receipts históricos y movimientos)
  let systemEmployeeId: string;
  try {
    if (options.dryRun) {
      systemEmployeeId = '<dry-run-system-employee>';
    } else {
      const role = await getOrCreateRole('Propietario');
      const existing = await getEmployeeByEmail('system@octabalina.local');
      if (existing) {
        systemEmployeeId = existing.id;
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert({
            name: 'Sistema (migración)',
            email: 'system@octabalina.local',
            role_id: role.id,
            store_ids: null, // todas las tiendas
            pin_hash: SYSTEM_EMPLOYEE_PIN_HASH,
            active: false,
          })
          .select()
          .single();
        if (error) throw error;
        systemEmployeeId = data.id;
      }
    }
    report.systemEmployeeId = systemEmployeeId;
  } catch (e) {
    report.errors.push(`No se pudo crear empleado sistema: ${(e as Error).message}`);
    return finalize(report);
  }

  // 4. Tires + overrides
  const tireIdMap = new Map<string, string>(); // legacyId → newId
  for (const t of v1.tires) {
    try {
      const categoryId = catMap.get(t.category);
      if (!categoryId) {
        report.errors.push(`Tire ${t.id}: categoría "${t.category}" no resuelta`);
        continue;
      }

      let newTireId: string;
      if (options.dryRun) {
        newTireId = `<dry:tire:${t.id}>`;
      } else {
        const tireRow = await tireServiceV2.save({
          brand: t.brand,
          model: t.model,
          size: t.size,
          categoryId,
          cost: t.costPrice,
          defaultPrice: t.salePrice,
          sku: t.id, // preservamos el id viejo como SKU
          notes: t.notes ?? undefined,
          taxIds: [],
          modifierGroupIds: [],
          availableInAllStores: true,
        } as never);
        newTireId = tireRow.id;
      }
      tireIdMap.set(t.id, newTireId);
      report.tiresMigrated += 1;

      if (!options.dryRun) {
        await tireServiceV2.upsertOverride({
          tireId: newTireId,
          storeId: defaultStoreId,
          available: true,
          price: t.salePrice,
          stock: t.stock,
          lowStockThreshold: t.minStock,
          location: t.location || undefined,
        });
      }
      report.overridesCreated += 1;
    } catch (e) {
      report.errors.push(`Tire ${t.id} (${t.brand} ${t.model}): ${(e as Error).message}`);
    }
  }

  // 5. Customers
  const customerIdMap = new Map<string, string>();
  for (const c of v1.clients) {
    try {
      let newId: string;
      if (options.dryRun) {
        newId = `<dry:cust:${c.id}>`;
      } else {
        const customer = await customerServiceV2.save({
          name: c.name,
          email: c.email || undefined,
          phone: c.phone || undefined,
          customerType: c.tipoCliente === 'mayorista' ? 'wholesale' : 'retail',
          wholesaleDiscount: c.descuentoMayorista || undefined,
          creditLimit: c.cupoCredito ?? 0,
          accountBalance: c.balance ?? 0,
          pinHash: c.pinHash || undefined,
          totalVisits: 0,
          totalSpent: 0,
          pointsBalance: 0,
        } as never);
        newId = customer.id;

        // Migrar payments → customer_account_movements
        for (const p of c.payments ?? []) {
          await customerServiceV2.addMovement({
            customerId: newId,
            type: 'payment',
            amount: p.amount,
            notes: p.notes || undefined,
            at: p.date,
            employeeId: systemEmployeeId,
          });
        }
      }
      customerIdMap.set(c.id, newId);
      report.customersMigrated += 1;
    } catch (e) {
      report.errors.push(`Cliente ${c.id} (${c.name}): ${(e as Error).message}`);
    }
  }

  // 6. Sales históricas → cash_session sintética + receipts + receipt_lines
  if (v1.sales.length > 0 && !options.dryRun) {
    try {
      const firstDate = v1.sales[0]?.date ?? new Date().toISOString();
      const { data: histSession, error: sessErr } = await supabase
        .from('cash_sessions')
        .insert({
          store_id: defaultStoreId,
          opened_at: firstDate,
          closed_at: new Date().toISOString(),
          opened_by_employee_id: systemEmployeeId,
          opening_float: 0,
          expected_cash: 0,
          counted_cash: 0,
          variance: 0,
          notes: 'Sesión sintética (migración v1)',
          status: 'closed',
        })
        .select()
        .single();
      if (sessErr) throw sessErr;
      const histSessionId = histSession.id;

      const cashPm = await getOrCreateCashPaymentMethod();

      let seq = 1;
      for (const s of v1.sales) {
        try {
          const linesPayload = s.items.map(item => {
            const newTireId = tireIdMap.get(item.tireId);
            if (!newTireId) throw new Error(`Tire legacy ${item.tireId} no migrado`);
            const subtotal = item.unitPrice * item.quantity;
            return {
              tire_id: newTireId,
              tire_brand: item.brand,
              tire_model: item.model,
              tire_size: item.size,
              category_id: '00000000-0000-0000-0000-000000000000', // unknown legacy
              category_name: 'Histórico',
              modifiers: [],
              unit_price: item.unitPrice,
              unit_cost: 0,
              quantity: item.quantity,
              line_discounts: [],
              line_taxes: [],
              gross: subtotal,
              net: subtotal,
              total: subtotal,
            };
          });

          const subtotalGross = s.items.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
          const total = s.total;

          const receiptPayload = {
            receipt_number: `HIST-${String(seq).padStart(4, '0')}`,
            store_id: defaultStoreId,
            cash_session_id: histSessionId,
            employee_id: systemEmployeeId,
            customer_id: s.clientId ? customerIdMap.get(s.clientId) ?? null : null,
            type: 'sale',
            status: 'completed',
            applied_discounts: [],
            applied_taxes: [],
            payments: [{ payment_method_id: cashPm, amount: total }],
            subtotal_gross: subtotalGross,
            total_discounts: 0,
            subtotal_net: subtotalGross,
            total_taxes: 0,
            total_cogs: 0,
            total,
            points_earned: 0,
            points_redeemed: 0,
            notes: `Migrado de v1 (${s.paymentMethod})`,
          };

          const { error } = await supabase.rpc('create_receipt_with_lines', {
            p_receipt: receiptPayload as unknown as never,
            p_lines: linesPayload as unknown as never,
          });
          if (error) throw error;
          seq += 1;
          report.receiptsMigrated += 1;
        } catch (e) {
          report.errors.push(`Sale ${s.id}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      report.errors.push(`Sesión histórica: ${(e as Error).message}`);
    }
  }

  // 7. Supplier invoices (preservados)
  for (const inv of v1.invoices) {
    if (options.dryRun) {
      report.supplierInvoicesMigrated += 1;
      continue;
    }
    try {
      const { error } = await supabase.from('supplier_invoices').insert({
        type: inv.type,
        number: inv.number,
        supplier: inv.supplier,
        date: inv.date,
        due_date: inv.dueDate || null,
        items: inv.items,
        subtotal: inv.subtotal,
        iva: inv.iva,
        total: inv.total,
        paid: inv.paid,
        notes: inv.notes || null,
        store_id: defaultStoreId,
      });
      if (error) throw error;
      report.supplierInvoicesMigrated += 1;
    } catch (e) {
      report.errors.push(`Invoice ${inv.id}: ${(e as Error).message}`);
    }
  }

  // 8. Customer orders (preservados)
  for (const o of v1.orders) {
    if (options.dryRun) {
      report.customerOrdersMigrated += 1;
      continue;
    }
    try {
      const newCustomerId = customerIdMap.get(o.clientId) ?? null;
      const { error } = await supabase.from('customer_orders').insert({
        numero: o.numero,
        customer_id: newCustomerId,
        customer_name: o.clientName,
        store_id: defaultStoreId,
        items: o.items.map(it => ({
          ...it,
          tireId: tireIdMap.get(it.tireId) ?? it.tireId,
        })),
        status: o.status,
        tipo: o.tipo,
        scheduled_date: o.scheduledDate || null,
        scheduled_time: o.scheduledTime ?? null,
        address: o.address ?? null,
        notes: o.notes ?? null,
        internal_notes: o.internalNotes ?? null,
        client_message: o.clientMessage ?? null,
        total_amount: o.totalAmount,
      });
      if (error) throw error;
      report.customerOrdersMigrated += 1;
    } catch (e) {
      report.errors.push(`Order ${o.id}: ${(e as Error).message}`);
    }
  }

  // 9. Configs singleton (wholesale, order, app_metadata)
  if (!options.dryRun) {
    await supabase.from('wholesale_config').upsert({
      singleton: true,
      global_discount: v1.wholesaleConfig.globalDiscount,
      min_units_per_item: v1.wholesaleConfig.minUnitsPerItem,
      min_order_amount: v1.wholesaleConfig.minOrderAmount,
    });
    await supabase.from('order_config').upsert({
      singleton: true,
      enabled: v1.orderConfig.enabled,
      work_days: v1.orderConfig.workDays,
      blocked_dates: v1.orderConfig.blockedDates,
      min_days_ahead: v1.orderConfig.minDaysAhead,
      max_days_ahead: v1.orderConfig.maxDaysAhead,
      time_slots: v1.orderConfig.timeSlots,
      max_orders_per_day: v1.orderConfig.maxOrdersPerDay,
    });
    await supabase.from('app_metadata').upsert({
      singleton: true,
      schema_version: 1,
      migrated_from_local_at: new Date().toISOString(),
      last_local_backup_at: v1.lastBackup,
    });
  }

  // 10. Marcar migración completa
  if (!options.dryRun && report.errors.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  }

  return finalize(report);
}

function finalize(report: MigrationReport): MigrationReport {
  report.finishedAt = new Date().toISOString();
  return report;
}

// ── Helpers internos ──────────────────────────────────

async function getOrCreateRole(name: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: err2 } = await supabase
    .from('roles')
    .insert({ name, permissions: [], is_system: false })
    .select()
    .single();
  if (err2) throw err2;
  return created;
}

async function getEmployeeByEmail(email: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrCreateCashPaymentMethod(): Promise<string> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('type', 'cash')
    .order('sort_order')
    .limit(1);
  ensureNoError(data, error, 'getOrCreateCashPaymentMethod');
  if (data && data.length > 0) return data[0].id;
  const { data: created, error: err2 } = await supabase
    .from('payment_methods')
    .insert({ type: 'cash', name: 'Efectivo', surcharge_percent: 0, sort_order: 10 })
    .select()
    .single();
  if (err2) throw err2;
  return created.id;
}

// ═══════════════════════════════════════════════════
// API pública para uso desde la UI
// ═══════════════════════════════════════════════════

export async function isMigrated(): Promise<boolean> {
  return Boolean(localStorage.getItem(MIGRATION_FLAG));
}

export function migrationFlagDate(): string | null {
  return localStorage.getItem(MIGRATION_FLAG);
}

export function clearMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG);
}

/**
 * Importa un backup JSON (formato del export actual) y lo migra.
 * Útil cuando localStorage ya se borró pero conservás el .json.
 */
export async function migrateFromJsonBackup(
  json: string,
  options: Omit<MigrationOptions, 'inputData'> = {},
): Promise<MigrationReport> {
  let parsed: AppDataV1;
  try {
    parsed = JSON.parse(json) as AppDataV1;
  } catch {
    throw new Error('JSON inválido');
  }
  return migrateLocalToSupabase({ ...options, inputData: parsed });
}
