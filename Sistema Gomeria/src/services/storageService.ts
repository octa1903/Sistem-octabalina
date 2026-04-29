// ═══════════════════════════════════════════════════
// Baliña Ruedas — Servicio de persistencia
// ═══════════════════════════════════════════════════

import type {
  Tire,
  Client,
  Sale,
  Invoice,
  Order,
  OrderConfig,
  WholesaleConfig,
} from '@/types';
import { storageGet, storageSet, exportAllData, importAllData } from '@/utils/storage';
import { DEFAULT_ORDER_CONFIG, DEFAULT_WHOLESALE_CONFIG, EMPLOYEE_HASH_DEFAULT } from '@/constants';
import initialData from '@/data/initialData.json';

// ─── Keys ───────────────────────────────────────────
const KEYS = {
  tires: 'tires',
  clients: 'clients',
  sales: 'sales',
  invoices: 'invoices',
  orders: 'orders',
  orderConfig: 'orderConfig',
  wholesaleConfig: 'wholesaleConfig',
  employeeHash: 'employeeHash',
  lastBackup: 'lastBackup',
} as const;

// ─── Generic CRUD ───────────────────────────────────
function getAll<T>(key: string, fallback: T[]): T[] {
  return storageGet<T[]>(key, fallback);
}

function getOne<T extends { id: string }>(key: string, id: string, fallback: T[]): T | undefined {
  return getAll<T>(key, fallback).find((item) => item.id === id);
}

function save<T extends { id: string }>(key: string, item: T, fallback: T[]): T {
  const items = getAll<T>(key, fallback);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  storageSet(key, items);
  return item;
}

function remove<T extends { id: string }>(key: string, id: string, fallback: T[]): void {
  const items = getAll<T>(key, fallback).filter((i) => i.id !== id);
  storageSet(key, items);
}

// ─── Tires ──────────────────────────────────────────
export const tireService = {
  getAll: () => getAll<Tire>(KEYS.tires, []),
  getById: (id: string) => getOne<Tire>(KEYS.tires, id, []),
  save: (tire: Tire) => save<Tire>(KEYS.tires, tire, []),
  delete: (id: string) => remove<Tire>(KEYS.tires, id, []),
  getLowStock: () => getAll<Tire>(KEYS.tires, []).filter((t) => t.stock <= t.minStock),
};

// ─── Clients ────────────────────────────────────────
export const clientService = {
  getAll: () => getAll<Client>(KEYS.clients, []),
  getById: (id: string) => getOne<Client>(KEYS.clients, id, []),
  save: (client: Client) => save<Client>(KEYS.clients, client, []),
  delete: (id: string) => remove<Client>(KEYS.clients, id, []),
  getWholesale: () => getAll<Client>(KEYS.clients, []).filter((c) => c.tipoCliente === 'mayorista'),
};

// ─── Sales ──────────────────────────────────────────
export const saleService = {
  getAll: () => getAll<Sale>(KEYS.sales, []),
  getById: (id: string) => getOne<Sale>(KEYS.sales, id, []),
  save: (sale: Sale) => save<Sale>(KEYS.sales, sale, []),
  delete: (id: string) => remove<Sale>(KEYS.sales, id, []),
  getByClient: (clientId: string) =>
    getAll<Sale>(KEYS.sales, []).filter((s) => s.clientId === clientId),
  getByDateRange: (from: string, to: string) =>
    getAll<Sale>(KEYS.sales, []).filter((s) => s.date >= from && s.date <= to),
};

// ─── Invoices ───────────────────────────────────────
export const invoiceService = {
  getAll: () => getAll<Invoice>(KEYS.invoices, []),
  getById: (id: string) => getOne<Invoice>(KEYS.invoices, id, []),
  save: (invoice: Invoice) => save<Invoice>(KEYS.invoices, invoice, []),
  delete: (id: string) => remove<Invoice>(KEYS.invoices, id, []),
  getUnpaid: () => getAll<Invoice>(KEYS.invoices, []).filter((inv) => !inv.paid),
};

// ─── Orders ─────────────────────────────────────────
export const orderService = {
  getAll: () => getAll<Order>(KEYS.orders, []),
  getById: (id: string) => getOne<Order>(KEYS.orders, id, []),
  save: (order: Order) => save<Order>(KEYS.orders, order, []),
  delete: (id: string) => remove<Order>(KEYS.orders, id, []),
  getByClient: (clientId: string) =>
    getAll<Order>(KEYS.orders, []).filter((o) => o.clientId === clientId),
  getByStatus: (status: string) =>
    getAll<Order>(KEYS.orders, []).filter((o) => o.status === status),
  getByDate: (date: string) =>
    getAll<Order>(KEYS.orders, []).filter((o) => o.scheduledDate === date),
};

// ─── Config ─────────────────────────────────────────
export const configService = {
  getOrderConfig: () => storageGet<OrderConfig>(KEYS.orderConfig, DEFAULT_ORDER_CONFIG),
  saveOrderConfig: (config: OrderConfig) => storageSet(KEYS.orderConfig, config),
  getWholesaleConfig: () =>
    storageGet<WholesaleConfig>(KEYS.wholesaleConfig, DEFAULT_WHOLESALE_CONFIG),
  saveWholesaleConfig: (config: WholesaleConfig) => storageSet(KEYS.wholesaleConfig, config),
  getEmployeeHash: () => storageGet<string>(KEYS.employeeHash, EMPLOYEE_HASH_DEFAULT),
  saveEmployeeHash: (hash: string) => storageSet(KEYS.employeeHash, hash),
};

// ─── Backup ─────────────────────────────────────────
export const backupService = {
  exportData: exportAllData,
  importData: importAllData,
  getLastBackup: () => storageGet<string | null>(KEYS.lastBackup, null),
  setLastBackup: () => storageSet(KEYS.lastBackup, new Date().toISOString()),
};

// ─── Seed Data ──────────────────────────────────────
export function initializeSeedData(): void {
  const existing = tireService.getAll();
  if (existing.length > 0) return;

  const now = new Date().toISOString();

  // Tires — añade updatedAt si no viene en el backup
  const tires = (initialData.tires as Omit<Tire, 'updatedAt'>[]).map((t) => ({
    ...t,
    updatedAt: now,
  })) as Tire[];
  for (const tire of tires) {
    tireService.save(tire);
  }

  // Clients
  const clients = (initialData.clients as Omit<Client, 'updatedAt'>[]).map((c) => ({
    ...c,
    updatedAt: now,
  })) as Client[];
  for (const client of clients) {
    clientService.save(client);
  }

  // Sales
  for (const sale of initialData.sales as Sale[]) {
    saleService.save(sale);
  }

  // Invoices
  for (const invoice of initialData.invoices as Invoice[]) {
    invoiceService.save(invoice);
  }

  // Orders
  for (const order of initialData.orders as Order[]) {
    orderService.save(order);
  }

  // Config
  configService.saveOrderConfig(initialData.orderConfig as OrderConfig);
  configService.saveWholesaleConfig(initialData.wholesaleConfig as WholesaleConfig);

  // Employee hash (conserva la contraseña real del backup)
  if (initialData.employeeHash) {
    configService.saveEmployeeHash(initialData.employeeHash as string);
  }
}
