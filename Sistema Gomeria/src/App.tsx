/* ═══════════════════════════════════════════════════════════════════════════
   Baliña Ruedas — Sistema de Gestión v4.0
   Gomería integral: POS, Inventario, Clientes, Pedidos, Mayorista, Analytics
   Juan B. Justo 1980 — Mar del Plata, Argentina
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, ShoppingCart, Package, Users, FileText, BarChart3, Settings,
  Plus, Minus, Trash2, Edit, Save, X, ChevronRight,
  Printer, Download, Upload, Lock, Eye, EyeOff, AlertTriangle,
  CheckCircle, Clock, Truck, MapPin, Calendar, CalendarDays,
  LogOut, ClipboardList, CreditCard,
  ArrowLeft, Shield, UserCheck, Crown,
  Phone, Mail, Info, Bell, Copy, Check, RotateCcw,
  CircleDot, XCircle,
  TrendingUp, TrendingDown,
} from 'lucide-react';

// ═══════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════

interface Tire {
  id: string;
  brand: string;
  model: string;
  size: string;
  category: string;
  costPrice: number;
  margin: number;
  salePrice: number;
  stock: number;
  minStock: number;
  location: string;
  notes: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  balance: number;
  payments: Payment[];
  createdAt: string;
  tipoCliente: 'minorista' | 'mayorista';
  descuentoMayorista: number;
  pinHash: string;
  cupoCredito: number;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  notes: string;
}

interface SaleItem {
  tireId: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  clientId?: string;
  clientName?: string;
  date: string;
  notes: string;
}

interface Invoice {
  id: string;
  type: 'A' | 'B' | 'C' | 'X';
  number: string;
  supplier: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  iva: number;
  total: number;
  paid: boolean;
  notes: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderItem {
  tireId: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  numero: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  paymentMethod: string;
  status: 'pendiente' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';
  tipo: 'retiro' | 'entrega_domicilio';
  scheduledDate: string;
  scheduledTime?: string;
  address?: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  confirmedBy?: string;
  internalNotes?: string;
  clientMessage?: string;
}

interface OrderConfig {
  enabled: boolean;
  workDays: boolean[];
  blockedDates: string[];
  minDaysAhead: number;
  maxDaysAhead: number;
  timeSlots: string[];
  maxOrdersPerDay: number;
}

interface WholesaleConfig {
  globalDiscount: number;
  minUnitsPerItem: number;
  minOrderAmount: number;
}

interface CartItem {
  tire: Tire;
  quantity: number;
  unitPrice: number;
}

type EmployeeTab = 'pos' | 'inventory' | 'clients' | 'accounts' | 'invoices' | 'orders' | 'analytics' | 'settings';
type ClientTab = 'catalog' | 'orders' | 'history' | 'account';
type SessionType = 'employee' | 'client' | null;

interface ModalState {
  show: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  onConfirm?: (inputValue?: string) => void;  // FIX: accepts optional input value
  confirmText?: string;
  inputField?: boolean;
  inputValue?: string;
  inputPlaceholder?: string;
}

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const EMPLOYEE_HASH_DEFAULT = 'f115e91ac5f0482b3553cd14532efdb48f1d42df16787c3f0710f30483484886';
const EMPLOYEE_TIMEOUT = 30 * 60 * 1000;
const CLIENT_TIMEOUT = 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', surcharge: 0 },
  { id: 'debito', label: 'Débito', surcharge: 0 },
  { id: 'credito_1', label: 'Crédito 1 cuota', surcharge: 0 },
  { id: 'credito_3', label: 'Crédito 3 cuotas', surcharge: 15 },
  { id: 'credito_6', label: 'Crédito 6 cuotas', surcharge: 25 },
  { id: 'credito_12', label: 'Crédito 12 cuotas', surcharge: 40 },
  { id: 'transferencia', label: 'Transferencia', surcharge: 0 },
  { id: 'cuenta_corriente', label: 'Cuenta Corriente', surcharge: 0 },
];

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  confirmado: 'bg-blue-100 text-blue-700 border-blue-300',
  en_preparacion: 'bg-amber-100 text-amber-700 border-amber-300',
  listo: 'bg-green-100 text-green-700 border-green-300',
  entregado: 'bg-emerald-200 text-emerald-800 border-emerald-400',
  cancelado: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const STATUS_FLOW: Record<string, string[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

const DEFAULT_ORDER_CONFIG: OrderConfig = {
  enabled: true,
  workDays: [false, true, true, true, true, true, true],
  blockedDates: [],
  minDaysAhead: 1,
  maxDaysAhead: 30,
  timeSlots: ['Mañana 09:00-12:00', 'Tarde 14:00-18:00', 'A coordinar'],
  maxOrdersPerDay: 10,
};

const DEFAULT_WHOLESALE_CONFIG: WholesaleConfig = {
  globalDiscount: 10,
  minUnitsPerItem: 4,
  minOrderAmount: 0,
};

// PIN hash for '1234' (calculated once for seed data)
const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

// ═══════════════════════════════════════════════════
// SEED DATA - Demo data for testing
// ═══════════════════════════════════════════════════

const SEED_TIRES: Tire[] = [
  { id: 't1', brand: 'Pirelli', model: 'P1 Cinturato', size: '175/70 R13', category: 'Auto', costPrice: 45000, margin: 35, salePrice: 60750, stock: 12, minStock: 4, location: 'A1', notes: '', createdAt: new Date().toISOString() },
  { id: 't2', brand: 'Pirelli', model: 'Scorpion ATR', size: '205/65 R15', category: 'SUV', costPrice: 85000, margin: 30, salePrice: 110500, stock: 8, minStock: 3, location: 'A2', notes: '', createdAt: new Date().toISOString() },
  { id: 't3', brand: 'Michelin', model: 'Primacy 4', size: '195/55 R16', category: 'Auto', costPrice: 120000, margin: 28, salePrice: 153600, stock: 6, minStock: 2, location: 'B1', notes: 'Premium', createdAt: new Date().toISOString() },
  { id: 't4', brand: 'Michelin', model: 'Pilot Sport 4', size: '225/45 R17', category: 'Auto', costPrice: 180000, margin: 25, salePrice: 225000, stock: 4, minStock: 2, location: 'B2', notes: 'Alto rendimiento', createdAt: new Date().toISOString() },
  { id: 't5', brand: 'Bridgestone', model: 'Turanza ER300', size: '185/65 R15', category: 'Auto', costPrice: 55000, margin: 32, salePrice: 72600, stock: 15, minStock: 4, location: 'C1', notes: '', createdAt: new Date().toISOString() },
  { id: 't6', brand: 'Bridgestone', model: 'Dueler H/T', size: '255/70 R16', category: 'Camioneta', costPrice: 130000, margin: 28, salePrice: 166400, stock: 5, minStock: 2, location: 'C2', notes: '', createdAt: new Date().toISOString() },
  { id: 't7', brand: 'Firestone', model: 'F600', size: '175/65 R14', category: 'Auto', costPrice: 38000, margin: 35, salePrice: 51300, stock: 20, minStock: 6, location: 'D1', notes: 'Económico', createdAt: new Date().toISOString() },
  { id: 't8', brand: 'Firestone', model: 'Destination AT', size: '235/75 R15', category: 'Camioneta', costPrice: 95000, margin: 30, salePrice: 123500, stock: 7, minStock: 3, location: 'D2', notes: '', createdAt: new Date().toISOString() },
  { id: 't9', brand: 'Continental', model: 'PowerContact 2', size: '185/60 R15', category: 'Auto', costPrice: 65000, margin: 30, salePrice: 84500, stock: 10, minStock: 3, location: 'E1', notes: '', createdAt: new Date().toISOString() },
  { id: 't10', brand: 'Continental', model: 'CrossContact LX', size: '215/65 R16', category: 'SUV', costPrice: 110000, margin: 28, salePrice: 140800, stock: 6, minStock: 2, location: 'E2', notes: '', createdAt: new Date().toISOString() },
  { id: 't11', brand: 'Goodyear', model: 'Eagle Sport', size: '205/55 R16', category: 'Auto', costPrice: 72000, margin: 30, salePrice: 93600, stock: 9, minStock: 3, location: 'F1', notes: '', createdAt: new Date().toISOString() },
  { id: 't12', brand: 'Goodyear', model: 'Wrangler AT/S', size: '245/70 R16', category: 'Camioneta', costPrice: 125000, margin: 28, salePrice: 160000, stock: 4, minStock: 2, location: 'F2', notes: '', createdAt: new Date().toISOString() },
  { id: 't13', brand: 'Fate', model: 'Eximia Pininfarina', size: '175/70 R14', category: 'Auto', costPrice: 42000, margin: 35, salePrice: 56700, stock: 18, minStock: 5, location: 'G1', notes: 'Nacional', createdAt: new Date().toISOString() },
  { id: 't14', brand: 'Fate', model: 'Range Runner', size: '215/80 R16', category: 'Camioneta', costPrice: 88000, margin: 32, salePrice: 116160, stock: 6, minStock: 2, location: 'G2', notes: 'Nacional', createdAt: new Date().toISOString() },
  { id: 't15', brand: 'Kumho', model: 'Ecsta PS71', size: '225/40 R18', category: 'Auto', costPrice: 95000, margin: 30, salePrice: 123500, stock: 5, minStock: 2, location: 'H1', notes: '', createdAt: new Date().toISOString() },
  { id: 't16', brand: 'Dunlop', model: 'SP Sport LM705', size: '195/65 R15', category: 'Auto', costPrice: 68000, margin: 30, salePrice: 88400, stock: 8, minStock: 3, location: 'H2', notes: '', createdAt: new Date().toISOString() },
];

const SEED_CLIENTS: Client[] = [
  { id: 'c1', name: 'Juan Pérez', phone: '223-456-7890', address: 'Av. Colón 1234, Mar del Plata', email: 'juan.perez@email.com', balance: 0, payments: [], createdAt: new Date().toISOString(), tipoCliente: 'minorista', descuentoMayorista: 0, pinHash: DEFAULT_PIN_HASH, cupoCredito: 100000 },
  { id: 'c2', name: 'María García', phone: '223-567-8901', address: 'Calle San Martín 567, Mar del Plata', email: 'maria.garcia@email.com', balance: 45000, payments: [{ id: 'p1', amount: 50000, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), method: 'efectivo', notes: 'Pago parcial' }], createdAt: new Date().toISOString(), tipoCliente: 'minorista', descuentoMayorista: 0, pinHash: DEFAULT_PIN_HASH, cupoCredito: 150000 },
  { id: 'c3', name: 'Distribuidora del Sur SRL', phone: '223-678-9012', address: 'Parque Industrial Ruta 88, Mar del Plata', email: 'contacto@delsur.com.ar', balance: 0, payments: [], createdAt: new Date().toISOString(), tipoCliente: 'mayorista', descuentoMayorista: 15, pinHash: DEFAULT_PIN_HASH, cupoCredito: 500000 },
  { id: 'c4', name: 'Taller Mecánico Rápido', phone: '223-789-0123', address: 'Av. Independencia 890, Mar del Plata', email: 'taller.rapido@email.com', balance: 120000, payments: [], createdAt: new Date().toISOString(), tipoCliente: 'mayorista', descuentoMayorista: 10, pinHash: DEFAULT_PIN_HASH, cupoCredito: 300000 },
  { id: 'c5', name: 'Carlos Rodríguez', phone: '223-890-1234', address: 'Calle Rivadavia 456, Mar del Plata', email: '', balance: 0, payments: [], createdAt: new Date().toISOString(), tipoCliente: 'minorista', descuentoMayorista: 0, pinHash: DEFAULT_PIN_HASH, cupoCredito: 80000 },
  { id: 'c6', name: 'AutoPartes López', phone: '223-901-2345', address: 'Av. Luro 2345, Mar del Plata', email: 'ventas@autoparteslopez.com', balance: 250000, payments: [], createdAt: new Date().toISOString(), tipoCliente: 'mayorista', descuentoMayorista: 12, pinHash: DEFAULT_PIN_HASH, cupoCredito: 200000 },
];

const SEED_SALES: Sale[] = [
  { id: 's1', items: [{ tireId: 't1', brand: 'Pirelli', model: 'P1 Cinturato', size: '175/70 R13', quantity: 4, unitPrice: 60750, subtotal: 243000 }], total: 243000, paymentMethod: 'efectivo', clientId: 'c1', clientName: 'Juan Pérez', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), notes: '' },
  { id: 's2', items: [{ tireId: 't5', brand: 'Bridgestone', model: 'Turanza ER300', size: '185/65 R15', quantity: 2, unitPrice: 72600, subtotal: 145200 }], total: 145200, paymentMethod: 'debito', clientId: 'c2', clientName: 'María García', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), notes: '' },
  { id: 's3', items: [{ tireId: 't7', brand: 'Firestone', model: 'F600', size: '175/65 R14', quantity: 8, unitPrice: 46170, subtotal: 369360 }], total: 369360, paymentMethod: 'transferencia', clientId: 'c3', clientName: 'Distribuidora del Sur SRL', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Venta mayorista' },
  { id: 's4', items: [{ tireId: 't9', brand: 'Continental', model: 'PowerContact 2', size: '185/60 R15', quantity: 4, unitPrice: 84500, subtotal: 338000 }], total: 338000, paymentMethod: 'cuenta_corriente', clientId: 'c4', clientName: 'Taller Mecánico Rápido', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), notes: '' },
  { id: 's5', items: [{ tireId: 't13', brand: 'Fate', model: 'Eximia Pininfarina', size: '175/70 R14', quantity: 2, unitPrice: 56700, subtotal: 113400 }], total: 113400, paymentMethod: 'credito_3', clientId: 'c5', clientName: 'Carlos Rodríguez', date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), notes: '' },
];

const SEED_ORDERS: Order[] = [
  { id: 'o1', numero: `PED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`, clientId: 'c1', clientName: 'Juan Pérez', items: [{ tireId: 't3', brand: 'Michelin', model: 'Primacy 4', size: '195/55 R16', quantity: 4, unitPrice: 153600, subtotal: 614400 }], paymentMethod: 'credito_3', status: 'pendiente', tipo: 'retiro', scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), scheduledTime: 'Mañana 09:00-12:00', totalAmount: 706560, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), notes: 'Llamar antes de ir' },
  { id: 'o2', numero: `PED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0002`, clientId: 'c2', clientName: 'María García', items: [{ tireId: 't11', brand: 'Goodyear', model: 'Eagle Sport', size: '205/55 R16', quantity: 2, unitPrice: 93600, subtotal: 187200 }], paymentMethod: 'efectivo', status: 'confirmado', tipo: 'entrega_domicilio', scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), scheduledTime: 'Tarde 14:00-18:00', address: 'Calle San Martín 567', totalAmount: 187200, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'o3', numero: `PED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0003`, clientId: 'c3', clientName: 'Distribuidora del Sur SRL', items: [{ tireId: 't7', brand: 'Firestone', model: 'F600', size: '175/65 R14', quantity: 12, unitPrice: 46170, subtotal: 554040 }, { tireId: 't13', brand: 'Fate', model: 'Eximia Pininfarina', size: '175/70 R14', quantity: 8, unitPrice: 48195, subtotal: 385560 }], paymentMethod: 'transferencia', status: 'en_preparacion', tipo: 'entrega_domicilio', scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), scheduledTime: 'Mañana 09:00-12:00', address: 'Parque Industrial Ruta 88', totalAmount: 939600, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), internalNotes: 'Pedido grande, preparar con anticipación' },
  { id: 'o4', numero: `PED-${new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')}-0001`, clientId: 'c5', clientName: 'Carlos Rodríguez', items: [{ tireId: 't1', brand: 'Pirelli', model: 'P1 Cinturato', size: '175/70 R13', quantity: 2, unitPrice: 60750, subtotal: 121500 }], paymentMethod: 'efectivo', status: 'listo', tipo: 'retiro', scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: 'Tarde 14:00-18:00', totalAmount: 121500, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), clientMessage: 'Su pedido está listo para retirar' },
];

// ═══════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════

const sanitize = (str: string): string => {
  // FIX: explicit character replacement avoids double-escaping edge cases
  // and works in non-DOM environments (e.g. SSR / tests)
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
};

const genId = (): string => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const calculatePrice = (costPrice: number, margin: number, surcharge: number, discount: number = 0): number => {
  const base = costPrice * (1 + margin / 100);
  const withSurcharge = base * (1 + surcharge / 100);
  const withDiscount = withSurcharge * (1 - discount / 100);
  return Math.round(withDiscount);
};

const generateOrderNumber = (orders: Order[]): string => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const todayOrders = orders.filter(o => o.numero.includes(dateStr));
  const seq = (todayOrders.length + 1).toString().padStart(4, '0');
  return `PED-${dateStr}-${seq}`;
};

// localStorage helpers
function loadData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function saveData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function isWorkDay(date: Date, config: OrderConfig): boolean {
  const day = date.getDay();
  if (!config.workDays[day]) return false;
  const dateStr = date.toISOString().slice(0, 10);
  if (config.blockedDates.includes(dateStr)) return false;
  return true;
}

function getAvailableDates(config: OrderConfig): string[] {
  // FIX: separated "days ahead" check from "available slots" count to avoid early break
  const dates: string[] = [];
  const today = new Date();
  for (let daysAhead = config.minDaysAhead; daysAhead <= config.maxDaysAhead; daysAhead++) {
    const d = new Date(today);
    d.setDate(d.getDate() + daysAhead);
    if (isWorkDay(d, config)) {
      dates.push(d.toISOString().slice(0, 10));
      if (dates.length >= 30) break; // max 30 selectable dates in UI
    }
  }
  return dates;
}

function getDebtStatus(client: Client): { label: string; color: string; blocked: boolean } {
  if (client.balance <= 0) return { label: 'Al día', color: 'bg-green-100 text-green-700', blocked: false };
  if (client.cupoCredito > 0 && client.balance >= client.cupoCredito) return { label: 'Bloqueado', color: 'bg-red-100 text-red-700', blocked: true };
  if (client.cupoCredito > 0 && client.balance > client.cupoCredito * 0.7) return { label: 'Deuda alta', color: 'bg-red-100 text-red-600', blocked: false };
  if (client.balance > 0) return { label: 'Deuda moderada', color: 'bg-amber-100 text-amber-700', blocked: false };
  return { label: 'Al día', color: 'bg-green-100 text-green-700', blocked: false };
}


// ═══════════════════════════════════════════════════════════════════════════
// CSV IMPORT — TYPES & PARSER
// ═══════════════════════════════════════════════════════════════════════════

interface CsvRow {
  brand: string; model: string; size: string; category: string;
  costPrice: number; salePrice: number; margin: number;
  stock: number; minStock: number; location?: string; notes?: string;
}
interface CsvParseResult {
  rows: CsvRow[];
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
}
interface CsvImportSummary {
  total: number;
  toAdd: CsvRow[];
  toUpdate: { existing: Tire; incoming: CsvRow }[];
  duplicatesSkipped: CsvRow[];
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
}

function parseArgPrice(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/\$/g,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.abs(n);
}

function normalizeSizeStr(s: string): string {
  return s.trim().toUpperCase()
    .replace(/(\d{3}\/\d{2,3})\s*R\s*(\d{2,3}[A-Z]?)/g, '$1 R$2');
}

function inferCategoryFromSize(size: string, desc = ''): string {
  const d = (size + ' ' + desc).toUpperCase();
  if (/10\.00|11\.00|12\.00|R20[^\d]|R22[^\d]|AGRO|TRACTOR/.test(d)) return 'Pesado/Agrícola';
  if (/[/R]16C|[/R]15C|8PR|10PR|12PR|VAN|COMMERCIO|CARGO/.test(d)) return 'Utilitario';
  if (/225\/4[05]|235\/3[5-9]|245\/3[5-9]|215\/4[05]|205\/40/.test(d)) return 'Deportivo';
  if (/235\/75|245\/70|255\/70|265\/7[05]|215\/80|265\/65/.test(d)) return 'Camioneta/SUV';
  if (/TERRAMAX|WRANGLER|4X4|DUELER|SCORPION|CROSSWIND|AT[/ ]/.test(d)) return 'Camioneta/SUV';
  return 'Auto';
}

function parseCsvText(text: string): CsvParseResult {
  const rows: CsvRow[] = [];
  const errors: { line: number; message: string }[] = [];
  const warnings: { line: number; message: string }[] = [];

  const firstLine = text.split('\n')[0] || '';
  const sep = (firstLine.match(/;/g)||[]).length > (firstLine.match(/,/g)||[]).length ? ';' : ',';
  const lines = text.split('\n').map(l => l.replace(/\r/g, ''));

  // Find header row (must contain 'marca'/'brand'/'modelo'/'model' etc.)
  const headerIdx = lines.findIndex(l => {
    const low = l.toLowerCase();
    return low.includes('marca') || low.includes('brand') || low.includes('modelo') || low.includes('model');
  });
  if (headerIdx === -1) {
    errors.push({ line: 0, message: 'No se encontró fila de encabezado. Se esperan columnas: marca, modelo, medida, precio_venta.' });
    return { rows, errors, warnings };
  }

  const normalizeHeader = (h: string) => h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9_]/g,'_');

  const headers = lines[headerIdx].split(sep).map(normalizeHeader);

  type ColKey = 'brand'|'model'|'size'|'category'|'costPrice'|'salePrice'|'margin'|'stock'|'minStock'|'location'|'notes';
  const colNames: Record<ColKey, string[]> = {
    brand:     ['marca','brand','fabricante'],
    model:     ['modelo','model','diseno','diseño','design'],
    size:      ['medida','size','talla','dimension'],
    category:  ['categoria','category','tipo'],
    costPrice: ['precio_costo','costo','cost','cost_price','precio_compra','basico','total'],
    salePrice: ['precio_venta','precio','price','sale_price','reventa','publico','contado','venta'],
    margin:    ['margen','margin','markup'],
    stock:     ['stock','cantidad','qty','quantity','existencia'],
    minStock:  ['stock_minimo','min_stock','minimo','minimum'],
    location:  ['ubicacion','location','deposito','pasillo'],
    notes:     ['notas','notes','observaciones','obs'],
  };

  const cols = {} as Record<ColKey, number>;
  for (const [key, names] of Object.entries(colNames) as [ColKey, string[]][]) {
    cols[key] = headers.findIndex(h => names.some(n => h === n || h.includes(n)));
  }

  if (cols.brand < 0 && cols.model < 0) {
    errors.push({ line: headerIdx+1, message: 'Columnas de marca/modelo no encontradas.' });
    return { rows, errors, warnings };
  }
  if (cols.salePrice < 0 && cols.costPrice < 0) {
    warnings.push({ line: headerIdx+1, message: 'Sin columna de precio — se importará con precio $0.' });
  }

  for (let i = headerIdx+1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g,''));
    if (cells.length < 2) continue;
    const get = (col: number) => col >= 0 && col < cells.length ? cells[col] : '';

    const brand = get(cols.brand).trim();
    const model = get(cols.model).trim();
    const size  = normalizeSizeStr(get(cols.size).trim());
    if (!brand && !model && !size) continue;
    if (!brand && !size) continue;

    const rowErrs: string[] = [];
    if (!brand) rowErrs.push('falta marca');
    if (!model) rowErrs.push('falta modelo');
    if (!size)  rowErrs.push('falta medida');

    let costPrice = parseArgPrice(get(cols.costPrice));
    let salePrice = parseArgPrice(get(cols.salePrice));
    let margin    = parseFloat(get(cols.margin)) || 0;

    if (costPrice > 0 && salePrice <= 0 && margin > 0)
      salePrice = Math.round(costPrice * (1 + margin/100));
    else if (salePrice > 0 && costPrice <= 0 && margin > 0)
      costPrice = Math.round(salePrice / (1 + margin/100));
    else if (costPrice > 0 && salePrice > 0 && margin === 0)
      margin = Math.round(((salePrice/costPrice)-1)*100);
    else if (costPrice <= 0 && salePrice <= 0)
      rowErrs.push('precio de venta o costo requerido');

    if (rowErrs.length) { errors.push({ line: i+1, message: `Fila ${i+1}: ${rowErrs.join(', ')}` }); continue; }

    const category = get(cols.category).trim() || inferCategoryFromSize(size, `${brand} ${model}`);
    const stockVal    = parseInt(get(cols.stock), 10);
    const minStockVal = parseInt(get(cols.minStock), 10);

    rows.push({
      brand:    brand.slice(0,60), model: model.slice(0,80), size: size.slice(0,30), category,
      costPrice: Math.round(costPrice), salePrice: Math.round(salePrice), margin: Math.round(margin),
      stock:    isNaN(stockVal) ? 0 : Math.max(0, stockVal),
      minStock: isNaN(minStockVal) ? 2 : Math.max(0, minStockVal),
      location: get(cols.location).trim().slice(0,20),
      notes:    get(cols.notes).trim().slice(0,200),
    });
  }
  return { rows, errors, warnings };
}

function buildImportSummary(parsed: CsvParseResult, existingTires: Tire[]): CsvImportSummary {
  const toAdd: CsvRow[] = [];
  const toUpdate: { existing: Tire; incoming: CsvRow }[] = [];
  const duplicatesSkipped: CsvRow[] = [];

  for (const row of parsed.rows) {
    const key = `${row.brand.toLowerCase()}|${row.model.toLowerCase()}|${row.size.toLowerCase()}`;
    const match = existingTires.find(t =>
      `${t.brand.toLowerCase()}|${t.model.toLowerCase()}|${t.size.toLowerCase()}` === key
    );
    if (match) {
      const changed = match.costPrice !== row.costPrice || match.salePrice !== row.salePrice ||
                      match.category !== row.category || match.minStock !== row.minStock;
      if (changed) toUpdate.push({ existing: match, incoming: row });
      else duplicatesSkipped.push(row);
    } else {
      toAdd.push(row);
    }
  }
  return { total: parsed.rows.length, toAdd, toUpdate, duplicatesSkipped, errors: parsed.errors, warnings: parsed.warnings };
}

// ─── Catálogo pre-procesado de proveedores (Firemax, Triangle, Kumho, Corral,
//     Bull Vial, Linglong, Milever, Xbri, Fate, Maxi-Tango) — 978 productos ──
const SUPPLIER_CATALOG: CsvRow[] = [{"brand":"Firemax","model":"FM913","size":"155 R13","category":"Auto","costPrice":84514,"salePrice":173362,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"155/65 R13","category":"Auto","costPrice":58338,"salePrice":119667,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"165/70 R13","category":"Auto","costPrice":63707,"salePrice":130681,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"175/70 R13","category":"Auto","costPrice":71742,"salePrice":147164,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"175/70 R13","category":"Auto","costPrice":71176,"salePrice":146003,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"165/70 R14","category":"Auto","costPrice":72658,"salePrice":149043,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"165/60 R14","category":"Auto","costPrice":66986,"salePrice":137407,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"175/65 R14","category":"Auto","costPrice":69745,"salePrice":143067,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"175/70 R14","category":"Auto","costPrice":71639,"salePrice":146952,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"185/60 R14","category":"Auto","costPrice":76252,"salePrice":156414,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"185/65 R14","category":"Auto","costPrice":75850,"salePrice":155590,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"185/70 R14","category":"Auto","costPrice":84082,"salePrice":172475,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"185 R14","category":"Auto","costPrice":112064,"salePrice":229875,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"195/70 R14","category":"Auto","costPrice":93640,"salePrice":192083,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"195 R14","category":"Auto","costPrice":115304,"salePrice":236520,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"175/65 R15","category":"Auto","costPrice":93316,"salePrice":191418,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"185/60 R15","category":"Auto","costPrice":84627,"salePrice":173594,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"185/65 R15","category":"Auto","costPrice":84730,"salePrice":173805,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"185/65 R15","category":"Auto","costPrice":77086,"salePrice":158125,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"195 R15","category":"Auto","costPrice":124717,"salePrice":255829,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/50 R15","category":"Auto","costPrice":96364,"salePrice":197669,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/55 R15","category":"Auto","costPrice":94588,"salePrice":194026,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/60 R15","category":"Auto","costPrice":88931,"salePrice":182422,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"195/65 R15","category":"Auto","costPrice":95669,"salePrice":196244,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/65 R15","category":"Auto","costPrice":95401,"salePrice":195694,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"195/70 R15","category":"Auto","costPrice":139094,"salePrice":285321,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/60 R15","category":"Auto","costPrice":100667,"salePrice":206496,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"205/65 R15","category":"Auto","costPrice":119523,"salePrice":245175,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"205/70 R15","category":"Auto","costPrice":102381,"salePrice":210012,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"205/70 R15","category":"Auto","costPrice":131099,"salePrice":268922,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM916","size":"225/70 R15","category":"Auto","costPrice":180476,"salePrice":370207,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"185/55 R15","category":"Auto","costPrice":89404,"salePrice":183393,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/50 R16","category":"Auto","costPrice":111637,"salePrice":228998,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"195/55 R16","category":"Auto","costPrice":106911,"salePrice":219305,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"195/60 HT16","category":"Auto","costPrice":117855,"salePrice":241754,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"195/75 R16","category":"Auto","costPrice":158496,"salePrice":325119,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/55 R16","category":"Auto","costPrice":96086,"salePrice":197099,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"205/60 R16","category":"Auto","costPrice":108430,"salePrice":222420,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/60 R16","category":"Auto","costPrice":108430,"salePrice":222420,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/55 R16","category":"Auto","costPrice":81041,"salePrice":166238,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM916","size":"205/75 R16","category":"Auto","costPrice":158011,"salePrice":324126,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"215/55 R16","category":"Auto","costPrice":121963,"salePrice":250180,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"215/65 R16","category":"Auto","costPrice":132829,"salePrice":272470,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM913","size":"215/75 R16","category":"Auto","costPrice":178252,"salePrice":365645,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM916","size":"225/75 R16","category":"Auto","costPrice":196593,"salePrice":403268,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM916","size":"225/65 R16","category":"Auto","costPrice":161049,"salePrice":330356,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"235/60 R16","category":"Auto","costPrice":143624,"salePrice":294613,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"215/60 R16","category":"Auto","costPrice":126848,"salePrice":260200,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"185/55 R16","category":"Auto","costPrice":101398,"salePrice":207996,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"215/65 R16","category":"Auto","costPrice":125314,"salePrice":257054,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"195/45 R16","category":"Auto","costPrice":106721,"salePrice":218914,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/40 R17","category":"Deportivo","costPrice":113037,"salePrice":231871,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/45 R17","category":"Auto","costPrice":113237,"salePrice":232282,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/55 R17","category":"Auto","costPrice":131517,"salePrice":269778,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"205/50 R17","category":"Auto","costPrice":119199,"salePrice":244510,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"215/50 R17","category":"Auto","costPrice":131347,"salePrice":269430,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM316","size":"215/55 R17","category":"Auto","costPrice":148447,"salePrice":304507,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"225/45 R17","category":"Deportivo","costPrice":119034,"salePrice":244172,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM601","size":"225/50 R17","category":"Auto","costPrice":148391,"salePrice":304392,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"31X10.50 R15","category":"Auto","costPrice":239360,"salePrice":490994,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"235/75 R15","category":"Camioneta/SUV","costPrice":162145,"salePrice":332605,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"245/70 R16","category":"Camioneta/SUV","costPrice":203269,"salePrice":416963,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"265/70 R16","category":"Camioneta/SUV","costPrice":233491,"salePrice":478956,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"265/75 R16","category":"Camioneta/SUV","costPrice":274960,"salePrice":564021,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"225/65 R17","category":"Auto","costPrice":183492,"salePrice":376394,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"235/65 R17","category":"Camioneta/SUV","costPrice":204834,"salePrice":420173,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"245/65 R17","category":"Camioneta/SUV","costPrice":214373,"salePrice":439739,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"265/65 R17","category":"Camioneta/SUV","costPrice":238711,"salePrice":489663,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"265/70 R17","category":"Camioneta/SUV","costPrice":274595,"salePrice":563272,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"285/70 R17","category":"Auto","costPrice":305614,"salePrice":626901,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"265/60 R18","category":"Auto","costPrice":213791,"salePrice":438546,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM501","size":"275/60 R20","category":"Pesado/Agrícola","costPrice":281833,"salePrice":578118,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"215/75 QR15","category":"Auto","costPrice":175936,"salePrice":360894,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"31X10.50 QR15","category":"Auto","costPrice":226444,"salePrice":464500,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"235/75 QR15","category":"Camioneta/SUV","costPrice":219155,"salePrice":449549,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"245/70 R16","category":"Camioneta/SUV","costPrice":213390,"salePrice":437723,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"245/75 R16","category":"Auto","costPrice":224395,"salePrice":460298,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"265/75 QR16","category":"Camioneta/SUV","costPrice":312713,"salePrice":641463,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"265/65 R17","category":"Camioneta/SUV","costPrice":271280,"salePrice":556471,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"265/70 QR17","category":"Camioneta/SUV","costPrice":291268,"salePrice":597473,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM523","size":"285/70 17","category":"Auto","costPrice":328192,"salePrice":673215,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"265/70 R16","category":"Camioneta/SUV","costPrice":222136,"salePrice":455663,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"215/60 17","category":"Auto","costPrice":152499,"salePrice":312818,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"225/60 R17","category":"Auto","costPrice":152890,"salePrice":313620,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"225/65 R17","category":"Auto","costPrice":172754,"salePrice":354367,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"235/55 R17","category":"Auto","costPrice":150579,"salePrice":308879,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"235/60 R17","category":"Auto","costPrice":172888,"salePrice":354643,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"235/65 R17","category":"Camioneta/SUV","costPrice":176440,"salePrice":361929,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"245/65 R17","category":"Camioneta/SUV","costPrice":202039,"salePrice":414439,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"265/65 R17","category":"Camioneta/SUV","costPrice":224745,"salePrice":461016,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"215/55 R18","category":"Auto","costPrice":164750,"salePrice":337948,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"235/60 R18","category":"Auto","costPrice":184131,"salePrice":377704,"margin":0,"stock":0,"minStock":2},{"brand":"Firemax","model":"FM518","size":"235/55 R19","category":"Auto","costPrice":208443,"salePrice":427575,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"165/70 R13","category":"Auto","costPrice":67563,"salePrice":138590,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"175/70 R13","category":"Auto","costPrice":74898,"salePrice":153636,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"165/60 R14","category":"Auto","costPrice":85487,"salePrice":175357,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"165/70 R14","category":"Auto","costPrice":90052,"salePrice":184723,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"175/65 R14","category":"Auto","costPrice":72813,"salePrice":149361,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"175/65 R14","category":"Auto","costPrice":72813,"salePrice":149361,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"175/70 R14","category":"Auto","costPrice":87067,"salePrice":178599,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"185/60 R14","category":"Auto","costPrice":92415,"salePrice":189570,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/60 R14","category":"Auto","costPrice":79608,"salePrice":163298,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"185/65 R14","category":"Auto","costPrice":92508,"salePrice":189760,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/65 R14","category":"Auto","costPrice":92791,"salePrice":190340,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"185/70 R14","category":"Auto","costPrice":96358,"salePrice":197658,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/70 R14","category":"Auto","costPrice":87782,"salePrice":180066,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR928","size":"195/70 R14","category":"Auto","costPrice":103478,"salePrice":212262,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"175/65 R15","category":"Auto","costPrice":93363,"salePrice":191513,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"175/65 R15","category":"Auto","costPrice":93363,"salePrice":191513,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR978","size":"185/55 R15","category":"Auto","costPrice":99365,"salePrice":203825,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/55 R15","category":"Auto","costPrice":99365,"salePrice":203825,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"185/60 R15","category":"Auto","costPrice":88349,"salePrice":181228,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/60 R15","category":"Auto","costPrice":88349,"salePrice":181228,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"185/65 R15","category":"Auto","costPrice":102114,"salePrice":209464,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"185/65 R15","category":"Auto","costPrice":80478,"salePrice":165083,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"195/55 R15","category":"Auto","costPrice":111637,"salePrice":228998,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/55 R15","category":"Auto","costPrice":107544,"salePrice":220603,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"195/60 R15","category":"Auto","costPrice":108394,"salePrice":222346,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/60 R15","category":"Auto","costPrice":102880,"salePrice":211036,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"195/65 R15","category":"Auto","costPrice":111045,"salePrice":227784,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/65 R15","category":"Auto","costPrice":110756,"salePrice":227192,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR928","size":"205/60 R15","category":"Auto","costPrice":126467,"salePrice":259419,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR928","size":"205/65 R15","category":"Auto","costPrice":141313,"salePrice":289872,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"205/65 R15","category":"Auto","costPrice":117824,"salePrice":241690,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"205/70 R15","category":"Auto","costPrice":149322,"salePrice":306302,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TC101","size":"195/50 R16","category":"Auto","costPrice":115914,"salePrice":237773,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/50 R16","category":"Auto","costPrice":115914,"salePrice":237773,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/55 R16","category":"Auto","costPrice":124974,"salePrice":256357,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR978","size":"195/60 R16","category":"Auto","costPrice":129071,"salePrice":264762,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"195/60 R16","category":"Auto","costPrice":120573,"salePrice":247329,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH201","size":"205/55 WR16","category":"Auto","costPrice":116923,"salePrice":239842,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH201","size":"205/55 R16","category":"Auto","costPrice":116923,"salePrice":239842,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"205/55 R16","category":"Auto","costPrice":98902,"salePrice":202875,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR978","size":"205/55 R16","category":"Auto","costPrice":98902,"salePrice":202875,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"205/55 R16","category":"Auto","costPrice":98902,"salePrice":202875,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"205/60 R16","category":"Auto","costPrice":127867,"salePrice":262291,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE307","size":"215/55 R16","category":"Auto","costPrice":140128,"salePrice":287443,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TE301","size":"235/60 R16","category":"Auto","costPrice":181773,"salePrice":372868,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"205/45 YR17","category":"Auto","costPrice":124285,"salePrice":254943,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"205/50 YR17","category":"Auto","costPrice":119837,"salePrice":245819,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"205/55 WR17","category":"Auto","costPrice":141765,"salePrice":290801,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TA01","size":"215/50 WR17","category":"Auto","costPrice":153945,"salePrice":315784,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"215/50 YR17","category":"Auto","costPrice":144190,"salePrice":295774,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TA01","size":"225/45 WR17","category":"Deportivo","costPrice":149240,"salePrice":306134,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR968","size":"225/45 R17","category":"Deportivo","costPrice":156699,"salePrice":321434,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/45 YR17","category":"Deportivo","costPrice":124274,"salePrice":254921,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH201","size":"225/50 R17","category":"Auto","costPrice":161193,"salePrice":330652,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/50 YR17","category":"Auto","costPrice":142625,"salePrice":292564,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH201","size":"225/40 YR18","category":"Deportivo","costPrice":156417,"salePrice":320855,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/40 YR18","category":"Deportivo","costPrice":148975,"salePrice":305590,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/45 YR18","category":"Deportivo","costPrice":176190,"salePrice":361415,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/55 YR18","category":"Auto","costPrice":183530,"salePrice":376472,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH202","size":"225/45 YR19","category":"Deportivo","costPrice":283710,"salePrice":581970,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TH201","size":"275/45 YR20","category":"Pesado/Agrícola","costPrice":256600,"salePrice":526359,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/75 R15","category":"Camioneta/SUV","costPrice":186123,"salePrice":381790,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"215/65 R16","category":"Auto","costPrice":145518,"salePrice":298499,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"235/60 R16","category":"Auto","costPrice":147650,"salePrice":302871,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/70 R16","category":"Auto","costPrice":178180,"salePrice":365497,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"245/70 R16","category":"Camioneta/SUV","costPrice":214929,"salePrice":440880,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"255/70 R16","category":"Camioneta/SUV","costPrice":226408,"salePrice":464427,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"265/70 R16","category":"Camioneta/SUV","costPrice":226444,"salePrice":464500,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"215/60 R17","category":"Auto","costPrice":161641,"salePrice":331571,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"225/60 R17","category":"Auto","costPrice":169928,"salePrice":348571,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"225/60 R17","category":"Auto","costPrice":184136,"salePrice":377714,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"225/65 R17","category":"Auto","costPrice":175864,"salePrice":360746,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"225/65 R17","category":"Auto","costPrice":179832,"salePrice":368887,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/55 R17","category":"Auto","costPrice":175256,"salePrice":359500,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"235/55 R17","category":"Auto","costPrice":155741,"salePrice":319469,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/60 R17","category":"Auto","costPrice":181181,"salePrice":371653,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"235/60 R17","category":"Auto","costPrice":188285,"salePrice":386225,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/65 R17","category":"Camioneta/SUV","costPrice":196573,"salePrice":403226,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"235/65 R17","category":"Camioneta/SUV","costPrice":212916,"salePrice":436751,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"245/65 R17","category":"Camioneta/SUV","costPrice":218260,"salePrice":447712,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"265/65 R17","category":"Camioneta/SUV","costPrice":250082,"salePrice":512988,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"215/55 R18","category":"Auto","costPrice":170994,"salePrice":350757,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"225/55 R18","category":"Auto","costPrice":184404,"salePrice":378264,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"235/50 R18","category":"Auto","costPrice":182365,"salePrice":374082,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR257","size":"235/60 R18","category":"Auto","costPrice":213153,"salePrice":437237,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"255/60 R18","category":"Auto","costPrice":187395,"salePrice":384399,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"265/60 R18","category":"Auto","costPrice":220504,"salePrice":452315,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR259","size":"225/55 R19","category":"Auto","costPrice":183827,"salePrice":377081,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"31X10.50 R15","category":"Auto","costPrice":240214,"salePrice":492747,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"215/75 R15","category":"Auto","costPrice":191446,"salePrice":392709,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"235/75 R15","category":"Camioneta/SUV","costPrice":194127,"salePrice":398210,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR258","size":"235/75 R15","category":"Camioneta/SUV","costPrice":164698,"salePrice":337842,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"225/75 QR16","category":"Auto","costPrice":197937,"salePrice":406024,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"235/70 R16","category":"Auto","costPrice":207233,"salePrice":425093,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"245/70 R16","category":"Camioneta/SUV","costPrice":201772,"salePrice":413891,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"255/70 R16","category":"Camioneta/SUV","costPrice":222913,"salePrice":457257,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"265/70 R16","category":"Camioneta/SUV","costPrice":231968,"salePrice":475831,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"235/65 R17","category":"Camioneta/SUV","costPrice":213539,"salePrice":438029,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"245/65 R17","category":"Camioneta/SUV","costPrice":244533,"salePrice":501606,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"265/65 R17","category":"Camioneta/SUV","costPrice":264459,"salePrice":542481,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR292","size":"265/60 R18","category":"Auto","costPrice":299417,"salePrice":614188,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"175/65 R14","category":"Auto","costPrice":103365,"salePrice":212030,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR645","size":"185 R14","category":"Auto","costPrice":128737,"salePrice":264076,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR645","size":"195 R15","category":"Auto","costPrice":148113,"salePrice":303821,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR645","size":"195/70 RR15","category":"Auto","costPrice":150949,"salePrice":309639,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"205/70 R15","category":"Auto","costPrice":152107,"salePrice":312015,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"225/70 R15","category":"Auto","costPrice":185067,"salePrice":379625,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"195/75 R16","category":"Auto","costPrice":161414,"salePrice":331105,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"205/75 R16","category":"Auto","costPrice":176023,"salePrice":361073,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"225/65 R16","category":"Auto","costPrice":179832,"salePrice":368887,"margin":0,"stock":0,"minStock":2},{"brand":"Triangle","model":"TR652","size":"225/75 QR16","category":"Auto","costPrice":202204,"salePrice":414777,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"155/70 R13","category":"Auto","costPrice":79371,"salePrice":162813,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"165/70 R13","category":"Auto","costPrice":87865,"salePrice":180236,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"165/70 R13","category":"Auto","costPrice":79994,"salePrice":164091,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"175/70 R13","category":"Auto","costPrice":98953,"salePrice":202981,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"175/70 R13","category":"Auto","costPrice":85504,"salePrice":175392,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"185/60 R13","category":"Auto","costPrice":117417,"salePrice":240856,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"165/60 R14","category":"Auto","costPrice":88972,"salePrice":182506,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"165/70 R14","category":"Auto","costPrice":96842,"salePrice":198651,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"175/65 R14","category":"Auto","costPrice":91345,"salePrice":187374,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"175/70 R14","category":"Auto","costPrice":102283,"salePrice":209812,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"185/60 R14","category":"Auto","costPrice":88457,"salePrice":181450,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"185/65 R14","category":"Auto","costPrice":106520,"salePrice":218502,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"185/70 R14","category":"Auto","costPrice":97532,"salePrice":200066,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"195/70 R14","category":"Auto","costPrice":119234,"salePrice":244583,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"165/65 R15","category":"Auto","costPrice":102891,"salePrice":211058,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"175/55 R15","category":"Auto","costPrice":113726,"salePrice":233285,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PA31","size":"175/65 R15","category":"Auto","costPrice":133370,"salePrice":273579,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"175/65 R15","category":"Auto","costPrice":111364,"salePrice":228438,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"185/55 R15","category":"Auto","costPrice":131280,"salePrice":269293,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"185/55 R15","category":"Auto","costPrice":125288,"salePrice":257001,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"185/60 R15","category":"Auto","costPrice":98165,"salePrice":201365,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"185/65 R15","category":"Auto","costPrice":98719,"salePrice":202500,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS51","size":"195/45 R15","category":"Auto","costPrice":130729,"salePrice":268162,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"195/50 R15","category":"Auto","costPrice":124078,"salePrice":254519,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"195/50 R15","category":"Auto","costPrice":137998,"salePrice":283072,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"195/55 R15","category":"Auto","costPrice":136495,"salePrice":279989,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"195/55 R15","category":"Auto","costPrice":131944,"salePrice":270654,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"195/60 R15","category":"Auto","costPrice":111364,"salePrice":228438,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"195/65 R15","category":"Auto","costPrice":121474,"salePrice":249177,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"205/50 R15","category":"Auto","costPrice":144653,"salePrice":296725,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"205/60 R15","category":"Auto","costPrice":144051,"salePrice":295489,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"205/60 R15","category":"Auto","costPrice":139207,"salePrice":285553,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"205/65 R15","category":"Auto","costPrice":144653,"salePrice":296725,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"205/65 R15","category":"Auto","costPrice":138343,"salePrice":283780,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"205/70 R15","category":"Auto","costPrice":152895,"salePrice":313630,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"205/70 R15","category":"Auto","costPrice":151649,"salePrice":311075,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"215/65 R15","category":"Auto","costPrice":185809,"salePrice":381146,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"215/70 R15","category":"Auto","costPrice":170680,"salePrice":350112,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"215/70 R15","category":"Auto","costPrice":213035,"salePrice":436994,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS51","size":"185/55 R16","category":"Auto","costPrice":154954,"salePrice":317854,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"195/45 R16","category":"Auto","costPrice":157965,"salePrice":324031,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"195/45 R16","category":"Auto","costPrice":138178,"salePrice":283442,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"195/50 R16","category":"Auto","costPrice":135614,"salePrice":278183,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"195/55 R16","category":"Auto","costPrice":159571,"salePrice":327325,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"195/55 R16","category":"Auto","costPrice":144051,"salePrice":295489,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"195/60 R16","category":"Auto","costPrice":148890,"salePrice":305415,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"205/45 R16","category":"Auto","costPrice":159180,"salePrice":326523,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"205/55 R16","category":"Auto","costPrice":109892,"salePrice":225419,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"205/55 R16","category":"Auto","costPrice":175523,"salePrice":360048,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"205/60 R16","category":"Auto","costPrice":145261,"salePrice":297971,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH17","size":"205/65 16","category":"Auto","costPrice":182180,"salePrice":373702,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"205/65 R16","category":"Auto","costPrice":182180,"salePrice":373702,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/45 R16","category":"Deportivo","costPrice":147742,"salePrice":303061,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS51","size":"215/55 R16","category":"Auto","costPrice":210023,"salePrice":430816,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/55 R16","category":"Auto","costPrice":165234,"salePrice":338941,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"215/60 R16","category":"Auto","costPrice":162809,"salePrice":333967,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"215/65 R16","category":"Auto","costPrice":187019,"salePrice":383628,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"215/65 R16","category":"Auto","costPrice":193988,"salePrice":397925,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"225/60 R16","category":"Auto","costPrice":199553,"salePrice":409339,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"225/70 R16","category":"Auto","costPrice":217853,"salePrice":446877,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"225/70 R16","category":"Auto","costPrice":200402,"salePrice":411081,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"225/60 R16","category":"Auto","costPrice":184228,"salePrice":377904,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"235/60 R16","category":"Auto","costPrice":209416,"salePrice":429571,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"235/60 R16","category":"Auto","costPrice":207743,"salePrice":426139,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"235/70 R16","category":"Auto","costPrice":273570,"salePrice":561170,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"205/40 R17","category":"Deportivo","costPrice":147078,"salePrice":301698,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"205/45 R17","category":"Auto","costPrice":172888,"salePrice":354643,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"205/50 WR17","category":"Auto","costPrice":159782,"salePrice":327758,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"205/55 R17","category":"Auto","costPrice":173099,"salePrice":355075,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"205/55 R17","category":"Auto","costPrice":167046,"salePrice":342658,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"215/45 R17","category":"Deportivo","costPrice":178550,"salePrice":366257,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"215/50 WR17","category":"Auto","costPrice":183395,"salePrice":376194,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/50 R17","category":"Auto","costPrice":168261,"salePrice":345150,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KR26","size":"215/55 R17","category":"Auto","costPrice":197916,"salePrice":405982,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"215/55 R17","category":"Auto","costPrice":173099,"salePrice":355075,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/55 ZR1717","category":"Auto","costPrice":183997,"salePrice":377429,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/60 R17","category":"Auto","costPrice":187626,"salePrice":384873,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"215/65 R17","category":"Auto","costPrice":197916,"salePrice":405982,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"225/45 R17","category":"Deportivo","costPrice":138080,"salePrice":283241,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"225/45 R17","category":"Deportivo","costPrice":190375,"salePrice":390512,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"225/50 ZRF17","category":"Auto","costPrice":297605,"salePrice":610471,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"ES31","size":"225/50 WR17","category":"Auto","costPrice":197916,"salePrice":405982,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/45 R17","category":"Auto","costPrice":215464,"salePrice":441978,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS52","size":"235/55 R17","category":"Auto","costPrice":325469,"salePrice":667629,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"235/55 R17","category":"Auto","costPrice":234233,"salePrice":480477,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KH27","size":"235/55 R17","category":"Auto","costPrice":214254,"salePrice":439496,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"235/65 R17","category":"Camioneta/SUV","costPrice":331955,"salePrice":680934,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"245/45 R17","category":"Auto","costPrice":265098,"salePrice":543790,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS51","size":"245/45 R17","category":"Auto","costPrice":193015,"salePrice":395929,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"255/40 R17","category":"Auto","costPrice":275990,"salePrice":566133,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PA31","size":"215/35 R18","category":"Auto","costPrice":196454,"salePrice":402983,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"215/40 R18","category":"Deportivo","costPrice":225959,"salePrice":463505,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PA31","size":"215/55 R18","category":"Auto","costPrice":210894,"salePrice":432603,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"225/40 R18","category":"Deportivo","costPrice":219056,"salePrice":449346,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"225/45 R18","category":"Deportivo","costPrice":230977,"salePrice":473798,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"225/50 R18","category":"Auto","costPrice":220935,"salePrice":453201,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/40 R18","category":"Deportivo","costPrice":261106,"salePrice":535602,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/45 R18","category":"Auto","costPrice":274916,"salePrice":563930,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HS51","size":"235/45 R18","category":"Auto","costPrice":222926,"salePrice":457285,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"235/50 WR18","category":"Auto","costPrice":232460,"salePrice":476842,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/50 VRF18","category":"Auto","costPrice":374934,"salePrice":769095,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"TA21","size":"235/50 R18","category":"Auto","costPrice":254962,"salePrice":522998,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"245/40 R18","category":"Deportivo","costPrice":252954,"salePrice":518881,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS91","size":"245/40 R18","category":"Deportivo","costPrice":237057,"salePrice":486271,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"255/35 R18","category":"Auto","costPrice":279048,"salePrice":572406,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"265/35 R18","category":"Auto","costPrice":237762,"salePrice":487716,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS31","size":"265/35 WR18","category":"Auto","costPrice":336312,"salePrice":689870,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"225/35 R19","category":"Auto","costPrice":245267,"salePrice":503112,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"225/45 R19","category":"Deportivo","costPrice":255517,"salePrice":524137,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/35 R19","category":"Deportivo","costPrice":215683,"salePrice":442426,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS91","size":"235/35 R19","category":"Deportivo","costPrice":326377,"salePrice":669491,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"235/55 R19","category":"Auto","costPrice":345283,"salePrice":708272,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"245/40 R19","category":"Deportivo","costPrice":256376,"salePrice":525900,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"245/45 R19","category":"Auto","costPrice":282870,"salePrice":580246,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"255/35 R19","category":"Auto","costPrice":359677,"salePrice":737799,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"255/40 R19","category":"Auto","costPrice":347413,"salePrice":712642,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"275/40 R19","category":"Auto","costPrice":397243,"salePrice":814857,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS91","size":"245/45 R20","category":"Pesado/Agrícola","costPrice":315403,"salePrice":646981,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"255/35 R20","category":"Pesado/Agrícola","costPrice":384752,"salePrice":789235,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"PS71","size":"275/35 R20","category":"Pesado/Agrícola","costPrice":446844,"salePrice":916603,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL12","size":"255/60 R15","category":"Auto","costPrice":269756,"salePrice":553346,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"215/70 R16","category":"Auto","costPrice":255003,"salePrice":523083,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"215/70 R16","category":"Auto","costPrice":202873,"salePrice":416150,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"215/85 R16","category":"Auto","costPrice":313485,"salePrice":643047,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"225/70 R16","category":"Auto","costPrice":244188,"salePrice":500899,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"245/70 R16","category":"Camioneta/SUV","costPrice":252630,"salePrice":518215,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"245/70 R16","category":"Camioneta/SUV","costPrice":254637,"salePrice":522333,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"245/75 R16","category":"Auto","costPrice":277158,"salePrice":568530,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"255/70 R16","category":"Camioneta/SUV","costPrice":267820,"salePrice":549375,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"265/70 R16","category":"Camioneta/SUV","costPrice":269473,"salePrice":552766,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL21","size":"215/60 R17","category":"Auto","costPrice":227587,"salePrice":466845,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"225/60 R17","category":"Auto","costPrice":227587,"salePrice":466845,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL21","size":"225/65 R17","category":"Auto","costPrice":239334,"salePrice":490941,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"235/55 R17","category":"Auto","costPrice":260094,"salePrice":533526,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"235/60 R17","category":"Auto","costPrice":261278,"salePrice":535955,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"235/65 R17","category":"Camioneta/SUV","costPrice":241306,"salePrice":494986,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"245/65 R17","category":"Camioneta/SUV","costPrice":310973,"salePrice":637893,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"245/65 R17","category":"Camioneta/SUV","costPrice":245567,"salePrice":503728,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"255/65 R17","category":"Auto","costPrice":316146,"salePrice":648505,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"255/65 R17","category":"Auto","costPrice":300909,"salePrice":617250,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"265/65 R17","category":"Camioneta/SUV","costPrice":314489,"salePrice":645106,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"265/65 R17","category":"Camioneta/SUV","costPrice":303895,"salePrice":623375,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"265/70 R17","category":"Camioneta/SUV","costPrice":352340,"salePrice":722748,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"215/55 R18","category":"Auto","costPrice":246154,"salePrice":504932,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"215/55 R18","category":"Auto","costPrice":245084,"salePrice":502736,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"225/55 R18","category":"Auto","costPrice":276726,"salePrice":567644,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"225/55 R18","category":"Auto","costPrice":318442,"salePrice":653215,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"225/60 R18","category":"Auto","costPrice":274780,"salePrice":563652,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"235/55 R18","category":"Auto","costPrice":293363,"salePrice":601771,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"235/55 R18","category":"Auto","costPrice":291732,"salePrice":598424,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"235/60 R18","category":"Auto","costPrice":297816,"salePrice":610904,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"235/60 R18","category":"Auto","costPrice":303983,"salePrice":623554,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL21","size":"235/60 R18","category":"Auto","costPrice":274919,"salePrice":563937,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"245/60 R18","category":"Auto","costPrice":317753,"salePrice":651801,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"255/60 R18","category":"Auto","costPrice":300909,"salePrice":617250,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL21","size":"265/60 R18","category":"Auto","costPrice":307962,"salePrice":631717,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"265/60 R18","category":"Auto","costPrice":313835,"salePrice":643764,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"225/55 R19","category":"Auto","costPrice":244733,"salePrice":502017,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"245/45 R19","category":"Auto","costPrice":350199,"salePrice":718356,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"255/50 R19","category":"Auto","costPrice":372415,"salePrice":763929,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"255/55 R19","category":"Auto","costPrice":415470,"salePrice":852246,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"255/55 R19","category":"Auto","costPrice":326921,"salePrice":670607,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL33","size":"255/50 R20","category":"Pesado/Agrícola","costPrice":394458,"salePrice":809144,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"255/50 R20","category":"Pesado/Agrícola","costPrice":382396,"salePrice":784403,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"255/55 R20","category":"Pesado/Agrícola","costPrice":403060,"salePrice":826789,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL21","size":"265/50 R20","category":"Pesado/Agrícola","costPrice":363932,"salePrice":746527,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"275/40 R20","category":"Pesado/Agrícola","costPrice":600385,"salePrice":1231559,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"275/45 R20","category":"Pesado/Agrícola","costPrice":476339,"salePrice":977105,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HT51","size":"275/60 R20","category":"Pesado/Agrícola","costPrice":439401,"salePrice":901336,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP71","size":"275/60 R20","category":"Pesado/Agrícola","costPrice":424808,"salePrice":871400,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"315/35 R20","category":"Pesado/Agrícola","costPrice":633793,"salePrice":1300089,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"HP91","size":"295/35 R21","category":"Auto","costPrice":556360,"salePrice":1141252,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL71","size":"27x8.50 QR14","category":"Auto","costPrice":220998,"salePrice":453329,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL71","size":"30x9.5 R15","category":"Auto","costPrice":265062,"salePrice":543716,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"31X10.5 QR15","category":"Auto","costPrice":311071,"salePrice":638094,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"33X12.5 QR15","category":"Auto","costPrice":395286,"salePrice":810843,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"235/75 QR15","category":"Camioneta/SUV","costPrice":292221,"salePrice":599427,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL71","size":"225/75 QR16","category":"Auto","costPrice":313485,"salePrice":643047,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"245/70 QR16","category":"Camioneta/SUV","costPrice":355546,"salePrice":729326,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL71","size":"245/75 R16","category":"Auto","costPrice":343676,"salePrice":704976,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"245/75 QR16","category":"Auto","costPrice":341828,"salePrice":701186,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"255/70 QR16","category":"Camioneta/SUV","costPrice":316873,"salePrice":649995,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"265/70 R16","category":"Camioneta/SUV","costPrice":308852,"salePrice":633543,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KL71","size":"265/75 R16","category":"Camioneta/SUV","costPrice":387770,"salePrice":795426,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"265/65 QR17","category":"Camioneta/SUV","costPrice":385799,"salePrice":791383,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"265/70 QR17","category":"Camioneta/SUV","costPrice":429842,"salePrice":881727,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"MT51","size":"265/60 QR18","category":"Auto","costPrice":540243,"salePrice":1108191,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"27X8.50 R14","category":"Auto","costPrice":220483,"salePrice":452273,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"30X9.50 R15","category":"Auto","costPrice":257937,"salePrice":529102,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"31X10.5 R15","category":"Auto","costPrice":278065,"salePrice":570389,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"31X10.5 R15","category":"Auto","costPrice":301687,"salePrice":618845,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT61","size":"205/75 R15","category":"Auto","costPrice":190241,"salePrice":390237,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"215/75 R15","category":"Auto","costPrice":260598,"salePrice":534561,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"235/75 R15","category":"Camioneta/SUV","costPrice":230079,"salePrice":471956,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"205/80 R16","category":"Auto","costPrice":236811,"salePrice":485767,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"215/65 R16","category":"Auto","costPrice":236055,"salePrice":484215,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"225/75 R16","category":"Auto","costPrice":290341,"salePrice":595572,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"225/75 R16","category":"Auto","costPrice":279882,"salePrice":574116,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"235/70 R16","category":"Auto","costPrice":263286,"salePrice":540073,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"235/85 R16","category":"Auto","costPrice":316903,"salePrice":650058,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"245/70 R16","category":"Camioneta/SUV","costPrice":256511,"salePrice":526177,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"245/70 R16","category":"Camioneta/SUV","costPrice":253397,"salePrice":519789,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"245/75 R16","category":"Auto","costPrice":283114,"salePrice":580747,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"255/70 R16","category":"Camioneta/SUV","costPrice":272669,"salePrice":559322,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/70 R16","category":"Camioneta/SUV","costPrice":288972,"salePrice":592763,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/75 R16","category":"Camioneta/SUV","costPrice":350903,"salePrice":719802,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"285/75 R16","category":"Auto","costPrice":379843,"salePrice":779166,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"225/70 R17","category":"Auto","costPrice":245634,"salePrice":503865,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"235/65 R17","category":"Camioneta/SUV","costPrice":280473,"salePrice":575330,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"245/65 R17","category":"Camioneta/SUV","costPrice":293816,"salePrice":602699,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"245/65 R17","category":"Camioneta/SUV","costPrice":291530,"salePrice":598011,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"245/75 R17","category":"Auto","costPrice":348417,"salePrice":714702,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"255/70 R17","category":"Camioneta/SUV","costPrice":266384,"salePrice":546429,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"265/65 R17","category":"Camioneta/SUV","costPrice":315426,"salePrice":647028,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/65 R17","category":"Camioneta/SUV","costPrice":315853,"salePrice":647904,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"265/70 R17","category":"Camioneta/SUV","costPrice":394174,"salePrice":808563,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/70 R17","category":"Camioneta/SUV","costPrice":329834,"salePrice":676583,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"285/70 R17","category":"Auto","costPrice":411609,"salePrice":844327,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"315/70 QR17","category":"Auto","costPrice":506459,"salePrice":1038891,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"255/60 R18","category":"Auto","costPrice":356175,"salePrice":730615,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"255/60 R18","category":"Auto","costPrice":333638,"salePrice":684386,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"265/60 R18","category":"Auto","costPrice":283747,"salePrice":582045,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/60 R18","category":"Auto","costPrice":362815,"salePrice":744236,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/65 R18","category":"Camioneta/SUV","costPrice":382217,"salePrice":784034,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"285/65 R18","category":"Auto","costPrice":444930,"salePrice":912677,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"255/55 R19","category":"Auto","costPrice":434475,"salePrice":891231,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"35X12.5 R20","category":"Pesado/Agrícola","costPrice":534715,"salePrice":1096851,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"265/60 R20","category":"Pesado/Agrícola","costPrice":416113,"salePrice":853566,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"275/55 R20","category":"Pesado/Agrícola","costPrice":351511,"salePrice":721048,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT51","size":"275/60 R20","category":"Pesado/Agrícola","costPrice":488855,"salePrice":1002779,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"AT52","size":"275/60 R20","category":"Pesado/Agrícola","costPrice":446989,"salePrice":916901,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"155 R12","category":"Auto","costPrice":124428,"salePrice":255237,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC55","size":"5.00 R12","category":"Auto","costPrice":117747,"salePrice":241532,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC55","size":"145 ECH13","category":"Auto","costPrice":116655,"salePrice":239293,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"155 R13","category":"Auto","costPrice":116655,"salePrice":239293,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC55","size":"155 CR13","category":"Auto","costPrice":130194,"salePrice":267065,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC55","size":"5.50 R13","category":"Auto","costPrice":174978,"salePrice":358929,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"165/70 R14","category":"Auto","costPrice":137390,"salePrice":281826,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"175/65 R14","category":"Auto","costPrice":140829,"salePrice":288879,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"185/80 R14","category":"Auto","costPrice":166855,"salePrice":342267,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"195 R14","category":"Auto","costPrice":180419,"salePrice":370090,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"195/70 R15","category":"Auto","costPrice":206286,"salePrice":423150,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"195/80 R15","category":"Auto","costPrice":189598,"salePrice":388918,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"205/70 R15","category":"Auto","costPrice":193911,"salePrice":397766,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"225/70 R15","category":"Auto","costPrice":246669,"salePrice":505988,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"195/75 R16","category":"Auto","costPrice":240626,"salePrice":493591,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"205/65 R16","category":"Auto","costPrice":227901,"salePrice":467489,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"205/75 R16","category":"Auto","costPrice":244970,"salePrice":502503,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"215/65 R16","category":"Auto","costPrice":253428,"salePrice":519853,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"215/70 R16","category":"Auto","costPrice":269231,"salePrice":552269,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"215/75 R16","category":"Auto","costPrice":281915,"salePrice":578287,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"225/65 R16","category":"Auto","costPrice":243874,"salePrice":500254,"margin":0,"stock":0,"minStock":2},{"brand":"Kumho","model":"KC53","size":"225/75 R16","category":"Auto","costPrice":297816,"salePrice":610904,"margin":0,"stock":0,"minStock":2},{"brand":"Armour","model":"10PR F2(3RIB) TL","size":"10.00-16","category":"Pesado/Agrícola","costPrice":251829,"salePrice":304714,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR MTF 212 TT","size":"10.00-16","category":"Pesado/Agrícola","costPrice":261907,"salePrice":316908,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR F-2 TL MTF 284","size":"10.00-16","category":"Pesado/Agrícola","costPrice":268446,"salePrice":324820,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12 PR MTF 212 TT","size":"10.00-16","category":"Pesado/Agrícola","costPrice":269231,"salePrice":325770,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-18 12PR MAW 203 TL","size":"10.5/80-18","category":"Utilitario","costPrice":291058,"salePrice":352180,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-18 10PR IMP600","size":"10.5/80-18","category":"Utilitario","costPrice":301952,"salePrice":365362,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-18 12PR IMP600","size":"10.5/80-18","category":"Utilitario","costPrice":329097,"salePrice":398207,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-18 6PR M9","size":"10.5/80-18","category":"Auto","costPrice":345529,"salePrice":418090,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-18 14PR ATU 410TL","size":"10.5/80-18","category":"Auto","costPrice":404960,"salePrice":490002,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR R-4 MPT446 TL","size":"10.5-20","category":"Utilitario","costPrice":434400,"salePrice":525624,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR SK300 TL","size":"10-16.5","category":"Utilitario","costPrice":222969,"salePrice":269792,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR ML2 464 TL","size":"10-16.5","category":"Utilitario","costPrice":254269,"salePrice":307666,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR ML2 464 TL","size":"10-16.5","category":"Utilitario","costPrice":258273,"salePrice":312510,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR ML2 455 TL","size":"10-16.5","category":"Utilitario","costPrice":278637,"salePrice":337150,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"12PR L5A","size":"10-16.5","category":"Utilitario","costPrice":412710,"salePrice":499380,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"IF 1050/50R32 192D","size":"1050/50 R32","category":"Auto","costPrice":5130192,"salePrice":6207533,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR F2(3RIB) TT","size":"11.00-16","category":"Pesado/Agrícola","costPrice":280357,"salePrice":339232,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR F2(4RIB) TL","size":"11.00-16","category":"Pesado/Agrícola","costPrice":307674,"salePrice":372286,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-11.00-16 10PR MTF 212 TL","size":"11.00-16","category":"Pesado/Agrícola","costPrice":319659,"salePrice":386788,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR F-2 TT MTF 284","size":"11.00-16","category":"Pesado/Agrícola","costPrice":328622,"salePrice":397632,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"18PR MS 400TT","size":"11.00-20","category":"Pesado/Agrícola","costPrice":714818,"salePrice":864930,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"TT R1 8PR","size":"11.2-24","category":"Utilitario","costPrice":325829,"salePrice":394253,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8 PR MRT 329 TT","size":"11.2-24","category":"Auto","costPrice":339084,"salePrice":410291,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR R1 TT","size":"11.2-24","category":"Utilitario","costPrice":436969,"salePrice":528732,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR  MRT 329 TT","size":"11.2-28","category":"Utilitario","costPrice":418313,"salePrice":506159,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R1 TT","size":"11.2-28","category":"Utilitario","costPrice":458096,"salePrice":554296,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"6PR MRT 332 TL","size":"11.2-38","category":"Auto","costPrice":557319,"salePrice":674356,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR MRT 331 TT","size":"11.2-38","category":"Utilitario","costPrice":563323,"salePrice":681621,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-15.3 16PR MAW 200TL","size":"11.5/80-15.3","category":"Auto","costPrice":331548,"salePrice":401173,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"11L-14 8PR I1 TT","size":"11L-14","category":"Utilitario","costPrice":158536,"salePrice":191829,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"11L-15 TL F3 10PR","size":"11L-15","category":"Utilitario","costPrice":213890,"salePrice":258807,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"11L-15 8PR MTF 284TL (4RIB)","size":"11L-15","category":"Utilitario","costPrice":233104,"salePrice":282056,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"- 11L-16 12PR MIM 104 TL","size":"11L-16","category":"Utilitario","costPrice":217150,"salePrice":262751,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"11L-16 F3 12PR","size":"11L-16","category":"Utilitario","costPrice":261752,"salePrice":316721,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-11L-16 12PR F3 MIT 295 TL","size":"11L-16","category":"Utilitario","costPrice":266335,"salePrice":322265,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"SD600 TTF 20PR","size":"12.00-20","category":"Pesado/Agrícola","costPrice":1063453,"salePrice":1286778,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MRT 329 TL","size":"12.4-24","category":"Utilitario","costPrice":468204,"salePrice":566526,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT329 TT","size":"12.4-28","category":"Utilitario","costPrice":636526,"salePrice":770196,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329TT","size":"12.4-32","category":"Utilitario","costPrice":560550,"salePrice":678266,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329 TT","size":"12.4-38","category":"Utilitario","costPrice":743344,"salePrice":899446,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-18 12PR ATU 410TL.","size":"12.5/80-18","category":"Utilitario","costPrice":409939,"salePrice":496026,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-12.5L-15 12PR MIM104 TL","size":"12.5L-15","category":"Utilitario","costPrice":212233,"salePrice":256802,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12.5L-16 14PR MIM 104 TL","size":"12.5L-16","category":"Auto","costPrice":227494,"salePrice":275267,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR SK300 TL","size":"12-16.5","category":"Utilitario","costPrice":277440,"salePrice":335703,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR ML2 455TL","size":"12-16.5","category":"Utilitario","costPrice":322470,"salePrice":390188,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR ML2 464TL","size":"12-16.5","category":"Utilitario","costPrice":340990,"salePrice":412598,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"14PR L5B","size":"12-16.5","category":"Auto","costPrice":513392,"salePrice":621204,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"14PR L5A TL","size":"12-16.5","category":"Auto","costPrice":535884,"salePrice":648420,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"4PR M9","size":"13.00-20","category":"Auto","costPrice":493842,"salePrice":597549,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR L2/G2 TL","size":"13.00-24","category":"Auto","costPrice":724483,"salePrice":876625,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R1 TT","size":"13.6-16","category":"Utilitario","costPrice":436969,"salePrice":528732,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR R1 TT","size":"13.6-24","category":"Utilitario","costPrice":564257,"salePrice":682751,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"6PR R1 TT","size":"13.6-26","category":"Auto","costPrice":644784,"salePrice":780189,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT329 TT","size":"13.6-28","category":"Utilitario","costPrice":633975,"salePrice":767110,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR R1 TT","size":"13.6-28","category":"Utilitario","costPrice":718392,"salePrice":869254,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329 TT","size":"13.6-36","category":"Utilitario","costPrice":786930,"salePrice":952185,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"14PR MRT 329TT","size":"13.6-38","category":"Auto","costPrice":936649,"salePrice":1133345,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR TL L2/G2","size":"14.00-24","category":"Auto","costPrice":794342,"salePrice":961154,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"G/L2 16PR MG2402 TL","size":"14.00-24","category":"Auto","costPrice":846205,"salePrice":1023908,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"6PR MRT331TL","size":"14.9-24","category":"Auto","costPrice":503524,"salePrice":609264,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MRT331 TT","size":"14.9-24","category":"Utilitario","costPrice":576666,"salePrice":697766,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR MRT 329 TL","size":"14.9-24","category":"Utilitario","costPrice":646878,"salePrice":782723,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R4A","size":"14.9-24","category":"Utilitario","costPrice":679328,"salePrice":821986,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR MRT 329 TT","size":"14.9-24","category":"Utilitario","costPrice":766270,"salePrice":927187,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329 TT","size":"14.9-26","category":"Utilitario","costPrice":686898,"salePrice":831147,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 8PR","size":"14.9-28","category":"Utilitario","costPrice":648216,"salePrice":784342,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-14.9-28 12PR MRT 329 TT","size":"14.9-28","category":"Utilitario","costPrice":930798,"salePrice":1126265,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR R1 TT","size":"14.9-30","category":"Utilitario","costPrice":767742,"salePrice":928967,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR MRT329 TT","size":"14.9-30","category":"Utilitario","costPrice":867081,"salePrice":1049168,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"16PR L-2 TL ML2464","size":"14-17.5","category":"Auto","costPrice":574053,"salePrice":694605,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-17 18PR MAW 905TL","size":"15.0/55-17","category":"Utilitario","costPrice":386383,"salePrice":467523,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-24 12PR R1 TL (400/80-24)","size":"15.5/80-24","category":"Utilitario","costPrice":675820,"salePrice":817742,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"L2/E2 16PR TL","size":"15.5-25","category":"Auto","costPrice":801936,"salePrice":970342,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR MRT 329TT","size":"15.5-38","category":"Utilitario","costPrice":848546,"salePrice":1026741,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-15.5-38 10 PR MRT 329 TL","size":"15.5-38","category":"Auto","costPrice":904911,"salePrice":1094942,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"15x6.00-6 6PR MG54","size":"15x6.00-6","category":"Auto","costPrice":56357,"salePrice":68192,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"14PR MRT329 TT","size":"16.9-26","category":"Auto","costPrice":863188,"salePrice":1044457,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR R4A (440/80-28)","size":"16.9-28","category":"Utilitario","costPrice":851597,"salePrice":1030433,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329 TL","size":"16.9-28","category":"Utilitario","costPrice":906285,"salePrice":1096604,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR R1 TT","size":"16.9-34","category":"Utilitario","costPrice":1120134,"salePrice":1355362,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR R1 TT","size":"16.9-38","category":"Utilitario","costPrice":1260907,"salePrice":1525698,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-20 14PR L3 TL","size":"16/70-20","category":"Auto","costPrice":811854,"salePrice":982343,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-20-18PR R5 TL","size":"16/70-20","category":"Utilitario","costPrice":820647,"salePrice":992983,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-24 14PR L3 TTF","size":"16/70-24","category":"Auto","costPrice":887290,"salePrice":1073621,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"16x6.50-8 6PR MG54","size":"16x6.50-8","category":"Auto","costPrice":62421,"salePrice":75530,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"G/L2 16PR MG2419 TL","size":"17.5-25","category":"Auto","costPrice":939531,"salePrice":1136833,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR L2/G2 TL","size":"17.5-25","category":"Auto","costPrice":1008683,"salePrice":1220506,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR L5","size":"17.5-25","category":"Auto","costPrice":1738786,"salePrice":2103932,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"17.5L-24 10PR R4A TL","size":"17.5L-24","category":"Utilitario","costPrice":747234,"salePrice":904153,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"** L3 TL","size":"17.5R25","category":"Auto","costPrice":1978664,"salePrice":2394184,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"40PRL5S TL","size":"18.00-25","category":"Auto","costPrice":6268443,"salePrice":7584816,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12 PR MRT 329 TT","size":"18.4-26","category":"Auto","costPrice":957299,"salePrice":1158332,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR TL QZ702 R1 MARCHER","size":"18.4-30","category":"Utilitario","costPrice":737631,"salePrice":892534,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 10PR","size":"18.4-30","category":"Utilitario","costPrice":934448,"salePrice":1130681,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12 PR MRT 333 TT","size":"18.4-30","category":"Auto","costPrice":1542045,"salePrice":1865874,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR MRT 329TL","size":"18.4-34","category":"Utilitario","costPrice":1002084,"salePrice":1212522,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 329 TT","size":"18.4-34","category":"Utilitario","costPrice":1069373,"salePrice":1293941,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT333 TT","size":"18.4-34","category":"Utilitario","costPrice":1640690,"salePrice":1985235,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"18*7-8 SP900 STD","size":"18x7-8","category":"Auto","costPrice":167945,"salePrice":203213,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"18x8.50-8 4PR MG 41TL","size":"18x8.50-8","category":"Auto","costPrice":75581,"salePrice":91453,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-18x8.50-8 6PR TL MG41","size":"18x8.50-8","category":"Auto","costPrice":81953,"salePrice":99163,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"18x8.50-8 6PR MG 41TL","size":"18x8.50-8","category":"Auto","costPrice":81953,"salePrice":99163,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"18x8.50-8 6PR MG 54TL","size":"18x8.50-8","category":"Auto","costPrice":81953,"salePrice":99163,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-17 18PR MAW 977 (480/45-17)","size":"19.0/45-17","category":"Utilitario","costPrice":526215,"salePrice":636720,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 19.5L-24 12PR TL R4 SLR4","size":"19.5L-24","category":"Utilitario","costPrice":880698,"salePrice":1065645,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"19.5L-24 14PR R4 TL","size":"19.5L-24","category":"Auto","costPrice":972488,"salePrice":1176710,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-16 14PR L3 TT","size":"20.5/70-16","category":"Auto","costPrice":688507,"salePrice":833093,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR L2/E2 TL","size":"20.5-25","category":"Auto","costPrice":1616525,"salePrice":1955995,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"20PR L3/E3 TL","size":"20.5-25","category":"Auto","costPrice":1905557,"salePrice":2305723,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"20PR L5","size":"20.5-25","category":"Auto","costPrice":2810353,"salePrice":3400527,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR TL QZ702 R1 MARCHER","size":"20.8-38","category":"Utilitario","costPrice":1160712,"salePrice":1404461,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 10PR","size":"20.8-38","category":"Utilitario","costPrice":1285703,"salePrice":1555701,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-20.8-38 14PR MRT 329 TL","size":"20.8-38","category":"Auto","costPrice":1878485,"salePrice":2272967,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-10 6PR MG45 TL","size":"205/50-10","category":"Auto","costPrice":74435,"salePrice":90066,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 205/50-10 4PR TL CT993","size":"205/50-10","category":"Auto","costPrice":81830,"salePrice":99015,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"20x10.00-10 6PR MG54","size":"20x10.00-10","category":"Pesado/Agrícola","costPrice":115822,"salePrice":140145,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"21*8-9 SP900 STD","size":"21*8-9","category":"Auto","costPrice":280062,"salePrice":338874,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"21.5L-16.1 16PR MIM 104TL","size":"21.5L-16.1","category":"Auto","costPrice":915972,"salePrice":1108326,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"23*9-10 SP900 STD","size":"23*9-10","category":"Auto","costPrice":419257,"salePrice":507301,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"20PR TL QZ705 R1 MARCHER","size":"23.1-26","category":"Auto","costPrice":650200,"salePrice":786742,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-18PR TL R-3 FLR3 MARCHER","size":"23.1-26","category":"Utilitario","costPrice":750600,"salePrice":908226,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 18PR","size":"23.1-26","category":"Utilitario","costPrice":1020564,"salePrice":1234883,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"C2 12PR TL","size":"23.1-26","category":"Utilitario","costPrice":1750690,"salePrice":2118335,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 16PR","size":"23.1-26","category":"Auto","costPrice":1778099,"salePrice":2151499,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"18PR MR31067 TL","size":"23.1-26","category":"Utilitario","costPrice":2030742,"salePrice":2457198,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 333 TT","size":"23.1-26","category":"Utilitario","costPrice":2306494,"salePrice":2790858,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"16PR TL LS2 FORESTRY","size":"23.1-26","category":"Auto","costPrice":2947147,"salePrice":3566048,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 23.1-30 16PR Tl R3 FLR3","size":"23.1-30","category":"Auto","costPrice":1450586,"salePrice":1755209,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"/12 R1 TT SET","size":"23.1-30","category":"Auto","costPrice":1538252,"salePrice":1861285,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"16PR MRT 329TL","size":"23.1-30","category":"Auto","costPrice":1546400,"salePrice":1871144,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"16PR R3 TL","size":"23.1-30","category":"Auto","costPrice":1952431,"salePrice":2362441,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MRT 333 TT","size":"23.1-30","category":"Utilitario","costPrice":2398709,"salePrice":2902438,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"20PR W3E G2 TT/TL MARCHER","size":"23.5-25","category":"Auto","costPrice":799000,"salePrice":966790,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"20PR R1 TTF","size":"23.5-25","category":"Auto","costPrice":1386635,"salePrice":1677829,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16 PR L2/E2 TL","size":"23.5-25","category":"Auto","costPrice":2198318,"salePrice":2659964,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL L3/E3 20PR","size":"23.5-25","category":"Auto","costPrice":2271564,"salePrice":2748593,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"20PR L5","size":"23.5-25","category":"Auto","costPrice":3083526,"salePrice":3731067,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"23.5R25 ** L3 TL","size":"23.5R25","category":"Auto","costPrice":3999642,"salePrice":4839567,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"23*9-10 20PR SD6000 TTF","size":"23.9*9-10","category":"Auto","costPrice":198186,"salePrice":239805,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"RC950 130D TL  (9.5R36)","size":"230/95 R36","category":"Auto","costPrice":644381,"salePrice":779701,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"23X8.5-12 12PR ML2  464TL","size":"23x8.50-12","category":"Utilitario","costPrice":153270,"salePrice":185457,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"14PR R1 TT","size":"24.5-32","category":"Auto","costPrice":2000694,"salePrice":2420840,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"18PR R3 TL","size":"24.5-32","category":"Utilitario","costPrice":2165521,"salePrice":2620280,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"107A8 R1W (9.5R24)","size":"240/85 R24","category":"Auto","costPrice":378746,"salePrice":458283,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"(7.0) SP900 STD","size":"250-15","category":"Auto","costPrice":609377,"salePrice":737346,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"28PR L3/E3 TL","size":"26.5-25","category":"Utilitario","costPrice":3751222,"salePrice":4538978,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"26.5R25** L3B TL","size":"26.5R25","category":"Auto","costPrice":5220462,"salePrice":6316759,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"101D (6.50R16)","size":"260/70 R16","category":"Auto","costPrice":309026,"salePrice":373921,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"27*10-12 14PR SD6000","size":"27*10-12","category":"Auto","costPrice":256476,"salePrice":310336,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"28*9-15 SP900 STD","size":"28*9-15","category":"Auto","costPrice":549519,"salePrice":664918,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"116D (7.50R20)","size":"280/70 R20","category":"Pesado/Agrícola","costPrice":371382,"salePrice":449372,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"28L-26 18PR TL R-3 FLR3","size":"28L-26","category":"Utilitario","costPrice":1685431,"salePrice":2039372,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"28L-26 16PR R1W TL","size":"28L-26","category":"Auto","costPrice":2396115,"salePrice":2899300,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"28PR L3/E3 TL","size":"29.5-25","category":"Utilitario","costPrice":4741838,"salePrice":5737625,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"28PR L5","size":"29.5-25","category":"Utilitario","costPrice":7337554,"salePrice":8878441,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"32PR L5 TL","size":"29.5-25","category":"Auto","costPrice":7973590,"salePrice":9648044,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"20 SD6000","size":"3.00-15","category":"Auto","costPrice":464216,"salePrice":561701,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"30.5L-32 20PR TL R-3 FLR3","size":"30.5L-32","category":"Auto","costPrice":2583934,"salePrice":3126560,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"30.5L-32 20PR R3 TL","size":"30.5L-32","category":"Auto","costPrice":2919954,"salePrice":3533145,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-30.5L-32 18 PR MRT 334 TL","size":"30.5L-32","category":"Auto","costPrice":3097162,"salePrice":3747566,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL RC950 151A8/148D","size":"300/95 R46","category":"Auto","costPrice":916012,"salePrice":1108375,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"(315/70-25) 20PR","size":"300-15","category":"Auto","costPrice":471547,"salePrice":570572,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"31*9.50-16 4PR M9","size":"31*9.50-16","category":"Auto","costPrice":183535,"salePrice":222078,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"31 9.50-16 10PR M9 TT","size":"31*9.50-16","category":"Utilitario","costPrice":211234,"salePrice":255593,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"31x13.50-15 12PR MIM 104TL","size":"31x13.50-15","category":"Utilitario","costPrice":366964,"salePrice":444026,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"31x13.5-15 8PR TL I1","size":"31x13.5-15","category":"Utilitario","costPrice":351327,"salePrice":425105,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 31x15.5-15 12PR TL I-3 TRENK","size":"31x15.5-15","category":"Utilitario","costPrice":342603,"salePrice":414550,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-320/85R24 RRT 885 122A8/B (12.4R24)","size":"320/85 R24 (12.4-24)","category":"Auto","costPrice":632320,"salePrice":765108,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"R46 148D/151A8 RC 950 TL","size":"320/90 R46","category":"Auto","costPrice":1082350,"salePrice":1309644,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"146A8","size":"320/90 R46","category":"Auto","costPrice":1123259,"salePrice":1359144,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"127D (13.6R28)","size":"380/70 R28","category":"Auto","costPrice":841127,"salePrice":1017763,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-380/85R28 RRT 885 (14.9R28) 133A8/B","size":"380/85 R28 (14.9-28)","category":"Auto","costPrice":949739,"salePrice":1149184,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"(14.9R30) 135A8 TR1W","size":"380/85 R30","category":"Auto","costPrice":1114231,"salePrice":1348219,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-380/85R34 RRT 885 (14.9R34) 137A8/B","size":"380/85 R34 (14.9-34)","category":"Auto","costPrice":1144668,"salePrice":1385048,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL RC950 162A8/B & 159D (14.9R46)","size":"380/90 R46","category":"Auto","costPrice":1141049,"salePrice":1380669,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 STD","size":"4.00-8","category":"Auto","costPrice":108769,"salePrice":131610,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"-22.5 20PR TL I3E","size":"400/55-22.5","category":"Auto","costPrice":641226,"salePrice":775883,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-15.5 18PR F-3 TL MAW977","size":"400/60-15.5","category":"Utilitario","costPrice":352720,"salePrice":426791,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-15.5 18PR I-3E TL","size":"400/60-15.5","category":"Utilitario","costPrice":370536,"salePrice":448349,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"158A8 IMP 100 TL","size":"400/60 R18","category":"Auto","costPrice":670655,"salePrice":811492,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 405/70-20 14PR TL R4/I3 INTR4","size":"405/70-20","category":"Auto","costPrice":528588,"salePrice":639592,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"Roadhiker 405/70-24 14PR TL R4/I3 INTR4","size":"405/70-24","category":"Auto","costPrice":563729,"salePrice":682112,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"158A8/B IMP 100 TL","size":"440/55 R18","category":"Auto","costPrice":704154,"salePrice":852027,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL R-1 TRACPRO 668 145A8/142B (18.4R30)","size":"460/85 R30","category":"Auto","costPrice":763200,"salePrice":923472,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-30 R1W  (18.4R30)","size":"460/85 R30","category":"Auto","costPrice":1385022,"salePrice":1675877,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"RRT 885 149A8/B (18.4R38)","size":"460/85 R38","category":"Auto","costPrice":1713731,"salePrice":2073615,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"136D R1W (14.9R28)","size":"480/65 R28","category":"Auto","costPrice":1189427,"salePrice":1439207,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"141D R-1W TL","size":"480/70 R30","category":"Auto","costPrice":1477856,"salePrice":1788206,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"6PR M9","size":"5.00-12","category":"Auto","costPrice":88444,"salePrice":107017,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR TTF NHS W-9C","size":"5.00-8","category":"Utilitario","costPrice":63642,"salePrice":77006,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR LUG (K) MFL 437","size":"5.00-8","category":"Utilitario","costPrice":76330,"salePrice":92360,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR SD6000","size":"5.00-8","category":"Utilitario","costPrice":79043,"salePrice":95642,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 STD","size":"5.00-8","category":"Auto","costPrice":137892,"salePrice":166849,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-22.5 TL I3 16AR","size":"500/45-22.5","category":"Auto","costPrice":681435,"salePrice":824537,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-22.5 16PR PRINCE 338 TL","size":"500/60-22.5","category":"Auto","costPrice":623160,"salePrice":754024,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-520/85R38 RRT 885 170A8 / 167B (20.8R38","size":"520/85 R38","category":"Auto","costPrice":2351207,"salePrice":2844960,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-520/85R42 RRT 885 167A8/B","size":"520/85 R42","category":"Auto","costPrice":2655467,"salePrice":3213115,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-520/85R46 RRT 885 158A8/B","size":"520/85 R46","category":"Auto","costPrice":2634982,"salePrice":3188328,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"142D R-1W TL","size":"540/65 R28","category":"Auto","costPrice":1514497,"salePrice":1832542,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"142D TR-1W TL","size":"540/65 R28","category":"Auto","costPrice":1725763,"salePrice":2088174,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-6PR TT R-1 QZ-702 MARCHER","size":"6.00-12","category":"Auto","costPrice":102134,"salePrice":123582,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"6PR R1","size":"6.00-14","category":"Auto","costPrice":135339,"salePrice":163761,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"6PR F2(3RIB) TL","size":"6.00-16","category":"Auto","costPrice":101273,"salePrice":122541,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MTF 212TT (F2)","size":"6.00-16","category":"Utilitario","costPrice":103054,"salePrice":124695,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"- 6.00-16 8PR MRT 356 TT","size":"6.00-16","category":"Utilitario","costPrice":106776,"salePrice":129199,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MAW203TL","size":"6.00-16","category":"Utilitario","costPrice":119899,"salePrice":145078,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R1 TT","size":"6.00-16","category":"Utilitario","costPrice":139858,"salePrice":169228,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR LUG (K)","size":"6.00-9","category":"Utilitario","costPrice":110382,"salePrice":133562,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"12PR SD6000 TTF","size":"6.00-9","category":"Utilitario","costPrice":113972,"salePrice":137906,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 MAC","size":"6.00-9","category":"Auto","costPrice":230284,"salePrice":278644,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL F2 6PR","size":"6.50-16","category":"Auto","costPrice":121738,"salePrice":147303,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-6.50-16 8PR MTF 212 TL","size":"6.50-16","category":"Utilitario","costPrice":128563,"salePrice":155561,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"I1 8PR MIM104 TT","size":"6.50-16","category":"Utilitario","costPrice":130663,"salePrice":158102,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TT R1 6PR","size":"6.50-16","category":"Auto","costPrice":136462,"salePrice":165119,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"10PR MTF 257TT","size":"6.50-20","category":"Utilitario","costPrice":203747,"salePrice":246533,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-22.5 18PR SC I3 TL MARCHER","size":"600/50-22.5","category":"Utilitario","costPrice":520600,"salePrice":629926,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-22.5 TL I3 16PR","size":"600/50-22.5","category":"Auto","costPrice":772221,"salePrice":934387,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-22.5 16PR PRINCE 338 TL","size":"600/55-22","category":"Auto","costPrice":1108127,"salePrice":1340833,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"147D R1W TL","size":"600/65 R28","category":"Auto","costPrice":1915384,"salePrice":2317614,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"153D R-1W TL","size":"600/65 R38","category":"Auto","costPrice":2324351,"salePrice":2812465,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"153D TR-1W (16.9R38)","size":"600/65 R38","category":"Auto","costPrice":2483348,"salePrice":3004851,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"160D R-1W TL","size":"620/70 R42 160D","category":"Auto","costPrice":3263877,"salePrice":3949291,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"157D R1W","size":"650/65 R38","category":"Auto","costPrice":2736303,"salePrice":3310927,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"158D R-1W TL","size":"650/65 R42","category":"Auto","costPrice":2993361,"salePrice":3621966,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"169D/172A8 RRT650 TL","size":"650/75 R32","category":"Auto","costPrice":2844689,"salePrice":3442074,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"169 D (20.8R38)","size":"650/75 R38","category":"Auto","costPrice":3849094,"salePrice":4657403,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"12PR SD6000 TTF","size":"7.00-12","category":"Utilitario","costPrice":193598,"salePrice":234254,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 MAC","size":"7.00-12","category":"Auto","costPrice":414605,"salePrice":501672,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"15 SD6000","size":"7.00-15","category":"Auto","costPrice":236561,"salePrice":286239,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 STD","size":"7.00-15","category":"Auto","costPrice":457134,"salePrice":553132,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"SP900 STD","size":"7.50-15","category":"Auto","costPrice":587129,"salePrice":710426,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R-1 TL MIM 374","size":"7.50-16","category":"Utilitario","costPrice":148118,"salePrice":179223,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR I-1 TT MIM 104","size":"7.50-16","category":"Utilitario","costPrice":153787,"salePrice":186082,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"12PR MIM 104TT","size":"7.50-16","category":"Utilitario","costPrice":153787,"salePrice":186082,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"6PR M9","size":"7.50-16","category":"Auto","costPrice":170382,"salePrice":206162,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"10PR F2 (3RIB) TL","size":"7.50-16","category":"Utilitario","costPrice":170985,"salePrice":206892,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-7.50-16 10PR MTF 212 TL","size":"7.50-16","category":"Utilitario","costPrice":175662,"salePrice":212551,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR R1W TT","size":"7.50-16","category":"Utilitario","costPrice":183238,"salePrice":221718,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MIM 374TL","size":"7.50-18","category":"Utilitario","costPrice":163862,"salePrice":198273,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR MTF 212 TL","size":"7.50-18","category":"Utilitario","costPrice":188123,"salePrice":227629,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MTF 212TT","size":"7.50-20","category":"Utilitario","costPrice":205794,"salePrice":249010,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-700/40-22.5 18PR PRINCE 338 TL","size":"700/40-22.5","category":"Utilitario","costPrice":1528196,"salePrice":1849117,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"173D (20.8R42)","size":"710/70 R42","category":"Auto","costPrice":4330671,"salePrice":5240112,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-710/70R42 180A8/177D RRT770 TL (20.8R42","size":"710/70 R42","category":"Auto","costPrice":4370986,"salePrice":5288894,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"171D TR-1W TL","size":"750/65 R26","category":"Auto","costPrice":3423147,"salePrice":4142007,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"8PR R1 TT","size":"8.00-18","category":"Utilitario","costPrice":232794,"salePrice":281680,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"6PR R-1 TT MRT 329 (260/80-20)","size":"8.00-20","category":"Auto","costPrice":190666,"salePrice":230705,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR SD6000","size":"8.25-15","category":"Auto","costPrice":332846,"salePrice":402744,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"(6.5) SP900 STD","size":"8.25-15","category":"Auto","costPrice":920765,"salePrice":1114126,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"16PR RG600A TTF SET","size":"8.25-16","category":"Auto","costPrice":396346,"salePrice":479578,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"6PR R1 TT","size":"8.3-20","category":"Auto","costPrice":239576,"salePrice":289887,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"12PR R-1 TT MRT 329","size":"8.3-24","category":"Utilitario","costPrice":194424,"salePrice":235253,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"TL RRT650 181A8/178 (30.5LR32)","size":"800/65 R32","category":"Auto","costPrice":3283467,"salePrice":3972995,"margin":0,"stock":0,"minStock":1},{"brand":"Armour","model":"IF 800/70R38 184D TR-1W TL","size":"800/70 R38","category":"Auto","costPrice":5235621,"salePrice":6335101,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"14PR SD6000 TTF","size":"9.00-20","category":"Auto","costPrice":542942,"salePrice":656959,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"-15 6PR C1 TL","size":"9.5/65-15","category":"Auto","costPrice":353941,"salePrice":428269,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR R-1 TL MIM 374","size":"9.50-16","category":"Utilitario","costPrice":222969,"salePrice":269792,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"8PR TT R-1W QZ-702B","size":"9.50-18","category":"Utilitario","costPrice":485884,"salePrice":587919,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR R1 TT","size":"9.5-20","category":"Utilitario","costPrice":341734,"salePrice":413498,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"8PR MRT 329TL","size":"9.5-24","category":"Utilitario","costPrice":279650,"salePrice":338377,"margin":0,"stock":0,"minStock":1},{"brand":"Corral","model":"10PR MRT 329 TT","size":"9.5-36","category":"Utilitario","costPrice":447875,"salePrice":541928,"margin":0,"stock":0,"minStock":1},{"brand":"MRL","model":"-9.5L-15 8PR MIM 104 TL","size":"9.5L-15","category":"Utilitario","costPrice":177576,"salePrice":214867,"margin":0,"stock":0,"minStock":1},{"brand":"Bull Vial","model":"205C OWL  TERRAMAX A/T","size":"110/108Q R16","category":"Utilitario","costPrice":150649,"salePrice":195844,"margin":0,"stock":0,"minStock":2},{"brand":"Bull Vial","model":"111T XL TERRAMAX A/T","size":"245/70 R16","category":"Camioneta/SUV","costPrice":155068,"salePrice":201588,"margin":0,"stock":0,"minStock":2},{"brand":"Bull Vial","model":"116S TERRAMAX A/T","size":"265/75 R16","category":"Camioneta/SUV","costPrice":194762,"salePrice":253191,"margin":0,"stock":0,"minStock":2},{"brand":"Bull Vial","model":"114T TERRAMAX A/T","size":"265/65 R18","category":"Camioneta/SUV","costPrice":179529,"salePrice":233388,"margin":0,"stock":0,"minStock":2},{"brand":"Bull Vial","model":"-9 10PR TTF QH207 PACK","size":"6.00","category":"Utilitario","costPrice":82020,"salePrice":106626,"margin":0,"stock":0,"minStock":2},{"brand":"SAILUN","model":"8PR 112/110R COMMERCIO VX1","size":"225/70 R15","category":"Utilitario","costPrice":134745,"salePrice":175169,"margin":0,"stock":0,"minStock":2},{"brand":"Bull Vial","model":"95V XL ATREZZO ELITE","size":"205/55 R17","category":"Auto","costPrice":98917,"salePrice":128592,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-16 QH621 8PR TT F-2","size":"7.50","category":"Utilitario","costPrice":129101,"salePrice":167831,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-15.5 QH643","size":"400/60","category":"Auto","costPrice":323479,"salePrice":420523,"margin":0,"stock":0,"minStock":2},{"brand":"SAILUN","model":"8PR 112/110R COMMER","size":"225/65 R16","category":"Utilitario","costPrice":153505,"salePrice":199557,"margin":0,"stock":0,"minStock":2},{"brand":"SAILUN","model":"8PR 107/105R COMMER","size":"195/75 R16","category":"Utilitario","costPrice":139750,"salePrice":181675,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-8 10PR TTF QH201 PACK","size":"5.00","category":"Utilitario","costPrice":69352,"salePrice":90158,"margin":0,"stock":0,"minStock":2},{"brand":"SAILUN","model":"107S TERRAMAX A/T","size":"245/65 R17","category":"Camioneta/SUV","costPrice":159601,"salePrice":207481,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-9 10PR TTF QH207 PACK","size":"6.00","category":"Utilitario","costPrice":82020,"salePrice":106626,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-10 12PR TTF QH207 PACK","size":"6.50","category":"Utilitario","costPrice":100576,"salePrice":130749,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-12 14PR TTF QH207 PACK","size":"7.00","category":"Auto","costPrice":149623,"salePrice":194510,"margin":0,"stock":0,"minStock":2},{"brand":"SAILUN","model":"14PR 122/118L S696 TT","size":"7.50R16","category":"Auto","costPrice":222979,"salePrice":289873,"margin":0,"stock":0,"minStock":2},{"brand":"KAPSEN","model":"-18PR HS268 149/146 K","size":"10.00R20","category":"Pesado/Agrícola","costPrice":453477,"salePrice":589520,"margin":0,"stock":0,"minStock":2},{"brand":"KAPSEN","model":"-16PR HS268 144/142 K","size":"9.00R20","category":"Pesado/Agrícola","costPrice":420932,"salePrice":547212,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-36 QH666","size":"12.4","category":"Auto","costPrice":669820,"salePrice":870766,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-28 QH611N 12PR TT R-1","size":"16.9","category":"Utilitario","costPrice":734036,"salePrice":954247,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-24 QH611N 12PR TT R-1","size":"14.9","category":"Utilitario","costPrice":492897,"salePrice":640766,"margin":0,"stock":0,"minStock":2},{"brand":"ROADGUIDER","model":"-18 QH621N 12PR TT F-2","size":"7.50","category":"Utilitario","costPrice":157575,"salePrice":204848,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"GREENMAX VAN","size":"195/75 R16C","category":"Utilitario","costPrice":173000,"salePrice":207600,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"89V COMFORT MASTER","size":"195/60 R16","category":"Auto","costPrice":108000,"salePrice":129600,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"94T COMFORT MASTER","size":"205/70 R14","category":"Auto","costPrice":111000,"salePrice":133200,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"106V SPORT MASTER C/S","size":"225/65 R17","category":"Auto","costPrice":137906,"salePrice":165487,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"106H GREENMAX 4x4","size":"235/70 R16","category":"Camioneta/SUV","costPrice":143659,"salePrice":172391,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"93W COMFORT MASTER","size":"205/50 R17","category":"Auto","costPrice":130935,"salePrice":157122,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"91V COMFORT MASTER","size":"205/55 R16","category":"Auto","costPrice":73903,"salePrice":88684,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"95V COMFORT MASTER","size":"215/50 R17","category":"Auto","costPrice":119080,"salePrice":142896,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"94V COMFORT MASTER","size":"215/55 R17","category":"Auto","costPrice":119916,"salePrice":143899,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"98W GREENMAX","size":"225/50 R17","category":"Auto","costPrice":113624,"salePrice":136349,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"99V SPORT MASTER e","size":"225/50 R18","category":"Auto","costPrice":170886,"salePrice":205063,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"98V GREENMAX 4X4 HP","size":"225/55 R18","category":"Camioneta/SUV","costPrice":146792,"salePrice":176150,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"99H GREEN-MAX","size":"225/55 R19","category":"Auto","costPrice":140893,"salePrice":169072,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"106V GRIP MASTER","size":"225/65 R17","category":"Auto","costPrice":137900,"salePrice":165480,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"98Y GREENMAX","size":"235/45 R18","category":"Auto","costPrice":169876,"salePrice":203851,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"99V GRIP MASTER","size":"235/45 R19","category":"Auto","costPrice":184966,"salePrice":221959,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"104V GREENMAX 4x4 HP","size":"235/55 R18","category":"Camioneta/SUV","costPrice":138780,"salePrice":166536,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"105V CROSSWIND 4X4","size":"235/55 R19","category":"Camioneta/SUV","costPrice":158788,"salePrice":190546,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"100H GRIP MASTER","size":"235/60 R16","category":"Auto","costPrice":117347,"salePrice":140816,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"111H GREENMAX 4X4 HP","size":"245/70 R16","category":"Camioneta/SUV","costPrice":143719,"salePrice":172463,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"111Q CROSSWIND AT-2","size":"245/70 R16","category":"Camioneta/SUV","costPrice":205466,"salePrice":246559,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"109V GRIP MASTER C/S","size":"255/50 R20","category":"Pesado/Agrícola","costPrice":162140,"salePrice":194568,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"114Q CROSSWIND AT-2","size":"265/60 R18","category":"Camioneta/SUV","costPrice":205186,"salePrice":246223,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"112T CROSSWIND AT","size":"265/70 R15","category":"Camioneta/SUV","costPrice":150293,"salePrice":180352,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"112H GRIP MASTER","size":"265/70 R16","category":"Camioneta/SUV","costPrice":175697,"salePrice":210836,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"116Q CROSSWIND AT-2","size":"265/70 R16","category":"Camioneta/SUV","costPrice":216680,"salePrice":260016,"margin":0,"stock":0,"minStock":2},{"brand":"Linglong","model":"CROSSWIND MT","size":"265/70 R17","category":"Camioneta/SUV","costPrice":236190,"salePrice":283428,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"165/70 R13","category":"Auto","costPrice":56401,"salePrice":70501,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"165/70 R14","category":"Auto","costPrice":58044,"salePrice":72555,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"175/65 R14","category":"Auto","costPrice":60556,"salePrice":75695,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"175/70 R13","category":"Auto","costPrice":65972,"salePrice":82465,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"175/70 R14","category":"Auto","costPrice":66184,"salePrice":82730,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"185/60 R14","category":"Auto","costPrice":62110,"salePrice":77638,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"185/60 R15","category":"Auto","costPrice":66750,"salePrice":83438,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"185/65 R14","category":"Auto","costPrice":66410,"salePrice":83012,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"185/65 R15","category":"Auto","costPrice":73829,"salePrice":92286,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"185/70 R14","category":"Auto","costPrice":70927,"salePrice":88659,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MA349","size":"195/50 R16","category":"Auto","costPrice":73121,"salePrice":91401,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"195/55 R15","category":"Auto","costPrice":67765,"salePrice":84706,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"195/55 R16","category":"Auto","costPrice":72578,"salePrice":90722,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"195/60 R15","category":"Auto","costPrice":72460,"salePrice":90575,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"195/65 R15","category":"Auto","costPrice":75457,"salePrice":94321,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP270","size":"205/55 R16","category":"Auto","costPrice":75150,"salePrice":93938,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"205/65 R15","category":"Auto","costPrice":89590,"salePrice":111988,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"205/65 R15","category":"Auto","costPrice":107664,"salePrice":134580,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP071","size":"215/65 R16","category":"Auto","costPrice":103867,"salePrice":129834,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MA349","size":"225/45Z","category":"Deportivo","costPrice":98037,"salePrice":122546,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"265/65 R17","category":"Camioneta/SUV","costPrice":165302,"salePrice":206628,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"235/75 R15","category":"Camioneta/SUV","costPrice":130972,"salePrice":163715,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"165/70 R13","category":"Auto","costPrice":59222,"salePrice":71066,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Ecology","size":"165/70 R13","category":"Auto","costPrice":60686,"salePrice":72823,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Ecology","size":"175/70 R13","category":"Auto","costPrice":71235,"salePrice":85482,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"175/70 R13","category":"Auto","costPrice":68336,"salePrice":82003,"margin":0,"stock":0,"minStock":2},{"brand":"Ovation","model":"Ovation","size":"175/65 R14","category":"Auto","costPrice":68122,"salePrice":81747,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"175/65 R14","category":"Auto","costPrice":69311,"salePrice":83173,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"175/65 R14","category":"Auto","costPrice":63585,"salePrice":76301,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"175/70 R14","category":"Auto","costPrice":76714,"salePrice":92057,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"185/60 R14","category":"Auto","costPrice":78287,"salePrice":93945,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"185/60 R14","category":"Auto","costPrice":65216,"salePrice":78259,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"185/60 R14","category":"Auto","costPrice":71235,"salePrice":85482,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"185/65 R14","category":"Auto","costPrice":77029,"salePrice":92435,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"185/65 R14","category":"Auto","costPrice":69731,"salePrice":83677,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"185/70 R14","category":"Auto","costPrice":82194,"salePrice":98633,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"195/60 R15","category":"Auto","costPrice":84960,"salePrice":101953,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Ecology","size":"195/65 R15","category":"Auto","costPrice":91029,"salePrice":109235,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"195/65 R15","category":"Auto","costPrice":80378,"salePrice":96454,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"205/65 R15","category":"Auto","costPrice":108858,"salePrice":130629,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"205/70 R15","category":"Auto","costPrice":152483,"salePrice":182979,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/75 R15","category":"Camioneta/SUV","costPrice":167797,"salePrice":201356,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"185/60 R15","category":"Auto","costPrice":68710,"salePrice":82452,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"195/55 R15","category":"Auto","costPrice":74112,"salePrice":88934,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"185/65 R15","category":"Auto","costPrice":71735,"salePrice":86082,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"185/65 R15","category":"Auto","costPrice":84960,"salePrice":101953,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/75 R16","category":"Camioneta/SUV","costPrice":286989,"salePrice":344387,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"205/55 R16","category":"Auto","costPrice":95186,"salePrice":114223,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"205/60 R16","category":"Auto","costPrice":143785,"salePrice":172542,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"215/65 R16","category":"Auto","costPrice":195439,"salePrice":234527,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"215/75 R16","category":"Auto","costPrice":161117,"salePrice":193341,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/65 R16","category":"Auto","costPrice":160637,"salePrice":192765,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/65 R16","category":"Camioneta/SUV","costPrice":168684,"salePrice":202421,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Fastway","size":"195/55 R16","category":"Auto","costPrice":89006,"salePrice":106807,"margin":0,"stock":0,"minStock":2},{"brand":"Milever","model":"MP","size":"215/65 R16","category":"Auto","costPrice":109061,"salePrice":130873,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Ecology","size":"235/60 R16","category":"Auto","costPrice":125097,"salePrice":150117,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"245/70 R16","category":"Camioneta/SUV","costPrice":242560,"salePrice":291071,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"255/70 R16","category":"Camioneta/SUV","costPrice":273542,"salePrice":328250,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/70 R16","category":"Camioneta/SUV","costPrice":273637,"salePrice":328364,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/75 R16","category":"Auto","costPrice":203516,"salePrice":244220,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"195/75 R16","category":"Auto","costPrice":149370,"salePrice":179244,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"205/75 R16","category":"Auto","costPrice":156838,"salePrice":188206,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Ecology","size":"225/65 R17","category":"Auto","costPrice":153738,"salePrice":184485,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/65 R17","category":"Auto","costPrice":212493,"salePrice":254992,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"215/75 R17","category":"Auto","costPrice":221920,"salePrice":266304,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/75 R17","category":"Camioneta/SUV","costPrice":207208,"salePrice":248650,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"215/50 R17","category":"Auto","costPrice":130699,"salePrice":156838,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/45 R17","category":"Deportivo","costPrice":121372,"salePrice":145646,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/50 R17","category":"Auto","costPrice":136300,"salePrice":163560,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/65 R17","category":"Camioneta/SUV","costPrice":287286,"salePrice":344743,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/70 R17","category":"Camioneta/SUV","costPrice":312118,"salePrice":374542,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"285/70 R17","category":"Auto","costPrice":326950,"salePrice":392339,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"205/55 R17","category":"Auto","costPrice":136300,"salePrice":163560,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"215/65 R17","category":"Auto","costPrice":190447,"salePrice":228536,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/60 R18","category":"Auto","costPrice":181111,"salePrice":217333,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"285/65 R18","category":"Auto","costPrice":337909,"salePrice":405490,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/40 R18","category":"Deportivo","costPrice":126964,"salePrice":152357,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"225/55 R18","category":"Auto","costPrice":154971,"salePrice":185966,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/45 R18","category":"Auto","costPrice":164307,"salePrice":197168,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"235/50 R18","category":"Auto","costPrice":178012,"salePrice":213615,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/60 R18","category":"Auto","costPrice":207251,"salePrice":248701,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/65 R18","category":"Camioneta/SUV","costPrice":286766,"salePrice":344119,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/70 R18","category":"Camioneta/SUV","costPrice":343348,"salePrice":412018,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"255/55 R19","category":"Auto","costPrice":283113,"salePrice":339735,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/50 R20","category":"Pesado/Agrícola","costPrice":199782,"salePrice":239739,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"265/60 R20","category":"Pesado/Agrícola","costPrice":323296,"salePrice":387956,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":412869,"salePrice":495443,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"385/65 R22","category":"Pesado/Agrícola","costPrice":509177,"salePrice":611013,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":367609,"salePrice":441131,"margin":0,"stock":0,"minStock":2},{"brand":"Xbri","model":"Sport","size":"315/80 R22","category":"Pesado/Agrícola","costPrice":441201,"salePrice":529441,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA HP","size":"205/55 R16","category":"Auto","costPrice":205439,"salePrice":127372,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA HP","size":"215/50 R17","category":"Auto","costPrice":230271,"salePrice":142768,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA HP","size":"225/45 R17","category":"Deportivo","costPrice":248409,"salePrice":154014,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"185/60 R15","category":"Auto","costPrice":159454,"salePrice":98862,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"195/55 R15","category":"Auto","costPrice":164619,"salePrice":102064,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"185/55 R16","category":"Auto","costPrice":185757,"salePrice":115169,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"195/50 R16","category":"Auto","costPrice":201068,"salePrice":124662,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"195/55 R16","category":"Auto","costPrice":186720,"salePrice":115767,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"205/60 R16","category":"Auto","costPrice":210110,"salePrice":130268,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA","size":"215/55 R16","category":"Auto","costPrice":242291,"salePrice":150220,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SPORT","size":"205/40 R17","category":"Deportivo","costPrice":190422,"salePrice":118061,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SPORT","size":"215/45 R17","category":"Deportivo","costPrice":239818,"salePrice":148687,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMA PININFARINA SPORT","size":"225/50 R17","category":"Auto","costPrice":264445,"salePrice":163956,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SPORT","size":"225/40 R18","category":"Deportivo","costPrice":294237,"salePrice":182427,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SPORT","size":"235/40 R18","category":"Deportivo","costPrice":335853,"salePrice":208229,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA SPORT","size":"185/60 R15","category":"Auto","costPrice":143415,"salePrice":88917,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA SPORT","size":"185/65 R15","category":"Auto","costPrice":157756,"salePrice":97809,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA SPORT","size":"195/55 R15","category":"Auto","costPrice":153850,"salePrice":95387,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA SPORT","size":"195/60 R15","category":"Auto","costPrice":164406,"salePrice":101932,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA SPORT","size":"195/65 R15","category":"Auto","costPrice":153980,"salePrice":95467,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"165/70 R13","category":"Auto","costPrice":99280,"salePrice":61554,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"175/70 R13","category":"Auto","costPrice":109947,"salePrice":68167,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"175/65 R14","category":"Auto","costPrice":108496,"salePrice":67267,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"175/70 R14","category":"Auto","costPrice":116556,"salePrice":72265,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"185/60 R14","category":"Auto","costPrice":127275,"salePrice":78911,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"185/65 R14","category":"Auto","costPrice":119911,"salePrice":74345,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"185/55 R15","category":"Auto","costPrice":164927,"salePrice":102255,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"SENTIVA AR-360","size":"205/55 R16","category":"Auto","costPrice":192299,"salePrice":119225,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"165/70 R13","category":"Auto","costPrice":90053,"salePrice":55833,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"175/70 R13","category":"Auto","costPrice":99731,"salePrice":61833,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"185/70 R13","category":"Auto","costPrice":110308,"salePrice":68391,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"165/70 R14","category":"Auto","costPrice":106825,"salePrice":66232,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"175/65 R14","category":"Auto","costPrice":101134,"salePrice":62703,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"175/70 R14","category":"Auto","costPrice":108646,"salePrice":67360,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"185/70 R14","category":"Auto","costPrice":110669,"salePrice":68615,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PRESTIVA","size":"195/70 R14","category":"Auto","costPrice":115288,"salePrice":71479,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AR-300","size":"145/80 R13","category":"Auto","costPrice":80162,"salePrice":49701,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AR-300","size":"155/80 R13","category":"Auto","costPrice":83297,"salePrice":51644,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV HP","size":"205/70 R16","category":"Auto","costPrice":214741,"salePrice":122402,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV HP","size":"215/55 R18","category":"Auto","costPrice":269349,"salePrice":180464,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV HP","size":"225/55 R18","category":"Auto","costPrice":209760,"salePrice":140539,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV","size":"235/60 R16","category":"Auto","costPrice":215601,"salePrice":144452,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV","size":"225/60 R17","category":"Auto","costPrice":330304,"salePrice":221304,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV","size":"225/65 R17","category":"Auto","costPrice":299669,"salePrice":200778,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV","size":"235/55 R17","category":"Auto","costPrice":317995,"salePrice":213057,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"EXIMIA PININFARINA SUV","size":"235/65 R17","category":"Camioneta/SUV","costPrice":319203,"salePrice":213866,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 89R  RR H/T","size":"165/70 R14","category":"Auto","costPrice":136049,"salePrice":91153,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"108/104T RR H/T SERIE 2","size":"225/75 R15","category":"Auto","costPrice":219782,"salePrice":147254,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 112/110T  RR H/T SERIE 2","size":"255/70 R15","category":"Camioneta/SUV","costPrice":242372,"salePrice":162389,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"110/107R  RR H/T SERIE 2","size":"235/75 R15","category":"Camioneta/SUV","costPrice":220185,"salePrice":147524,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"110/107T  RR H/T SERIE 2","size":"235/70 R16","category":"Auto","costPrice":277289,"salePrice":185784,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"120/116Q  RR H/T SERIE 2","size":"235/85 R16","category":"Auto","costPrice":284427,"salePrice":190566,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR AT SERIE 4","size":"215/80 R16","category":"Camioneta/SUV","costPrice":238209,"salePrice":159600,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR AT SERIE 4","size":"225/75 R16","category":"Auto","costPrice":263831,"salePrice":176767,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"113/110T RR AT SERIE 4","size":"245/70 R16","category":"Camioneta/SUV","costPrice":254644,"salePrice":145147,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"115/112T RR AT SERIE 4","size":"255/70 R16","category":"Camioneta/SUV","costPrice":286525,"salePrice":163320,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"117/114T RR AT SERIE 4","size":"265/70 R16","category":"Camioneta/SUV","costPrice":290402,"salePrice":165529,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"105/102T RR AT SERIE 4","size":"245/65 R17","category":"Camioneta/SUV","costPrice":299126,"salePrice":200414,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR A/T SERIE 4","size":"255/65 R17","category":"Auto","costPrice":308700,"salePrice":206829,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"REINF. RR AT SERIE 4","size":"265/65 R17","category":"Camioneta/SUV","costPrice":302376,"salePrice":172354,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR AT/R SERIE 2","size":"215/75 R15","category":"Auto","costPrice":219556,"salePrice":147102,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"(LT30X9.5R15) 110/107R RR AT/R SERIE 2","size":"235/75 R15","category":"Camioneta/SUV","costPrice":240123,"salePrice":160882,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"(LT31X10.5R15) 109R  RR AT/R SERIE 2","size":"255/75 R15","category":"Auto","costPrice":323721,"salePrice":216893,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR AT/R SERIE 2","size":"215/80 R16","category":"Camioneta/SUV","costPrice":249781,"salePrice":167353,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"113/110T RR AT/R SERIE 4","size":"245/70 R16","category":"Camioneta/SUV","costPrice":272471,"salePrice":155308,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"115/112T RR AT/R SERIE 4","size":"255/70 R16","category":"Camioneta/SUV","costPrice":306582,"salePrice":174752,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"117/114T RR AT/R SERIE 4","size":"265/70 R16","category":"Camioneta/SUV","costPrice":310730,"salePrice":177116,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"123/120R RR AT/R SERIE 4","size":"265/75 R16","category":"Camioneta/SUV","costPrice":377404,"salePrice":252861,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 108/106S RR AT/R SERIE 4","size":"225/70 R17","category":"Auto","costPrice":273820,"salePrice":156077,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"REINF. RR AT/R SERIE 4","size":"265/65 R17","category":"Camioneta/SUV","costPrice":323545,"salePrice":184421,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"REFORZADA RANGE RUNNER AT/R SERIE 4","size":"255/60 R18","category":"Auto","costPrice":286483,"salePrice":163295,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RANGE RUNNER AT/R SERIE 4","size":"265/60 R18","category":"Auto","costPrice":301739,"salePrice":171991,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"(LT30x9.5R15) 110/109Q RANGE RUNNER MT","size":"235/75 R15","category":"Camioneta/SUV","costPrice":252626,"salePrice":169259,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"RR MT SERIE 2","size":"215/80 R16","category":"Camioneta/SUV","costPrice":262604,"salePrice":175944,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"117/114Q RR MT SERIE 4","size":"265/70 R16","category":"Camioneta/SUV","costPrice":326266,"salePrice":185972,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C RR MTP 108/106 S","size":"225/70 R17","category":"Auto","costPrice":287511,"salePrice":192632,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PLENTIA CROSS","size":"205/60 R15","category":"Auto","costPrice":189809,"salePrice":127172,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PLENTIA CROSS","size":"205/60 R16","category":"Auto","costPrice":223033,"salePrice":149432,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"PLENTIA CROSS","size":"215/65 R16","category":"Auto","costPrice":239862,"salePrice":160708,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 90/88T  AVANTIA  AR-410","size":"175/65 R14","category":"Auto","costPrice":139282,"salePrice":93319,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AVANTIA  AR-410","size":"175/70 R14","category":"Auto","costPrice":151819,"salePrice":101719,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 104/102R AVANTIA  AR-410","size":"195/70 R15","category":"Auto","costPrice":220846,"salePrice":147967,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 106/104R AVANTIA  AR-410","size":"205/70 R15","category":"Auto","costPrice":231857,"salePrice":155344,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 112/110R AVANTIA  AR-410","size":"225/70 R15","category":"Auto","costPrice":239490,"salePrice":160458,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 118/116R AVANTIA  AR-410","size":"225/75 R16","category":"Auto","costPrice":294748,"salePrice":197481,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 107/105R AVANTIA  AR-410","size":"195/75 R16","category":"Auto","costPrice":250036,"salePrice":167524,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"C 110/108R AVANTIA  AR-410","size":"205/75 R16","category":"Auto","costPrice":271288,"salePrice":181763,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AR-440","size":"205/65 R15","category":"Auto","costPrice":170252,"salePrice":114069,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AR-440","size":"205/70 R15","category":"Auto","costPrice":189843,"salePrice":127195,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":"AR-440","size":"195/60 R16","category":"Auto","costPrice":171175,"salePrice":114687,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146L TL SR-200 TM","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":607521,"salePrice":461716,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146L SR-260 TL","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":625747,"salePrice":475568,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146L TL DR-400 TM","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":651044,"salePrice":494793,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146L DR-460 TL","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":670575,"salePrice":509637,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146J TL SU-100 TM     **Consultar","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":666297,"salePrice":506386,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146K TL SC-240 TM","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":634627,"salePrice":482317,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 149/146K TL DC-480 TM","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":676732,"salePrice":514317,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 148/145L SR-260 TL","size":"275/70 R22","category":"Pesado/Agrícola","costPrice":634994,"salePrice":482596,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M TL SR-200 TM","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":639620,"salePrice":486111,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M SR200 TL","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":575657,"salePrice":437500,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M TL DR-400 TM","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":692002,"salePrice":525921,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M TL SR-210","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":674799,"salePrice":512847,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M TL DR-410","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":730062,"salePrice":554847,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148M DR-470 TL     **Consultar pr","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":712762,"salePrice":541699,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148K TL SC-240 TM","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":677997,"salePrice":515278,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148K TL DC-480 TM","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":726595,"salePrice":552212,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 152/148G DO-820 TL","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":757730,"salePrice":575875,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 156/150L TL SR-200 TM","size":"315/80 R22","category":"Pesado/Agrícola","costPrice":774824,"salePrice":588866,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 156/150L TL DR-400 TM","size":"315/80 R22","category":"Pesado/Agrícola","costPrice":838289,"salePrice":637100,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 160K SR-200 TM TL","size":"385/65 R22","category":"Pesado/Agrícola","costPrice":983856,"salePrice":747731,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 160K TL TR-500 TM","size":"385/65 R22","category":"Pesado/Agrícola","costPrice":937007,"salePrice":712125,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 ELECTA RS-600 149 / 146 L","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":546769,"salePrice":388206,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 ELECTA RD-700 149 / 146 L","size":"275/80 R22","category":"Pesado/Agrícola","costPrice":585940,"salePrice":416017,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 ELECTA RS-600 152 / 148 M","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":575658,"salePrice":408717,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 ELECTA RD-700 152 / 148 M","size":"295/80 R22","category":"Pesado/Agrícola","costPrice":622802,"salePrice":442189,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 126/124M TL SR200","size":"215/75 R17","category":"Auto","costPrice":329499,"salePrice":250419,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 126/124M TL DR400","size":"215/75 R17","category":"Auto","costPrice":355862,"salePrice":270455,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 132/130M SR-200 TL","size":"235/75 R17","category":"Camioneta/SUV","costPrice":375628,"salePrice":285477,"margin":0,"stock":0,"minStock":2},{"brand":"Fate","model":".5 143/141J TR560 TL","size":"245/70 R17","category":"Camioneta/SUV","costPrice":526838,"salePrice":400397,"margin":0,"stock":0,"minStock":2}];

// ═══════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════

function ConfirmModal({ modal, setModal }: { modal: ModalState; setModal: (m: ModalState) => void }) {
  const [inputVal, setInputVal] = useState(modal.inputValue || '');
  if (!modal.show) return null;
  const colors = {
    danger: { bg: 'bg-red-600 hover:bg-red-700', icon: <AlertTriangle className="w-6 h-6 text-red-600" /> },
    warning: { bg: 'bg-amber-600 hover:bg-amber-700', icon: <AlertTriangle className="w-6 h-6 text-amber-600" /> },
    info: { bg: 'bg-blue-600 hover:bg-blue-700', icon: <Info className="w-6 h-6 text-blue-600" /> },
    success: { bg: 'bg-green-600 hover:bg-green-700', icon: <CheckCircle className="w-6 h-6 text-green-600" /> },
  };
  const style = colors[modal.type];
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setModal({ ...modal, show: false })}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {style.icon}
          <div>
            <h3 className="font-bold text-lg text-gray-900">{modal.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{modal.message}</p>
          </div>
        </div>
        {modal.inputField && (
          <textarea
            className="w-full border rounded-lg p-2 text-sm"
            placeholder={modal.inputPlaceholder || ''}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            rows={3}
          />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={() => setModal({ ...modal, show: false })} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          {modal.onConfirm && (
            <button
              onClick={() => { modal.onConfirm!(inputVal); setModal({ ...modal, show: false }); }}
              className={`px-4 py-2 text-sm text-white rounded-lg ${style.bg}`}
            >
              {modal.confirmText || 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed top-4 right-4 z-[9999] ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in`}>
      {type === 'success' && <CheckCircle className="w-4 h-4" />}
      {type === 'error' && <XCircle className="w-4 h-4" />}
      {type === 'info' && <Info className="w-4 h-4" />}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2"><X className="w-4 h-4" /></button>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{children}</span>;
}

function AccountCard({ client, addPayment }: { client: Client; addPayment: (id: string, amount: number, method: string, notes: string) => void }) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('efectivo');
  const [payNotes, setPayNotes] = useState('');
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <p className="font-bold">{client.name}</p>
          {client.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700"><Crown className="w-3 h-3" /></Badge>}
        </div>
        <p className={`text-lg font-bold ${client.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(client.balance)}</p>
      </div>
      {!showPayForm ? (
        <button onClick={() => setShowPayForm(true)} className="text-sm text-[#c47b12] hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Registrar pago</button>
      ) : (
        <div className="mt-3 border-t pt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="border rounded px-2 py-1.5 text-sm" placeholder="Monto" />
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="debito">Débito</option>
            </select>
            <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="border rounded px-2 py-1.5 text-sm" placeholder="Nota" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (Number(payAmount) > 0) { addPayment(client.id, Number(payAmount), payMethod, payNotes); setShowPayForm(false); setPayAmount(''); } }} disabled={!payAmount || Number(payAmount) <= 0} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50">Registrar</button>
            <button onClick={() => setShowPayForm(false)} className="px-3 py-1.5 border rounded text-sm">Cancelar</button>
          </div>
        </div>
      )}
      {client.payments.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Último pago: {formatDate(client.payments[client.payments.length - 1].date)} — {formatCurrency(client.payments[client.payments.length - 1].amount)}
        </div>
      )}
    </div>
  );
}

function PasswordChanger({ onChangeHash, setToast }: { onChangeHash: (hash: string) => void; setToast: (t: { message: string; type: 'success' | 'error' | 'info' }) => void }) {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  return (
    <div className="space-y-2">
      <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Nueva contraseña" />
      <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Confirmar contraseña" />
      <button
        onClick={async () => {
          if (newPass !== confirmPass) { setToast({ message: 'Las contraseñas no coinciden', type: 'error' }); return; }
          if (newPass.length < 6) { setToast({ message: 'Mínimo 6 caracteres', type: 'error' }); return; }
          const hash = await hashPassword(newPass);
          onChangeHash(hash);
          setNewPass('');
          setConfirmPass('');
          setToast({ message: 'Contraseña actualizada', type: 'success' });
        }}
        disabled={!newPass || !confirmPass}
        className="px-4 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Cambiar Contraseña
      </button>
    </div>
  );
}

function WhatsAppQuickButton({ order, nextStatus, updateOrderStatus, setModal, setToast }: {
  order: Order; nextStatus: string;
  updateOrderStatus: (id: string, status: string, notes?: string, msg?: string) => void;
  setModal: (m: ModalState) => void;
  setToast: (t: { message: string; type: 'success' | 'error' | 'info' }) => void;
}) {
  const [copied, setCopied] = useState(false);

  const getWhatsAppText = (): string => {
    const items = order.items.map(i => `${i.quantity}x ${i.brand} ${i.size}`).join(', ');
    const paymentLabel = PAYMENT_METHODS.find(p => p.id === order.paymentMethod)?.label || order.paymentMethod;

    if (nextStatus === 'listo') {
      return `¡Hola ${order.clientName}!👋\n\nSu pedido *${order.numero}* está listo para retirar.\n\n📦 ${items}\n💰 Total: ${formatCurrency(order.totalAmount)}\n\nPuede pasar a retirlo por Juan B. Justo 1980, Mar del Plata.\n\nBaliña Ruedas 🛞`;
    }
    if (nextStatus === 'entregado') {
      return `¡Hola ${order.clientName}!👋\n\nSu pedido *${order.numero}* ha sido entregado.\n\n📦 ${items}\n💰 Total: ${formatCurrency(order.totalAmount)}\n💳 ${paymentLabel}\n\n¡Gracias por confiar en Baliña Ruedas! 🛞`;
    }
    if (nextStatus === 'confirmado') {
      return `¡Hola ${order.clientName}!👋\n\nSu pedido *${order.numero}* ha sido confirmado.\n\n📦 ${items}\n💰 Total: ${formatCurrency(order.totalAmount)}\n📅 Retiro/Entrega: ${formatDate(order.scheduledDate)} ${order.scheduledTime || ''}\n\nBaliña Ruedas 🛞`;
    }
    return '';
  };

  const handleAction = () => {
    const waText = getWhatsAppText();
    if (waText) {
      navigator.clipboard?.writeText(waText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (nextStatus === 'listo') {
          updateOrderStatus(order.id, 'listo', undefined, 'Su pedido está listo para retirar');
        } else if (nextStatus === 'cancelado') {
          setModal({
            show: true, title: 'Cancelar pedido', message: `¿Cancelar pedido ${order.numero}?`,
            type: 'danger', confirmText: 'Cancelar pedido',
            onConfirm: () => updateOrderStatus(order.id, 'cancelado'),
          });
        } else {
          updateOrderStatus(order.id, nextStatus);
        }
        setToast({ message: `Mensaje copiado para WhatsApp + estado actualizado`, type: 'success' });
      }).catch(() => {
        setToast({ message: 'No se pudo copiar el mensaje', type: 'error' });
      });
    }
  };

  return (
    <button
      onClick={handleAction}
      className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-all ${
        nextStatus === 'cancelado' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
        nextStatus === 'entregado' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
        'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
    >
      {copied
        ? <><Check className="w-3 h-3 text-green-600" />Copiado</>
        : <><Copy className="w-3 h-3" />{STATUS_LABELS[nextStatus]}</>
      }
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}>{STATUS_LABELS[status] || status}</Badge>;
}


// ═══════════════════════════════════════════════════════════════════════════
// CSV IMPORT MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function CsvImportModal({
  summary, fileName, activeTab, setActiveTab,
  applyUpdates, setApplyUpdates,
  onConfirm, onClose, loading,
}: {
  summary: CsvImportSummary | null;
  fileName: string;
  activeTab: 'add' | 'update' | 'errors';
  setActiveTab: (t: 'add' | 'update' | 'errors') => void;
  applyUpdates: boolean;
  setApplyUpdates: (v: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#c47b12]" /> Importar CSV
            </h2>
            {fileName && <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center py-20 text-gray-500 gap-3">
            <div className="w-5 h-5 border-2 border-[#c47b12] border-t-transparent rounded-full animate-spin" />
            Procesando archivo...
          </div>
        )}

        {!loading && !summary && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-4 text-center px-8">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-[#c47b12]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Sin datos para mostrar</h3>
              <p className="text-sm text-gray-500 mt-1">Cargá un archivo CSV primero.</p>
            </div>
          </div>
        )}

        {!loading && summary && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-px bg-gray-200 border-b">
              {[
                { label: 'Total en archivo', value: summary.total, color: 'text-gray-700' },
                { label: 'A agregar', value: summary.toAdd.length, color: 'text-green-700' },
                { label: 'A actualizar', value: summary.toUpdate.length, color: 'text-blue-700' },
                { label: 'Sin cambios', value: summary.duplicatesSkipped.length, color: 'text-gray-400' },
              ].map(s => (
                <div key={s.label} className="bg-white px-4 py-3 text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b px-4 pt-2 gap-1">
              {([
                ['add',    `Nuevos (${summary.toAdd.length})`,          'text-green-700'],
                ['update', `Actualizaciones (${summary.toUpdate.length})`, 'text-blue-700'],
                ['errors', `Errores (${summary.errors.length})`,         'text-red-700'],
              ] as [typeof activeTab, string, string][]).map(([id, label, color]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
                    activeTab === id ? `border-[#c47b12] ${color}` : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-4 py-3">
              {activeTab === 'add' && (
                summary.toAdd.length === 0
                  ? <p className="text-center text-gray-400 py-10 text-sm">No hay productos nuevos para agregar.</p>
                  : <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="text-gray-500 font-semibold uppercase">
                          <th className="text-left px-2 py-2">Marca</th>
                          <th className="text-left px-2 py-2">Modelo</th>
                          <th className="text-left px-2 py-2">Medida</th>
                          <th className="text-left px-2 py-2">Categoría</th>
                          <th className="text-right px-2 py-2">Costo</th>
                          <th className="text-right px-2 py-2">Precio Venta</th>
                          <th className="text-center px-2 py-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {summary.toAdd.map((row, i) => (
                          <tr key={i} className="hover:bg-green-50">
                            <td className="px-2 py-1.5 font-medium">{row.brand}</td>
                            <td className="px-2 py-1.5">{row.model}</td>
                            <td className="px-2 py-1.5"><span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{row.size}</span></td>
                            <td className="px-2 py-1.5 text-gray-500">{row.category}</td>
                            <td className="px-2 py-1.5 text-right">{row.costPrice > 0 ? fmt(row.costPrice) : '—'}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-green-700">{fmt(row.salePrice)}</td>
                            <td className="px-2 py-1.5 text-center">{row.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}

              {activeTab === 'update' && (
                summary.toUpdate.length === 0
                  ? <p className="text-center text-gray-400 py-10 text-sm">No hay actualizaciones de precios detectadas.</p>
                  : <>
                      <div className="flex items-center gap-3 mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                        <input
                          type="checkbox" id="applyUpd" checked={applyUpdates}
                          onChange={e => setApplyUpdates(e.target.checked)}
                          className="w-4 h-4 accent-[#c47b12]"
                        />
                        <label htmlFor="applyUpd" className="text-blue-800 cursor-pointer">
                          Aplicar actualizaciones de precio/categoría a productos existentes
                        </label>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="text-gray-500 font-semibold uppercase">
                            <th className="text-left px-2 py-2">Marca / Modelo / Medida</th>
                            <th className="text-right px-2 py-2">Costo actual → nuevo</th>
                            <th className="text-right px-2 py-2">Precio actual → nuevo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {summary.toUpdate.map((u, i) => (
                            <tr key={i} className="hover:bg-blue-50">
                              <td className="px-2 py-1.5">
                                <span className="font-medium">{u.existing.brand} {u.existing.model}</span>
                                <span className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">{u.existing.size}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {fmt(u.existing.costPrice)} →{' '}
                                <span className={u.incoming.costPrice > u.existing.costPrice ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                  {fmt(u.incoming.costPrice)}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {fmt(u.existing.salePrice)} →{' '}
                                <span className={u.incoming.salePrice > u.existing.salePrice ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                  {fmt(u.incoming.salePrice)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
              )}

              {activeTab === 'errors' && (
                summary.errors.length === 0 && summary.warnings.length === 0
                  ? <p className="text-center text-gray-400 py-10 text-sm">Sin errores ni advertencias.</p>
                  : <div className="space-y-2">
                      {summary.warnings.map((w, i) => (
                        <div key={`w${i}`} className="flex gap-2 p-3 bg-amber-50 rounded-lg text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span className="text-amber-800">Fila {w.line}: {w.message}</span>
                        </div>
                      ))}
                      {summary.errors.map((e, i) => (
                        <div key={`e${i}`} className="flex gap-2 p-3 bg-red-50 rounded-lg text-sm">
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span className="text-red-800">{e.message}</span>
                        </div>
                      ))}
                    </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-500">
                {summary.toAdd.length + (applyUpdates ? summary.toUpdate.length : 0)} productos se importarán
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-white">Cancelar</button>
                <button
                  onClick={onConfirm}
                  disabled={summary.toAdd.length === 0 && (!applyUpdates || summary.toUpdate.length === 0)}
                  className="px-5 py-2 text-sm bg-[#c47b12] text-white rounded-lg font-medium hover:bg-[#a6680f] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Importación
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════

export default function App() {
  // ─── Session State ───
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [loggedInClientId, setLoggedInClientId] = useState<string>('');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [loginMode, setLoginMode] = useState<'select' | 'employee' | 'client'>('select');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClientForLogin, setSelectedClientForLogin] = useState<Client | null>(null);
  const [clientPin, setClientPin] = useState('');

  // ─── Employee UI State ───
  const [activeTab, setActiveTab] = useState<EmployeeTab>('pos');
  const [clientTab, setClientTab] = useState<ClientTab>('catalog');

  // ─── Data State ───
  const [tires, setTires] = useState<Tire[]>(() => loadData('balina_tires', []));
  const [clients, setClients] = useState<Client[]>(() => loadData('balina_clients', []).map((c: any) => ({
    ...c,
    tipoCliente: c.tipoCliente || 'minorista',
    descuentoMayorista: c.descuentoMayorista || 0,
    pinHash: c.pinHash || '',
    cupoCredito: c.cupoCredito || 0,
    email: c.email || '',
    payments: c.payments || [],
  })));
  const [sales, setSales] = useState<Sale[]>(() => loadData('balina_sales', []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadData('balina_invoices', []));
  const [orders, setOrders] = useState<Order[]>(() => loadData('balina_orders', []));
  const [orderConfig, setOrderConfig] = useState<OrderConfig>(() => loadData('balina_order_config', DEFAULT_ORDER_CONFIG));
  const [wholesaleConfig, setWholesaleConfig] = useState<WholesaleConfig>(() => loadData('balina_wholesale_config', DEFAULT_WHOLESALE_CONFIG));
  const [employeeHash, setEmployeeHash] = useState<string>(() => loadData('balina_employee_hash', EMPLOYEE_HASH_DEFAULT));

  // ─── POS State ───
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posPayment, setPosPayment] = useState('efectivo');
  const [posClient, setPosClient] = useState<Client | null>(null);
  const [posSearchFocused, setPosSearchFocused] = useState(false);
  const [posSelectedIndex, setPosSelectedIndex] = useState(0);

  // ─── Inventory State ───
  const [invView, setInvView] = useState<'stock' | 'seller'>('stock');
  const [invSearch, setInvSearch] = useState('');
  const [invEditing, setInvEditing] = useState<Tire | null>(null);
  const [invShowForm, setInvShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvSummary, setCsvSummary] = useState<CsvImportSummary | null>(null);
  const [csvImportTab, setCsvImportTab] = useState<'add' | 'update' | 'errors'>('add');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvApplyUpdates, setCsvApplyUpdates] = useState(true);

  // ─── Client State ───
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientEditing, setClientEditing] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  // ─── Invoice State ───
  const [invFilter, setInvFilter] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // ─── Order State (Employee) ───
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');

  // ─── Client Portal State ───
  const [showRepeatOrderConfirm, setShowRepeatOrderConfirm] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBrand, setCatalogBrand] = useState('');
  const [catalogSize, setCatalogSize] = useState('');
  const [clientCartItems, setClientCartItems] = useState<CartItem[]>([]);
  const [clientPayment, setClientPayment] = useState('efectivo');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderStep, setOrderStep] = useState(1);
  const [orderTipo, setOrderTipo] = useState<'retiro' | 'entrega_domicilio'>('retiro');
  const [orderDate, setOrderDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // ─── UI State ───
  const [modal, setModal] = useState<ModalState>({ show: false, title: '', message: '', type: 'info' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // ─── Order Detail ───
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // ─── Today Panel ───
  const [showTodayPanel, setShowTodayPanel] = useState(true);

  // ─── View Modes ───
  type OrdersViewMode = 'kanban' | 'list' | 'calendar';
  const [ordersViewMode, setOrdersViewMode] = useState<OrdersViewMode>('kanban');

  // ─── Refs ───
  const posSearchRef = useRef<HTMLInputElement>(null);
  const globalSearchRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════
  // SEED DATA ON FIRST LOAD
  // ═══════════════════════════════════════════════════

  useEffect(() => {
    // Check if this is first time (no data in localStorage)
    const existingTires = loadData<Tire[]>('balina_tires', []);
    const existingClients = loadData<Client[]>('balina_clients', []);
    
    if (existingTires.length === 0 && existingClients.length === 0) {
      // Seed with demo data
      setTires(SEED_TIRES);
      setClients(SEED_CLIENTS);
      setSales(SEED_SALES);
      setOrders(SEED_ORDERS);
      setToast({ message: '¡Bienvenido! Se cargaron datos de demostración.', type: 'info' });
    }
  }, []); // Only run once on mount

  // ═══════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════

  useEffect(() => { saveData('balina_tires', tires); }, [tires]);
  useEffect(() => { saveData('balina_clients', clients); }, [clients]);
  useEffect(() => { saveData('balina_sales', sales); }, [sales]);
  useEffect(() => { saveData('balina_invoices', invoices); }, [invoices]);
  useEffect(() => { saveData('balina_orders', orders); }, [orders]);
  useEffect(() => { saveData('balina_order_config', orderConfig); }, [orderConfig]);
  useEffect(() => { saveData('balina_wholesale_config', wholesaleConfig); }, [wholesaleConfig]);
  useEffect(() => { saveData('balina_employee_hash', employeeHash); }, [employeeHash]);

  // ═══════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════

  const resetActivity = useCallback(() => setLastActivity(Date.now()), []);

  useEffect(() => {
    if (!sessionType) return;
    const timeout = sessionType === 'employee' ? EMPLOYEE_TIMEOUT : CLIENT_TIMEOUT;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > timeout) {
        setSessionType(null);
        setLoggedInClientId('');
        setToast({ message: 'Sesión expirada por inactividad', type: 'info' });
      }
    }, 10000);
    const handleActivity = () => resetActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [sessionType, lastActivity, resetActivity]);

  // ═══════════════════════════════════════════════════
  // AUTH HANDLERS
  // ═══════════════════════════════════════════════════

  const handleEmployeeLogin = useCallback(async () => {
    if (Date.now() < lockoutUntil) {
      setLoginError(`Cuenta bloqueada. Espere ${Math.ceil((lockoutUntil - Date.now()) / 60000)} minutos.`);
      return;
    }
    const hash = await hashPassword(loginPassword);
    if (hash === employeeHash) {
      setSessionType('employee');
      setLoginAttempts(0);
      setLoginPassword('');
      setLoginError('');
      setLoginMode('select');
      resetActivity();
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION);
        setLoginError(`Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.`);
      } else {
        setLoginError(`Contraseña incorrecta. Intento ${newAttempts}/${MAX_LOGIN_ATTEMPTS}`);
      }
    }
  }, [loginPassword, employeeHash, loginAttempts, lockoutUntil, resetActivity]);

  const handleClientLogin = useCallback(async () => {
    if (!selectedClientForLogin) return;
    if (!selectedClientForLogin.pinHash) {
      setLoginError('Este cliente no tiene PIN configurado. Solicite uno al empleado.');
      return;
    }
    const hash = await hashPassword(clientPin);
    if (hash === selectedClientForLogin.pinHash) {
      const status = getDebtStatus(selectedClientForLogin);
      if (status.blocked) {
        setLoginError('Su cuenta está bloqueada por deuda. Contacte al local.');
        return;
      }
      setSessionType('client');
      setLoggedInClientId(selectedClientForLogin.id);
      setClientPin('');
      setLoginError('');
      setLoginMode('select');
      setSelectedClientForLogin(null);
      setClientSearchQuery('');
      resetActivity();
    } else {
      setLoginError('PIN incorrecto.');
    }
  }, [selectedClientForLogin, clientPin, resetActivity]);

  const handleLogout = useCallback(() => {
    setSessionType(null);
    setLoggedInClientId('');
    setActiveTab('pos');
    setClientTab('catalog');
    setCart([]);
    setClientCartItems([]);
    setShowNewOrder(false);
  }, []);

  // ═══════════════════════════════════════════════════
  // COMPUTED DATA
  // ═══════════════════════════════════════════════════

  const loggedInClient = useMemo(() => clients.find(c => c.id === loggedInClientId) || null, [clients, loggedInClientId]);

  const pendingOrdersCount = useMemo(() => orders.filter(o => o.status === 'pendiente').length, [orders]);

  const clientOrders = useMemo(() => {
    if (!loggedInClientId) return [];
    return orders.filter(o => o.clientId === loggedInClientId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, loggedInClientId]);

  const filteredPosResults = useMemo(() => {
    if (!posSearch.trim()) return [];
    const q = posSearch.toLowerCase();
    return tires.filter(t =>
      t.stock > 0 && (
        t.brand.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.size.toLowerCase().includes(q) ||
        `${t.brand} ${t.model} ${t.size}`.toLowerCase().includes(q)
      )
    ).slice(0, 10);
  }, [posSearch, tires]);

  const filteredTires = useMemo(() => {
    if (!invSearch.trim()) return tires;
    const q = invSearch.toLowerCase();
    return tires.filter(t =>
      t.brand.toLowerCase().includes(q) ||
      t.model.toLowerCase().includes(q) ||
      t.size.toLowerCase().includes(q)
    );
  }, [invSearch, tires]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [clientSearch, clients]);

  const filteredInvoices = useMemo(() => {
    if (!invFilter.trim()) return invoices;
    const q = invFilter.toLowerCase();
    return invoices.filter(i =>
      i.supplier.toLowerCase().includes(q) ||
      i.number.toLowerCase().includes(q)
    );
  }, [invFilter, invoices]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderFilter !== 'all') result = result.filter(o => o.status === orderFilter);
    if (orderTypeFilter !== 'all') result = result.filter(o => o.tipo === orderTypeFilter);
    if (orderDateFilter) result = result.filter(o => o.scheduledDate === orderDateFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, orderFilter, orderTypeFilter, orderDateFilter]);

  const brands = useMemo(() => [...new Set(tires.map(t => t.brand))].sort(), [tires]);
  const sizes = useMemo(() => [...new Set(tires.map(t => t.size))].sort(), [tires]);

  const catalogTires = useMemo(() => {
    let result = tires.filter(t => t.stock > 0);
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      result = result.filter(t =>
        t.brand.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.size.toLowerCase().includes(q)
      );
    }
    if (catalogBrand) result = result.filter(t => t.brand === catalogBrand);
    if (catalogSize) result = result.filter(t => t.size === catalogSize);
    return result;
  }, [tires, catalogSearch, catalogBrand, catalogSize]);

  const cartTotal = useMemo(() => {
    const pm = PAYMENT_METHODS.find(p => p.id === posPayment);
    const surcharge = pm?.surcharge || 0;
    return cart.reduce((sum, item) => sum + calculatePrice(item.tire.costPrice, item.tire.margin, surcharge) * item.quantity, 0);
  }, [cart, posPayment]);

  const clientCartTotal = useMemo(() => {
    const pm = PAYMENT_METHODS.find(p => p.id === clientPayment);
    const surcharge = pm?.surcharge || 0;
    const discount = loggedInClient?.tipoCliente === 'mayorista'
      ? (loggedInClient.descuentoMayorista || wholesaleConfig.globalDiscount)
      : 0;
    return clientCartItems.reduce((sum, item) => sum + calculatePrice(item.tire.costPrice, item.tire.margin, surcharge, discount) * item.quantity, 0);
  }, [clientCartItems, clientPayment, loggedInClient, wholesaleConfig]);

  // Analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const thisMonth = sales.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const lastMonth = sales.filter(s => {
      const d = new Date(s.date);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    });

    const monthRevenue = thisMonth.reduce((s, v) => s + v.total, 0);
    const lastMonthRevenue = lastMonth.reduce((s, v) => s + v.total, 0);
    const monthSalesCount = thisMonth.length;

    const brandSales: Record<string, number> = {};
    sales.forEach(s => s.items.forEach(i => {
      brandSales[i.brand] = (brandSales[i.brand] || 0) + i.quantity;
    }));
    const topBrands = Object.entries(brandSales).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxBrandQty = topBrands.length > 0 ? topBrands[0][1] : 1;

    const clientSales: Record<string, number> = {};
    sales.forEach(s => {
      if (s.clientName) clientSales[s.clientName] = (clientSales[s.clientName] || 0) + s.total;
    });
    const topClients = Object.entries(clientSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const lowStock = tires.filter(t => t.stock <= t.minStock);

    const totalDebt = clients.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const activeClients = clients.filter(c => {
      return sales.some(s => s.clientId === c.id && new Date(s.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    }).length;

    const ordersByType = {
      retiro: orders.filter(o => o.tipo === 'retiro').length,
      entrega: orders.filter(o => o.tipo === 'entrega_domicilio').length,
    };

    const pendingOrders = orders.filter(o => o.status === 'pendiente').length;
    const deliveredOrders = orders.filter(o => o.status === 'entregado').length;

    return {
      monthRevenue, lastMonthRevenue, monthSalesCount,
      topBrands, maxBrandQty, topClients, lowStock, totalDebt,
      activeClients, inactiveClients: clients.length - activeClients,
      ordersByType, pendingOrders, deliveredOrders,
      totalTires: tires.reduce((s, t) => s + t.stock, 0),
    };
  }, [sales, tires, clients, orders]);

  // Global search results
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return { clients: [], tires: [], orders: [], invoices: [] };
    const q = globalSearch.toLowerCase();
    return {
      clients: clients.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 5),
      tires: tires.filter(t => t.brand.toLowerCase().includes(q) || t.model.toLowerCase().includes(q) || t.size.includes(q)).slice(0, 5),
      orders: orders.filter(o => o.numero.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q)).slice(0, 5),
      invoices: invoices.filter(i => i.number.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [globalSearch, clients, tires, orders, invoices]);

  const hasGlobalResults = useMemo(() => {
    const r = globalSearchResults;
    return r.clients.length + r.tires.length + r.orders.length + r.invoices.length > 0;
  }, [globalSearchResults]);

  // ═══════════════════════════════════════════════════
  // POS HANDLERS
  // ═══════════════════════════════════════════════════

  const addToCart = useCallback((tire: Tire) => {
    setCart(prev => {
      const existing = prev.find(i => i.tire.id === tire.id);
      if (existing) {
        if (existing.quantity >= tire.stock) return prev;
        return prev.map(i => i.tire.id === tire.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { tire, quantity: 1, unitPrice: tire.salePrice }];
    });
    setPosSearch('');
    setPosSelectedIndex(0);
  }, []);

  const updateCartQty = useCallback((tireId: string, qty: number) => {
    setCart(prev => {
      if (qty <= 0) return prev.filter(i => i.tire.id !== tireId);
      return prev.map(i => i.tire.id === tireId ? { ...i, quantity: Math.min(qty, i.tire.stock) } : i);
    });
  }, []);

  const removeFromCart = useCallback((tireId: string) => {
    setCart(prev => prev.filter(i => i.tire.id !== tireId));
  }, []);

  const completeSale = useCallback(() => {
    if (cart.length === 0) return;
    const pm = PAYMENT_METHODS.find(p => p.id === posPayment);
    const surcharge = pm?.surcharge || 0;

    const saleItems: SaleItem[] = cart.map(item => {
      const price = calculatePrice(item.tire.costPrice, item.tire.margin, surcharge);
      return {
        tireId: item.tire.id,
        brand: item.tire.brand,
        model: item.tire.model,
        size: item.tire.size,
        quantity: item.quantity,
        unitPrice: price,
        subtotal: price * item.quantity,
      };
    });

    const total = saleItems.reduce((s, i) => s + i.subtotal, 0);
    const sale: Sale = {
      id: genId(),
      items: saleItems,
      total,
      paymentMethod: posPayment,
      clientId: posClient?.id,
      clientName: posClient?.name,
      date: new Date().toISOString(),
      notes: '',
    };

    // Update stock
    setTires(prev => prev.map(t => {
      const cartItem = cart.find(c => c.tire.id === t.id);
      if (cartItem) return { ...t, stock: t.stock - cartItem.quantity };
      return t;
    }));

    // Update client balance if account
    if (posPayment === 'cuenta_corriente' && posClient) {
      setClients(prev => prev.map(c =>
        c.id === posClient.id ? { ...c, balance: c.balance + total } : c
      ));
    }

    setSales(prev => [sale, ...prev]);
    setCart([]);
    setPosClient(null);
    setToast({ message: `Venta registrada: ${formatCurrency(total)}`, type: 'success' });
  }, [cart, posPayment, posClient]);

  // ═══════════════════════════════════════════════════
  // ORDER HANDLERS
  // ═══════════════════════════════════════════════════

  const createOrder = useCallback((clientId: string, clientName: string, items: CartItem[], payment: string, tipo: 'retiro' | 'entrega_domicilio', date: string, time: string, address: string, notes: string) => {
    const pm = PAYMENT_METHODS.find(p => p.id === payment);
    const surcharge = pm?.surcharge || 0;
    const client = clients.find(c => c.id === clientId);
    const discount = client?.tipoCliente === 'mayorista'
      ? (client.descuentoMayorista || wholesaleConfig.globalDiscount)
      : 0;

    const orderItems: OrderItem[] = items.map(item => {
      const price = calculatePrice(item.tire.costPrice, item.tire.margin, surcharge, discount);
      return {
        tireId: item.tire.id,
        brand: item.tire.brand,
        model: item.tire.model,
        size: item.tire.size,
        quantity: item.quantity,
        unitPrice: price,
        subtotal: price * item.quantity,
      };
    });

    const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0);
    const order: Order = {
      id: genId(),
      numero: generateOrderNumber(orders),
      clientId,
      clientName,
      items: orderItems,
      paymentMethod: payment,
      status: 'pendiente',
      tipo,
      scheduledDate: date,
      scheduledTime: time,
      address: tipo === 'entrega_domicilio' ? sanitize(address) : undefined,
      notes: sanitize(notes),
      totalAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setOrders(prev => [order, ...prev]);
    return order;
  }, [orders, clients, wholesaleConfig]);

  const updateOrderStatus = useCallback((orderId: string, newStatus: string, internalNotes?: string, clientMessage?: string) => {
    // FIX: Read order snapshot outside state updater to avoid calling setState inside setState
    setOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (!order) return prev;

      const updated: Order = {
        ...order,
        status: newStatus as Order['status'],
        updatedAt: new Date().toISOString(),
        confirmedBy: 'empleado',
      };
      if (internalNotes) updated.internalNotes = sanitize(internalNotes);
      if (clientMessage) updated.clientMessage = sanitize(clientMessage);

      // Side-effects after state update — safe via setTimeout(0) microtask
      if (newStatus === 'entregado') {
        const deliveredOrder = order;
        setTimeout(() => {
          setTires(prev2 => prev2.map(t => {
            const item = deliveredOrder.items.find(i => i.tireId === t.id);
            if (item) return { ...t, stock: Math.max(0, t.stock - item.quantity) };
            return t;
          }));
          const sale: Sale = {
            id: genId(),
            items: deliveredOrder.items.map(i => ({
              tireId: i.tireId, brand: i.brand, model: i.model, size: i.size,
              quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal,
            })),
            total: deliveredOrder.totalAmount,
            paymentMethod: deliveredOrder.paymentMethod,
            clientId: deliveredOrder.clientId,
            clientName: deliveredOrder.clientName,
            date: new Date().toISOString(),
            notes: `Pedido ${deliveredOrder.numero}`,
          };
          setSales(prev2 => [sale, ...prev2]);
          if (deliveredOrder.paymentMethod === 'cuenta_corriente') {
            setClients(prev2 => prev2.map(c =>
              c.id === deliveredOrder.clientId ? { ...c, balance: c.balance + deliveredOrder.totalAmount } : c
            ));
          }
        }, 0);
      }

      return prev.map(o => o.id === orderId ? updated : o);
    });
    setToast({ message: `Pedido actualizado a: ${STATUS_LABELS[newStatus]}`, type: 'success' });
  }, []);

  // ═══════════════════════════════════════════════════
  // TIRE CRUD
  // ═══════════════════════════════════════════════════

  const saveTire = useCallback((tire: Tire) => {
    const sanitized: Tire = {
      ...tire,
      brand: sanitize(tire.brand),
      model: sanitize(tire.model),
      size: sanitize(tire.size),
      category: sanitize(tire.category),
      location: sanitize(tire.location),
      notes: sanitize(tire.notes),
      salePrice: Math.round(tire.costPrice * (1 + tire.margin / 100)),
    };
    setTires(prev => {
      const idx = prev.findIndex(t => t.id === sanitized.id);
      if (idx >= 0) return prev.map(t => t.id === sanitized.id ? sanitized : t);
      return [...prev, sanitized];
    });
    setInvEditing(null);
    setInvShowForm(false);
    setToast({ message: 'Neumático guardado', type: 'success' });
  }, []);

  const deleteTire = useCallback((id: string) => {
    setTires(prev => prev.filter(t => t.id !== id));
    setToast({ message: 'Neumático eliminado', type: 'success' });
  }, []);

  // ─── CSV Import Handler ───
  const handleCsvFile = useCallback((file: File) => {
    setCsvLoading(true);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvText(text);
      const summary = buildImportSummary(parsed, tires);
      setCsvSummary(summary);
      setCsvImportTab(summary.toAdd.length > 0 ? 'add' : summary.toUpdate.length > 0 ? 'update' : 'errors');
      setCsvLoading(false);
    };
    reader.onerror = () => {
      setToast({ message: 'Error al leer el archivo', type: 'error' });
      setCsvLoading(false);
    };
    reader.readAsText(file, 'UTF-8');
  }, [tires]);

  const handleCsvImportFromSupplierCatalog = useCallback(() => {
    const parsed: CsvParseResult = { rows: SUPPLIER_CATALOG, errors: [], warnings: [] };
    const summary = buildImportSummary(parsed, tires);
    setCsvSummary(summary);
    setCsvFileName('Catálogo de Proveedores (978 productos)');
    setCsvImportTab(summary.toAdd.length > 0 ? 'add' : 'update');
    setShowCsvImport(true);
  }, [tires]);

  const confirmCsvImport = useCallback(() => {
    if (!csvSummary) return;
    let added = 0;
    let updated = 0;

    setTires(prev => {
      let next = [...prev];
      // Add new tires
      for (const row of csvSummary.toAdd) {
        const margin = row.margin > 0 ? row.margin :
          row.costPrice > 0 && row.salePrice > 0
            ? Math.round(((row.salePrice / row.costPrice) - 1) * 100)
            : 0;
        next.push({
          id: genId(),
          brand: row.brand, model: row.model, size: row.size, category: row.category,
          costPrice: row.costPrice,
          margin,
          salePrice: row.salePrice > 0 ? row.salePrice : Math.round(row.costPrice * (1 + margin/100)),
          stock: row.stock, minStock: row.minStock,
          location: row.location ?? '', notes: row.notes ?? '',
          createdAt: new Date().toISOString(),
        });
        added++;
      }
      // Update existing if option enabled
      if (csvApplyUpdates) {
        next = next.map(t => {
          const upd = csvSummary.toUpdate.find(u => u.existing.id === t.id);
          if (!upd) return t;
          const margin = upd.incoming.margin > 0 ? upd.incoming.margin :
            upd.incoming.costPrice > 0 && upd.incoming.salePrice > 0
              ? Math.round(((upd.incoming.salePrice / upd.incoming.costPrice) - 1) * 100)
              : t.margin;
          updated++;
          return {
            ...t,
            costPrice: upd.incoming.costPrice || t.costPrice,
            salePrice: upd.incoming.salePrice || t.salePrice,
            margin,
            category: upd.incoming.category || t.category,
            minStock: upd.incoming.minStock ?? t.minStock,
          };
        });
      }
      return next;
    });

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} nuevos`);
    if (updated > 0 && csvApplyUpdates) parts.push(`${updated} actualizados`);
    setToast({ message: `Importación completa: ${parts.join(', ')}`, type: 'success' });
    setShowCsvImport(false);
    setCsvSummary(null);
    setCsvFileName('');
  }, [csvSummary, csvApplyUpdates]);

  // ═══════════════════════════════════════════════════
  // CLIENT CRUD
  // ═══════════════════════════════════════════════════

  const saveClient = useCallback((client: Client) => {
    const sanitized: Client = {
      ...client,
      name: sanitize(client.name),
      phone: sanitize(client.phone),
      address: sanitize(client.address),
      email: sanitize(client.email),
    };
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === sanitized.id);
      if (idx >= 0) return prev.map(c => c.id === sanitized.id ? sanitized : c);
      return [...prev, sanitized];
    });
    setSelectedClient(sanitized);
    setClientEditing(false);
    setShowClientForm(false);
    setToast({ message: 'Cliente guardado', type: 'success' });
  }, []);

  const addPayment = useCallback((clientId: string, amount: number, method: string, notes: string) => {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const payment: Payment = { id: genId(), amount, date: new Date().toISOString(), method: sanitize(method), notes: sanitize(notes) };
      return { ...c, balance: c.balance - amount, payments: [...c.payments, payment] };
    }));
    setToast({ message: `Pago de ${formatCurrency(amount)} registrado`, type: 'success' });
  }, []);

  // ═══════════════════════════════════════════════════
  // INVOICE CRUD
  // ═══════════════════════════════════════════════════

  const saveInvoice = useCallback((invoice: Invoice) => {
    const sanitized: Invoice = {
      ...invoice,
      supplier: sanitize(invoice.supplier),
      number: sanitize(invoice.number),
      notes: sanitize(invoice.notes),
    };
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === sanitized.id);
      if (idx >= 0) return prev.map(i => i.id === sanitized.id ? sanitized : i);
      return [...prev, sanitized];
    });
    setShowInvoiceForm(false);
    setEditingInvoice(null);
    setToast({ message: 'Factura guardada', type: 'success' });
  }, []);

  // ═══════════════════════════════════════════════════
  // BACKUP / RESTORE
  // ═══════════════════════════════════════════════════

  const exportBackup = useCallback(() => {
    const data = {
      version: '4.0',
      date: new Date().toISOString(),
      tires, clients, sales, invoices, orders, orderConfig, wholesaleConfig, employeeHash,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balina-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Backup descargado', type: 'success' });
  }, [tires, clients, sales, invoices, orders, orderConfig, wholesaleConfig, employeeHash]);

  const importBackup = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.tires) setTires(data.tires);
        if (data.clients) setClients(data.clients.map((c: any) => ({
          ...c,
          tipoCliente: c.tipoCliente || 'minorista',
          descuentoMayorista: c.descuentoMayorista || 0,
          pinHash: c.pinHash || '',
          cupoCredito: c.cupoCredito || 0,
          email: c.email || '',
          payments: c.payments || [],
        })));
        if (data.sales) setSales(data.sales);
        if (data.invoices) setInvoices(data.invoices);
        if (data.orders) setOrders(data.orders);
        if (data.orderConfig) setOrderConfig(data.orderConfig);
        if (data.wholesaleConfig) setWholesaleConfig(data.wholesaleConfig);
        if (data.employeeHash) setEmployeeHash(data.employeeHash);
        setToast({ message: 'Backup restaurado correctamente', type: 'success' });
      } catch {
        setToast({ message: 'Error al leer el archivo de backup', type: 'error' });
      }
    };
    reader.readAsText(file);
  }, []);

  // ═══════════════════════════════════════════════════
  // PRINT ORDER
  // ═══════════════════════════════════════════════════

  const printOrder = useCallback((order: Order) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    const itemsHtml = order.items.map(i => `
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee">${i.brand} ${i.model} ${i.size}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.subtotal)}</td>
      </tr>
    `).join('');
    const pmLabel = PAYMENT_METHODS.find(p => p.id === order.paymentMethod)?.label || order.paymentMethod;
    w.document.write(`<html><head><title>Pedido ${order.numero}</title></head><body style="font-family:Arial,sans-serif;max-width:380px;margin:0 auto;padding:20px">
      <div style="text-align:center;margin-bottom:20px">
        <h2 style="margin:0;color:#c47b12">BALIÑA RUEDAS</h2>
        <p style="margin:4px 0;font-size:12px">Juan B. Justo 1980 — Mar del Plata</p>
        <p style="margin:4px 0;font-size:12px">Tel: (0223) XXX-XXXX</p>
      </div>
      <hr/>
      <p><strong>Pedido N°:</strong> ${order.numero}</p>
      <p><strong>Cliente:</strong> ${order.clientName}</p>
      <p><strong>Fecha:</strong> ${formatDate(order.createdAt)}</p>
      <p><strong>Retiro/Entrega:</strong> ${formatDate(order.scheduledDate)} ${order.scheduledTime || ''}</p>
      <p><strong>Tipo:</strong> ${order.tipo === 'retiro' ? 'Retiro en local' : 'Entrega a domicilio'}</p>
      ${order.address ? `<p><strong>Dirección:</strong> ${order.address}</p>` : ''}
      <p><strong>Forma de pago:</strong> ${pmLabel}</p>
      <hr/>
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="text-align:left;padding:4px">Producto</th><th style="text-align:center;padding:4px">Cant.</th><th style="text-align:right;padding:4px">Subtotal</th></tr>
        ${itemsHtml}
      </table>
      <hr/>
      <p style="text-align:right;font-size:18px"><strong>TOTAL: ${formatCurrency(order.totalAmount)}</strong></p>
      <p><strong>Estado:</strong> ${STATUS_LABELS[order.status]}</p>
      ${order.notes ? `<p><strong>Observaciones:</strong> ${order.notes}</p>` : ''}
      <hr/>
      <p style="text-align:center;font-size:11px;color:#888">Comprobante de pedido — Baliña Ruedas v4.0</p>
    </body></html>`);
    w.document.close();
    w.print();
  }, []);

  const printSale = useCallback((sale: Sale) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    const itemsHtml = sale.items.map(i => `
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee">${i.brand} ${i.model} ${i.size}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.subtotal)}</td>
      </tr>
    `).join('');
    const pmLabel = PAYMENT_METHODS.find(p => p.id === sale.paymentMethod)?.label || sale.paymentMethod;
    w.document.write(`<html><head><title>Remito</title></head><body style="font-family:Arial,sans-serif;max-width:380px;margin:0 auto;padding:20px">
      <div style="text-align:center;margin-bottom:20px">
        <h2 style="margin:0;color:#c47b12">BALIÑA RUEDAS</h2>
        <p style="margin:4px 0;font-size:12px">Juan B. Justo 1980 — Mar del Plata</p>
      </div>
      <hr/>
      <p><strong>Fecha:</strong> ${formatDateTime(sale.date)}</p>
      ${sale.clientName ? `<p><strong>Cliente:</strong> ${sale.clientName}</p>` : ''}
      <p><strong>Forma de pago:</strong> ${pmLabel}</p>
      <hr/>
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="text-align:left;padding:4px">Producto</th><th style="text-align:center;padding:4px">Cant.</th><th style="text-align:right;padding:4px">Subtotal</th></tr>
        ${itemsHtml}
      </table>
      <hr/>
      <p style="text-align:right;font-size:18px"><strong>TOTAL: ${formatCurrency(sale.total)}</strong></p>
    </body></html>`);
    w.document.close();
    w.print();
  }, []);

  // ═══════════════════════════════════════════════════
  // KEYBOARD NAVIGATION FOR POS
  // ═══════════════════════════════════════════════════

  const handlePosKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPosSelectedIndex(prev => Math.min(prev + 1, filteredPosResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPosSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredPosResults.length > 0) {
      e.preventDefault();
      addToCart(filteredPosResults[posSelectedIndex]);
    }
  }, [filteredPosResults, posSelectedIndex, addToCart]);

  // ═══════════════════════════════════════════════════
  // RENDER: LOGIN SCREEN
  // ═══════════════════════════════════════════════════

  if (!sessionType) {
    const loginClientsFiltered = clientSearchQuery.trim()
      ? clients.filter(c => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) || c.phone.includes(clientSearchQuery))
      : [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#c47b12] to-[#a56810] shadow-lg mb-4">
              <CircleDot className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Baliña Ruedas</h1>
            <p className="text-sm text-gray-500 mt-1">Sistema de Gestión v4.0</p>
            <p className="text-xs text-gray-400">Juan B. Justo 1980 — Mar del Plata</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            {loginMode === 'select' && (
              <>
                <h2 className="text-lg font-semibold text-center text-gray-700">Seleccione su acceso</h2>
                <button
                  onClick={() => { setLoginMode('employee'); setLoginError(''); }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-[#c47b12] hover:bg-orange-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#c47b12]/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-[#c47b12]" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Ingresar como Empleado</p>
                    <p className="text-xs text-gray-500">Acceso completo al sistema</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </button>
                <button
                  onClick={() => { setLoginMode('client'); setLoginError(''); }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Ingresar como Cliente</p>
                    <p className="text-xs text-gray-500">Portal de pedidos y catálogo</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </button>
              </>
            )}

            {loginMode === 'employee' && (
              <>
                <button onClick={() => { setLoginMode('select'); setLoginError(''); setLoginPassword(''); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <div className="text-center">
                  <Shield className="w-8 h-8 text-[#c47b12] mx-auto mb-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Acceso Empleado</h2>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEmployeeLogin()}
                      className="w-full border rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#c47b12]/50 focus:border-[#c47b12]"
                      placeholder="Ingrese contraseña"
                      autoFocus
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {loginError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{loginError}</p>}
                <button
                  onClick={handleEmployeeLogin}
                  disabled={!loginPassword || Date.now() < lockoutUntil}
                  className="w-full py-2.5 bg-[#c47b12] hover:bg-[#a56810] text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  Ingresar
                </button>
              </>
            )}

            {loginMode === 'client' && (
              <>
                <button onClick={() => { setLoginMode('select'); setLoginError(''); setClientPin(''); setSelectedClientForLogin(null); setClientSearchQuery(''); }} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <div className="text-center">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Acceso Cliente</h2>
                </div>

                {!selectedClientForLogin ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Buscar cliente</label>
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={e => setClientSearchQuery(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                      placeholder="Nombre o teléfono..."
                      autoFocus
                    />
                    {clientSearchQuery.trim() && (
                      <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {loginClientsFiltered.length === 0 ? (
                          <p className="p-3 text-sm text-gray-500">No se encontraron clientes</p>
                        ) : loginClientsFiltered.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedClientForLogin(c)}
                            className="w-full text-left p-3 hover:bg-blue-50 flex items-center gap-2"
                          >
                            <UserCheck className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">{c.name}</p>
                              <p className="text-xs text-gray-500">{c.phone}</p>
                            </div>
                            {c.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700">Mayorista</Badge>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clients.length === 0 && (
                      <p className="text-sm text-gray-500 mt-2">No hay clientes registrados. Un empleado debe crearlos primero.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="bg-blue-50 rounded-lg p-3 mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{selectedClientForLogin.name}</p>
                        <p className="text-xs text-gray-500">{selectedClientForLogin.phone}</p>
                      </div>
                      <button onClick={() => { setSelectedClientForLogin(null); setClientPin(''); setLoginError(''); }} className="text-xs text-blue-600 hover:underline">Cambiar</button>
                    </div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">PIN de acceso</label>
                    <input
                      type="password"
                      value={clientPin}
                      onChange={e => { if (/^\d{0,6}$/.test(e.target.value)) setClientPin(e.target.value); }}
                      onKeyDown={e => e.key === 'Enter' && clientPin.length >= 4 && handleClientLogin()}
                      className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 text-center text-2xl tracking-[0.5em]"
                      placeholder="• • • •"
                      maxLength={6}
                      autoFocus
                    />
                    {loginError && <p className="text-sm text-red-600 flex items-center gap-1 mt-2"><AlertTriangle className="w-4 h-4" />{loginError}</p>}
                    <button
                      onClick={handleClientLogin}
                      disabled={clientPin.length < 4}
                      className="w-full py-2.5 mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                    >
                      Ingresar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Baliña Ruedas © {new Date().getFullYear()}</p>
        </div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // RENDER: CLIENT PORTAL
  // ═══════════════════════════════════════════════════

  if (sessionType === 'client' && loggedInClient) {
    const availableDates = getAvailableDates(orderConfig);
    const clientSales = sales.filter(s => s.clientId === loggedInClientId);
    const discount = loggedInClient.tipoCliente === 'mayorista'
      ? (loggedInClient.descuentoMayorista || wholesaleConfig.globalDiscount) : 0;
    const pm = PAYMENT_METHODS.find(p => p.id === clientPayment);
    const surcharge = pm?.surcharge || 0;

    // Recent status changes
    const recentUpdates = clientOrders.filter(o => {
      const updatedAt = new Date(o.updatedAt).getTime();
      return (Date.now() - updatedAt) < 24 * 60 * 60 * 1000 && o.status !== 'pendiente';
    });

    const addToClientCart = (tire: Tire) => {
      setClientCartItems(prev => {
        const existing = prev.find(i => i.tire.id === tire.id);
        if (existing) return prev.map(i => i.tire.id === tire.id ? { ...i, quantity: i.quantity + 1 } : i);
        return [...prev, { tire, quantity: 1, unitPrice: tire.salePrice }];
      });
      setToast({ message: `${tire.brand} ${tire.model} agregado al pedido`, type: 'success' });
    };

    const handleSubmitOrder = () => {
      if (clientCartItems.length === 0) return;
      const order = createOrder(
        loggedInClient.id, loggedInClient.name, clientCartItems,
        clientPayment, orderTipo, orderDate, orderTime,
        orderAddress, orderNotes
      );
      setClientCartItems([]);
      setShowNewOrder(false);
      setOrderStep(1);
      setOrderTipo('retiro');
      setOrderDate('');
      setOrderTime('');
      setOrderAddress('');
      setOrderNotes('');
      setToast({ message: `Pedido ${order.numero} creado exitosamente`, type: 'success' });
    };

    return (
      <div className="min-h-screen bg-stone-50">
        {/* Client Header */}
        <header className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#c47b12] flex items-center justify-center">
                <CircleDot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">Baliña Ruedas</h1>
                <p className="text-xs text-gray-500">Hola, {loggedInClient.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loggedInClient.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700"><Crown className="w-3 h-3 mr-1" />Mayorista</Badge>}
              <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </header>

        {/* Notification Banner */}
        {recentUpdates.length > 0 && (
          <div className="bg-blue-50 border-b border-blue-200">
            <div className="max-w-4xl mx-auto px-4 py-2">
              {recentUpdates.slice(0, 2).map(o => (
                <div key={o.id} className="flex items-center gap-2 text-sm text-blue-700">
                  <Bell className="w-4 h-4" />
                  <span>Pedido <strong>{o.numero}</strong>: {STATUS_LABELS[o.status]}</span>
                  {o.clientMessage && <span>— {o.clientMessage}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {([
              { id: 'catalog' as ClientTab, label: 'Catálogo', icon: <Package className="w-4 h-4" />, badge: 0 },
              { id: 'orders' as ClientTab, label: 'Mis Pedidos', icon: <ClipboardList className="w-4 h-4" />, badge: clientOrders.filter(o => o.status !== 'entregado' && o.status !== 'cancelado').length },
              { id: 'history' as ClientTab, label: 'Historial', icon: <Clock className="w-4 h-4" />, badge: 0 },
              { id: 'account' as ClientTab, label: 'Mi Cuenta', icon: <CreditCard className="w-4 h-4" />, badge: 0 },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setClientTab(tab.id); setShowNewOrder(false); }}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  clientTab === tab.id ? 'border-[#c47b12] text-[#c47b12]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge > 0 ? <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{tab.badge}</span> : null}
              </button>
            ))}
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-4">
          {/* ─── CATALOG TAB ─── */}
          {clientTab === 'catalog' && !showNewOrder && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#c47b12]/50 focus:border-[#c47b12] focus:outline-none"
                    placeholder="Buscar neumáticos..."
                  />
                </div>
                <select value={catalogBrand} onChange={e => setCatalogBrand(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Todas las marcas</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={catalogSize} onChange={e => setCatalogSize(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="">Todas las medidas</option>
                  {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Payment method selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">Precio en:</span>
                {PAYMENT_METHODS.filter(p => p.id !== 'cuenta_corriente').map(p => (
                  <button
                    key={p.id}
                    onClick={() => setClientPayment(p.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      clientPayment === p.id ? 'bg-[#c47b12] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}{p.surcharge > 0 ? ` (+${p.surcharge}%)` : ''}
                  </button>
                ))}
              </div>

              {/* Cart summary bar */}
              {clientCartItems.length > 0 && (
                <div className="bg-[#c47b12] text-white rounded-lg p-3 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="text-sm font-medium">{clientCartItems.reduce((s, i) => s + i.quantity, 0)} items</span>
                    <span className="text-sm">•</span>
                    <span className="font-bold">{formatCurrency(clientCartTotal)}</span>
                  </div>
                  <button
                    onClick={() => { setShowNewOrder(true); setOrderStep(1); setClientTab('catalog'); }}
                    className="bg-white text-[#c47b12] px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-50"
                  >
                    Continuar pedido →
                  </button>
                </div>
              )}

              {/* Product grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catalogTires.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No se encontraron productos</p>
                  </div>
                ) : catalogTires.map(tire => {
                  const price = calculatePrice(tire.costPrice, tire.margin, surcharge, discount);
                  const basePrice = calculatePrice(tire.costPrice, tire.margin, 0, 0);
                  const savingPerUnit = discount > 0 ? basePrice - price : 0;
                  const inCart = clientCartItems.find(i => i.tire.id === tire.id);
                  return (
                    <div key={tire.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-900">{tire.brand}</p>
                          <p className="text-sm text-gray-600">{tire.model}</p>
                        </div>
                        <Badge color="bg-gray-100 text-gray-700">{tire.size}</Badge>
                      </div>
                      {tire.category && <Badge color="bg-blue-50 text-blue-600">{tire.category}</Badge>}
                      <div className="mt-3">
                        {discount > 0 && basePrice > price ? (
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm text-gray-400 line-through">{formatCurrency(basePrice)}</span>
                              <span className="text-xl font-bold text-amber-600">{formatCurrency(price)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-500" />
                              <span className="text-xs font-medium text-amber-600">Precio Mayorista</span>
                              <span className="text-xs text-green-600 font-medium">— Ahorrá {formatCurrency(savingPerUnit)} por unidad</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xl font-bold text-[#c47b12]">{formatCurrency(price)}</p>
                            {surcharge > 0 && <p className="text-xs text-gray-400">Contado: {formatCurrency(calculatePrice(tire.costPrice, tire.margin, 0, 0))}</p>}
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        {inCart ? (
                          <div className="flex items-center justify-between bg-[#c47b12]/10 rounded-lg p-2">
                            <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === tire.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow"><Minus className="w-4 h-4" /></button>
                            <span className="font-bold text-[#c47b12]">{inCart.quantity}</span>
                            <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === tire.id ? { ...i, quantity: i.quantity + 1 } : i))} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow"><Plus className="w-4 h-4" /></button>
                            <button onClick={() => setClientCartItems(prev => prev.filter(i => i.tire.id !== tire.id))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToClientCart(tire)}
                            className="w-full py-2 bg-[#c47b12] hover:bg-[#a56810] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Agregar al pedido
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              NEW ORDER WIZARD — 3 steps
              ═══════════════════════════════════════════ */}
          {showNewOrder && clientTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => { if (orderStep > 1) setOrderStep(orderStep - 1); else { setShowNewOrder(false); setOrderStep(1); } }} className="text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Nuevo Pedido</h2>
              </div>

              {/* Step indicators */}
              <div className="flex gap-3">
                {[
                  { step: 1, label: 'Productos', icon: <Package className="w-4 h-4" /> },
                  { step: 2, label: 'Revisar', icon: <ShoppingCart className="w-4 h-4" /> },
                  { step: 3, label: 'Entrega', icon: <Truck className="w-4 h-4" /> },
                ].map(s => (
                  <div key={s.step} className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    orderStep >= s.step
                      ? orderStep === s.step
                        ? 'border-[#c47b12] bg-orange-50 text-[#c47b12]'
                        : 'border-green-300 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-400'
                  }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      orderStep > s.step ? 'bg-green-500 text-white' :
                      orderStep === s.step ? 'bg-[#c47b12] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {orderStep > s.step ? <Check className="w-4 h-4" /> : s.step}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex gap-1">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-2 flex-1 rounded-full ${s <= orderStep ? 'bg-[#c47b12]' : 'bg-gray-200'}`} />
                ))}
              </div>

              {/* ══ STEP 1: PRODUCT SELECTION ══ */}
              {orderStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Seleccioná los productos para tu pedido. Cambiá la forma de pago para ver precios.</p>

                  {/* Payment method switcher */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PAYMENT_METHODS.filter(p => p.id !== 'cuenta_corriente').map(p => (
                      <button
                        key={p.id}
                        onClick={() => setClientPayment(p.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          clientPayment === p.id ? 'bg-[#c47b12] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.label}{p.surcharge > 0 ? ` (+${p.surcharge}%)` : ''}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catalogTires.length === 0 ? (
                      <div className="col-span-2 text-center py-12 text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No se encontraron productos</p>
                      </div>
                    ) : catalogTires.map(tire => {
                      const price = calculatePrice(tire.costPrice, tire.margin, surcharge, discount);
                      const basePrice = calculatePrice(tire.costPrice, tire.margin, 0, 0);
                      const savingPerUnit = discount > 0 ? basePrice - price : 0;
                      const inCart = clientCartItems.find(i => i.tire.id === tire.id);
                      return (
                        <div key={tire.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-900">{tire.brand}</p>
                              <p className="text-sm text-gray-600">{tire.model}</p>
                            </div>
                            <Badge color="bg-stone-100 text-gray-700">{tire.size}</Badge>
                          </div>
                          {tire.category && <Badge color="bg-blue-50 text-blue-600">{tire.category}</Badge>}
                          <div className="mt-2">
                            {discount > 0 && basePrice > price ? (
                              <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-gray-400 line-through">{formatCurrency(basePrice)}</span>
                                  <span className="text-lg font-bold text-amber-600">{formatCurrency(price)}</span>
                                </div>
                                <span className="text-xs font-medium text-green-600">Ahorrá {formatCurrency(savingPerUnit)} c/u</span>
                              </div>
                            ) : (
                              <p className="text-lg font-bold text-[#c47b12]">{formatCurrency(price)}</p>
                            )}
                          </div>
                          <div className="mt-2">
                            {inCart ? (
                              <div className="flex items-center justify-between bg-[#c47b12]/10 rounded-lg p-2">
                                <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === tire.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow"><Minus className="w-4 h-4" /></button>
                                <span className="font-bold text-[#c47b12]">{inCart.quantity}</span>
                                <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === tire.id ? { ...i, quantity: i.quantity + 1 } : i))} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow"><Plus className="w-4 h-4" /></button>
                                <button onClick={() => setClientCartItems(prev => prev.filter(i => i.tire.id !== tire.id))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <button onClick={() => addToClientCart(tire)} className="w-full py-2 bg-[#c47b12] hover:bg-[#a56810] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors">
                                <Plus className="w-4 h-4" /> Agregar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {clientCartItems.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-50">
                      <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-[#c47b12]" />
                          <span className="text-sm font-medium">{clientCartItems.reduce((s, i) => s + i.quantity, 0)} items</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">{formatCurrency(clientCartTotal)}</span>
                          <button onClick={() => setOrderStep(2)} className="bg-[#c47b12] text-white px-6 py-2 rounded-lg text-sm font-medium">
                            Revisar →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 2: CART REVIEW ══ */}
              {orderStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Resumen del carrito</h3>
                  {clientCartItems.map(item => {
                    const price = calculatePrice(item.tire.costPrice, item.tire.margin, surcharge, discount);
                    return (
                      <div key={item.tire.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.tire.brand} {item.tire.model}</p>
                          <p className="text-xs text-gray-500">{item.tire.size}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === item.tire.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="w-7 h-7 rounded-full border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                            <span className="font-medium w-6 text-center">{item.quantity}</span>
                            <button onClick={() => setClientCartItems(prev => prev.map(i => i.tire.id === item.tire.id ? { ...i, quantity: i.quantity + 1 } : i))} className="w-7 h-7 rounded-full border flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                          </div>
                          <p className="font-bold text-sm w-24 text-right">{formatCurrency(price * item.quantity)}</p>
                          <button onClick={() => setClientCartItems(prev => prev.filter(i => i.tire.id !== item.tire.id))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-[#c47b12]">{formatCurrency(clientCartTotal)}</span>
                  </div>
                  <button onClick={() => setOrderStep(3)} disabled={clientCartItems.length === 0} className="w-full py-3 bg-[#c47b12] text-white rounded-lg font-medium disabled:opacity-50">Continuar →</button>
                </div>
              )}

              {orderStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Detalles de entrega</h3>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Tipo</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setOrderTipo('retiro')} className={`p-3 rounded-lg border-2 text-sm font-medium ${orderTipo === 'retiro' ? 'border-[#c47b12] bg-orange-50 text-[#c47b12]' : 'border-gray-200'}`}>
                        <MapPin className="w-5 h-5 mx-auto mb-1" />Retiro en local
                      </button>
                      <button onClick={() => setOrderTipo('entrega_domicilio')} className={`p-3 rounded-lg border-2 text-sm font-medium ${orderTipo === 'entrega_domicilio' ? 'border-[#c47b12] bg-orange-50 text-[#c47b12]' : 'border-gray-200'}`}>
                        <Truck className="w-5 h-5 mx-auto mb-1" />Entrega a domicilio
                      </button>
                    </div>
                  </div>

                  {orderTipo === 'entrega_domicilio' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Dirección de entrega</label>
                      <input type="text" value={orderAddress} onChange={e => setOrderAddress(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm" placeholder="Calle y número..." />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Fecha</label>
                    <select value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white">
                      <option value="">Seleccione una fecha</option>
                      {availableDates.map(d => (
                        <option key={d} value={d}>{formatDate(d)} — {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(d + 'T12:00:00').getDay()]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Horario</label>
                    <select value={orderTime} onChange={e => setOrderTime(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white">
                      <option value="">Seleccione horario</option>
                      {orderConfig.timeSlots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Observaciones (opcional)</label>
                    <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2.5 text-sm" rows={3} placeholder="Alguna indicación especial..." />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span>Forma de pago:</span><span className="font-medium">{PAYMENT_METHODS.find(p => p.id === clientPayment)?.label}</span></div>
                    <div className="flex justify-between text-sm"><span>Items:</span><span className="font-medium">{clientCartItems.reduce((s, i) => s + i.quantity, 0)} unidades</span></div>
                    <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className="text-[#c47b12]">{formatCurrency(clientCartTotal)}</span></div>
                  </div>

                  <button
                    onClick={handleSubmitOrder}
                    disabled={!orderDate || !orderTime || (orderTipo === 'entrega_domicilio' && !orderAddress)}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                  >
                    ✓ Confirmar Pedido
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── CLIENT ORDERS TAB ─── */}
          {clientTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">Mis Pedidos</h2>
                {orderConfig.enabled && (
                  <button
                    onClick={() => { setClientTab('catalog'); setShowNewOrder(true); setOrderStep(1); }}
                    className="px-4 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Pedido
                  </button>
                )}
              </div>

              {/* Prominent status banner for most recent active order */}
              {clientOrders.length > 0 && (() => {
                const activeOrder = clientOrders.find(o => o.status !== 'entregado' && o.status !== 'cancelado');
                if (!activeOrder) return null;
                const statusBannerColors: Record<string, string> = {
                  pendiente: 'bg-gray-50 border-gray-200 text-gray-800',
                  confirmado: 'bg-blue-50 border-blue-200 text-blue-800',
                  en_preparacion: 'bg-amber-50 border-amber-200 text-amber-800',
                  listo: 'bg-green-50 border-green-200 text-green-800',
                };
                return (
                  <div className={`rounded-xl border p-4 ${statusBannerColors[activeOrder.status] || ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-70">Pedido en curso</p>
                        <p className="font-bold text-lg">{activeOrder.numero}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={activeOrder.status} />
                          <span className="text-sm opacity-80">{formatDate(activeOrder.scheduledDate)} {activeOrder.scheduledTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl">{formatCurrency(activeOrder.totalAmount)}</p>
                        <p className="text-sm opacity-70">{activeOrder.tipo === 'retiro' ? 'Retiro en local' : 'Entrega a domicilio'}</p>
                      </div>
                    </div>
                    {activeOrder.clientMessage && (
                      <div className="mt-2 bg-white/60 rounded-lg p-2 text-sm flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" /> {activeOrder.clientMessage}
                      </div>
                    )}
                  </div>
                );
              })()}

              {clientOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tiene pedidos registrados</p>
                </div>
              ) : clientOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl border p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900">{order.numero}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {order.items.map((item, idx) => (
                      <p key={idx}>{item.quantity}x {item.brand} {item.model} {item.size}</p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      {order.tipo === 'retiro' ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Retiro en local</span> : <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> Entrega a domicilio</span>}
                      {' • '}{formatDate(order.scheduledDate)} {order.scheduledTime}
                    </span>
                    <span className="font-bold text-[#c47b12]">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  {order.clientMessage && (
                    <div className="bg-blue-50 rounded-lg p-2 text-sm text-blue-700 flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" /> {order.clientMessage}
                    </div>
                  )}
                  <button onClick={() => printOrder(order)} className="text-sm text-[#c47b12] hover:underline flex items-center gap-1">
                    <Printer className="w-4 h-4" /> Imprimir comprobante
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ─── CLIENT HISTORY TAB ─── */}
          {clientTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Historial de Compras</h2>
              {clientSales.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tiene compras registradas</p>
                </div>
              ) : clientSales.map(sale => (
                <div key={sale.id} className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-gray-500">{formatDateTime(sale.date)}</p>
                    <p className="font-bold text-[#c47b12]">{formatCurrency(sale.total)}</p>
                  </div>
                  {sale.items.map((item, idx) => (
                    <p key={idx} className="text-sm text-gray-700">{item.quantity}x {item.brand} {item.model} {item.size}</p>
                  ))}
                  <p className="text-xs text-gray-400 mt-1">{PAYMENT_METHODS.find(p => p.id === sale.paymentMethod)?.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── CLIENT ACCOUNT TAB ─── */}
          {clientTab === 'account' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Mi Cuenta</h2>
              <div className="bg-white rounded-xl border p-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Saldo actual</p>
                <p className={`text-3xl font-bold ${loggedInClient.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(loggedInClient.balance)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{loggedInClient.balance > 0 ? 'Saldo deudor' : loggedInClient.balance < 0 ? 'Saldo a favor' : 'Sin saldo pendiente'}</p>
              </div>

              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Datos personales</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Nombre:</span><span className="font-medium">{loggedInClient.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Teléfono:</span><span className="font-medium">{loggedInClient.phone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Dirección:</span><span className="font-medium">{loggedInClient.address}</span></div>
                  {loggedInClient.email && <div className="flex justify-between"><span className="text-gray-500">Email:</span><span className="font-medium">{loggedInClient.email}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">Tipo:</span><span className="font-medium">{loggedInClient.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}</span></div>
                </div>
              </div>

              {loggedInClient.payments.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Últimos pagos</h3>
                  {loggedInClient.payments.slice(-5).reverse().map(p => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-green-700">-{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-gray-400">{formatDate(p.date)} • {p.method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <ConfirmModal modal={modal} setModal={setModal} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // RENDER: EMPLOYEE PANEL
  // ═══════════════════════════════════════════════════

  const employeeTabs = [
    { id: 'pos' as const, label: 'Mostrador', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'inventory' as const, label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'clients' as const, label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'accounts' as const, label: 'Cuentas', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'invoices' as const, label: 'Facturas', icon: <FileText className="w-4 h-4" /> },
    { id: 'orders' as const, label: 'Pedidos', icon: <ClipboardList className="w-4 h-4" />, badge: pendingOrdersCount },
    { id: 'analytics' as const, label: 'Análisis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings' as const, label: 'Ajustes', icon: <Settings className="w-4 h-4" /> },
  ];

  // ─── TIRE FORM ───
  const TireForm = ({ tire, onSave, onCancel }: { tire: Tire | null; onSave: (t: Tire) => void; onCancel: () => void }) => {
    const [form, setForm] = useState<Tire>(tire || {
      id: genId(), brand: '', model: '', size: '', category: '', costPrice: 0, margin: 30,
      salePrice: 0, stock: 0, minStock: 2, location: '', notes: '', createdAt: new Date().toISOString(),
    });
    const upd = (k: keyof Tire, v: any) => setForm(prev => ({ ...prev, [k]: v }));
    return (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-bold text-gray-900">{tire ? 'Editar' : 'Nuevo'} Neumático</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label className="text-xs font-medium text-gray-600 block">Marca*</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.brand} onChange={e => upd('brand', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Modelo*</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.model} onChange={e => upd('model', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Medida*</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.size} onChange={e => upd('size', e.target.value)} placeholder="205/55R16" /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Categoría</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.category} onChange={e => upd('category', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Costo*</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.costPrice || ''} onChange={e => upd('costPrice', Number(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Margen %*</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.margin || ''} onChange={e => upd('margin', Number(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">P. Venta</label><input className="w-full border rounded px-2 py-1.5 text-sm bg-gray-50" value={formatCurrency(Math.round(form.costPrice * (1 + form.margin / 100)))} readOnly /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Stock*</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.stock || ''} onChange={e => upd('stock', Number(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Stock Mín.</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.minStock || ''} onChange={e => upd('minStock', Number(e.target.value))} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Ubicación</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.location} onChange={e => upd('location', e.target.value)} /></div>
        </div>
        <div><label className="text-xs font-medium text-gray-600 block">Notas</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} /></div>
        <div className="flex gap-2">
          <button onClick={() => onSave(form)} disabled={!form.brand || !form.size} className="px-4 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" />Guardar</button>
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  // ─── CLIENT FORM ───
  const ClientForm = ({ client, onSave, onCancel }: { client: Client | null; onSave: (c: Client) => void; onCancel: () => void }) => {
    const [form, setForm] = useState<Client>(client || {
      id: genId(), name: '', phone: '', address: '', email: '', balance: 0, payments: [],
      createdAt: new Date().toISOString(), tipoCliente: 'minorista', descuentoMayorista: 0,
      pinHash: '', cupoCredito: 0,
    });
    const [newPin, setNewPin] = useState('');
    const upd = (k: keyof Client, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSave = async () => {
      let pinHash = form.pinHash;
      if (newPin && newPin.length >= 4) {
        pinHash = await hashPassword(newPin);
      }
      onSave({ ...form, pinHash });
    };

    return (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-bold text-gray-900">{client ? 'Editar' : 'Nuevo'} Cliente</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs font-medium text-gray-600 block">Nombre*</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={e => upd('name', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Teléfono</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.phone} onChange={e => upd('phone', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Email</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.email} onChange={e => upd('email', e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs font-medium text-gray-600 block">Dirección</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.address} onChange={e => upd('address', e.target.value)} /></div>
          <div>
            <label className="text-xs font-medium text-gray-600 block">Tipo de Cliente</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm bg-white" value={form.tipoCliente} onChange={e => upd('tipoCliente', e.target.value)}>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          {form.tipoCliente === 'mayorista' && (
            <div><label className="text-xs font-medium text-gray-600 block">Descuento Mayorista %</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.descuentoMayorista || ''} onChange={e => upd('descuentoMayorista', Number(e.target.value))} placeholder={`Global: ${wholesaleConfig.globalDiscount}%`} /></div>
          )}
          <div><label className="text-xs font-medium text-gray-600 block">Cupo Crédito</label><input type="number" className="w-full border rounded px-2 py-1.5 text-sm" value={form.cupoCredito || ''} onChange={e => upd('cupoCredito', Number(e.target.value))} /></div>
          <div>
            <label className="text-xs font-medium text-gray-600 block">PIN Portal (4-6 dígitos)</label>
            <input type="text" className="w-full border rounded px-2 py-1.5 text-sm" value={newPin} onChange={e => { if (/^\d{0,6}$/.test(e.target.value)) setNewPin(e.target.value); }} placeholder={form.pinHash ? '••••' : 'Sin PIN'} />
            {form.pinHash && !newPin && <p className="text-xs text-green-600 mt-0.5">✓ PIN configurado</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!form.name} className="px-4 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" />Guardar</button>
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  // ─── INVOICE FORM ───
  const InvoiceForm = ({ invoice, onSave, onCancel }: { invoice: Invoice | null; onSave: (i: Invoice) => void; onCancel: () => void }) => {
    const [form, setForm] = useState<Invoice>(invoice || {
      id: genId(), type: 'A', number: '', supplier: '', date: new Date().toISOString().slice(0, 10), dueDate: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, subtotal: 0 }], subtotal: 0, iva: 0, total: 0, paid: false, notes: '',
    });
    const upd = (k: keyof Invoice, v: any) => setForm(prev => ({ ...prev, [k]: v }));
    const updItem = (idx: number, k: keyof InvoiceItem, v: any) => {
      setForm(prev => {
        const items = [...prev.items];
        items[idx] = { ...items[idx], [k]: v };
        items[idx].subtotal = items[idx].quantity * items[idx].unitPrice;
        const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
        const iva = prev.type === 'A' ? Math.round(subtotal * 0.21) : 0;
        return { ...prev, items, subtotal, iva, total: subtotal + iva };
      });
    };
    const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, subtotal: 0 }] }));
    const removeItem = (idx: number) => setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx);
      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const iva = prev.type === 'A' ? Math.round(subtotal * 0.21) : 0;
      return { ...prev, items, subtotal, iva, total: subtotal + iva };
    });

    return (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-bold text-gray-900">{invoice ? 'Editar' : 'Nueva'} Factura</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-gray-600 block">Tipo</label>
            <select className="w-full border rounded px-2 py-1.5 text-sm bg-white" value={form.type} onChange={e => { upd('type', e.target.value); }}>
              <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="X">X</option>
            </select>
          </div>
          <div><label className="text-xs font-medium text-gray-600 block">Número</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.number} onChange={e => upd('number', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Proveedor*</label><input className="w-full border rounded px-2 py-1.5 text-sm" value={form.supplier} onChange={e => upd('supplier', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Fecha</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.date} onChange={e => upd('date', e.target.value)} /></div>
          <div><label className="text-xs font-medium text-gray-600 block">Vencimiento</label><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" value={form.dueDate} onChange={e => upd('dueDate', e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-medium text-gray-600">Items</span><button onClick={addItem} className="text-xs text-[#c47b12] hover:underline">+ Agregar item</button></div>
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <input className="col-span-5 border rounded px-2 py-1.5 text-sm" placeholder="Descripción" value={item.description} onChange={e => updItem(idx, 'description', e.target.value)} />
              <input type="number" className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder="Cant." value={item.quantity || ''} onChange={e => updItem(idx, 'quantity', Number(e.target.value))} />
              <input type="number" className="col-span-3 border rounded px-2 py-1.5 text-sm" placeholder="P. Unit." value={item.unitPrice || ''} onChange={e => updItem(idx, 'unitPrice', Number(e.target.value))} />
              <span className="col-span-1 text-xs text-right">{formatCurrency(item.subtotal)}</span>
              <button onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(form.subtotal)}</span></div>
          {form.type === 'A' && <div className="flex justify-between"><span>IVA 21%:</span><span>{formatCurrency(form.iva)}</span></div>}
          <div className="flex justify-between font-bold text-base"><span>Total:</span><span>{formatCurrency(form.total)}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.paid} onChange={e => upd('paid', e.target.checked)} /> Pagada</label>
        </div>
        <div><label className="text-xs font-medium text-gray-600 block">Notas</label><textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} /></div>
        <div className="flex gap-2">
          <button onClick={() => onSave(form)} disabled={!form.supplier} className="px-4 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium disabled:opacity-50"><Save className="w-4 h-4 inline mr-1" />Guardar</button>
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-100">
      {/* ═══ EMPLOYEE HEADER ═══ */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#c47b12] to-[#a56810] flex items-center justify-center">
              <CircleDot className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-gray-900 leading-tight">Baliña Ruedas</h1>
              <p className="text-xs text-gray-400">v4.0 — Panel Empleado</p>
            </div>
          </div>

          {/* Global Search */}
          <div className="relative flex-1 max-w-md mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={globalSearchRef}
              type="text"
              value={globalSearch}
              onChange={e => { setGlobalSearch(e.target.value); setShowGlobalSearch(true); }}
              onFocus={() => setShowGlobalSearch(true)}
              onBlur={() => setTimeout(() => setShowGlobalSearch(false), 200)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#c47b12]/50 focus:border-[#c47b12] focus:outline-none"
              placeholder="Buscar clientes, productos, pedidos..."
            />
            {showGlobalSearch && globalSearch.trim() && hasGlobalResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border max-h-80 overflow-y-auto z-50">
                {globalSearchResults.clients.length > 0 && (
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-400 px-2 py-1">CLIENTES</p>
                    {globalSearchResults.clients.map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setActiveTab('clients'); setGlobalSearch(''); }} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm flex items-center gap-2">
                        <Users className="w-3 h-3 text-gray-400" />{c.name} <span className="text-xs text-gray-400">{c.phone}</span>
                        {c.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700">M</Badge>}
                      </button>
                    ))}
                  </div>
                )}
                {globalSearchResults.tires.length > 0 && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-400 px-2 py-1">NEUMÁTICOS</p>
                    {globalSearchResults.tires.map(t => (
                      <button key={t.id} onClick={() => { setInvSearch(t.brand); setActiveTab('inventory'); setGlobalSearch(''); }} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm flex items-center gap-2">
                        <Package className="w-3 h-3 text-gray-400" />{t.brand} {t.model} <span className="text-xs text-gray-400">{t.size}</span>
                      </button>
                    ))}
                  </div>
                )}
                {globalSearchResults.orders.length > 0 && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-400 px-2 py-1">PEDIDOS</p>
                    {globalSearchResults.orders.map(o => (
                      <button key={o.id} onClick={() => { setActiveTab('orders'); setGlobalSearch(''); }} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm flex items-center gap-2">
                        <ClipboardList className="w-3 h-3 text-gray-400" />{o.numero} <span className="text-xs text-gray-400">{o.clientName}</span> <StatusBadge status={o.status} />
                      </button>
                    ))}
                  </div>
                )}
                {globalSearchResults.invoices.length > 0 && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-400 px-2 py-1">FACTURAS</p>
                    {globalSearchResults.invoices.map(i => (
                      <button key={i.id} onClick={() => { setActiveTab('invoices'); setGlobalSearch(''); }} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm flex items-center gap-2">
                        <FileText className="w-3 h-3 text-gray-400" />{i.type}-{i.number} <span className="text-xs text-gray-400">{i.supplier}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Salir</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-0.5 overflow-x-auto">
          {employeeTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-[#c47b12] text-[#c47b12]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge ? <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* ═══════════════════════════════════════════
            TODAY PANEL — Daily dashboard summary
            ═══════════════════════════════════════════ */}
        {!selectedOrderId && (
          <div className={`mb-4 ${showTodayPanel ? '' : 'mb-2'}`}>
            <button
              onClick={() => setShowTodayPanel(!showTodayPanel)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              Panel de Hoy
              {showTodayPanel ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showTodayPanel && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Today's orders */}
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const todayOrders = orders.filter(o => o.scheduledDate === today && (o.status === 'confirmado' || o.status === 'en_preparacion' || o.status === 'listo'));
                  const todayPending = orders.filter(o => o.status === 'pendiente');
                  return (
                    <>
                      <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase">Pedidos para hoy</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{todayOrders.length}</p>
                        {todayOrders.length > 5 && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" />Día muy cargado</p>
                        )}
                        {todayOrders.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {todayOrders.slice(0, 3).map(o => (
                              <p key={o.id} className="text-xs text-gray-500">{o.clientName} — {formatDate(o.scheduledDate)} {o.scheduledTime}</p>
                            ))}
                            {todayOrders.length > 3 && <p className="text-xs text-gray-400">+{todayOrders.length - 3} más</p>}
                          </div>
                        )}
                        {todayOrders.length === 0 && <p className="text-xs text-gray-400 mt-1">Sin pedidos programados</p>}
                      </div>
                      <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Bell className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase">Pendientes por confirmar</span>
                        </div>
                        <p className={`text-2xl font-bold ${todayPending.length > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{todayPending.length}</p>
                        {todayPending.length > 0 && (
                          <button onClick={() => setActiveTab('orders')} className="text-xs text-[#c47b12] hover:underline mt-1">
                            Ver en Pedidos →
                          </button>
                        )}
                      </div>
                      <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-semibold text-gray-500 uppercase">Alertas rápidas</span>
                        </div>
                        {(() => {
                          const lowStock = tires.filter(t => t.stock <= t.minStock);
                          const highDebt = clients.filter(c => c.cupoCredito > 0 && c.balance > c.cupoCredito * 0.7);
                          return (
                            <div className="space-y-1.5">
                              {lowStock.length > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Stock bajo</span>
                                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">{lowStock.length}</span>
                                </div>
                              )}
                              {highDebt.length > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Deuda alta</span>
                                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-bold">{highDebt.length}</span>
                                </div>
                              )}
                              {lowStock.length === 0 && highDebt.length === 0 && (
                                <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Todo bajo control</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            POS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Search & Results */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border p-4">
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={posSearchRef}
                      type="text"
                      value={posSearch}
                      onChange={e => { setPosSearch(e.target.value); setPosSelectedIndex(0); }}
                      onFocus={() => setPosSearchFocused(true)}
                      onBlur={() => setTimeout(() => setPosSearchFocused(false), 200)}
                      onKeyDown={handlePosKeyDown}
                      className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#c47b12]/50 focus:border-[#c47b12] focus:outline-none"
                      placeholder="Buscar neumático (marca, modelo, medida)..."
                      autoFocus
                    />
                  </div>
                  <select value={posPayment} onChange={e => setPosPayment(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                    {PAYMENT_METHODS.map(p => <option key={p.id} value={p.id}>{p.label}{p.surcharge > 0 ? ` (+${p.surcharge}%)` : ''}</option>)}
                  </select>
                </div>

                {/* Client selector */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Cliente:</span>
                  {posClient ? (
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      {posClient.name}
                      {posClient.tipoCliente === 'mayorista' && <Crown className="w-3 h-3 text-amber-500" />}
                      <button onClick={() => setPosClient(null)} className="text-blue-400 hover:text-blue-600"><X className="w-3 h-3" /></button>
                    </span>
                  ) : (
                    <select className="border rounded px-2 py-1 text-sm bg-white" onChange={e => { const c = clients.find(c => c.id === e.target.value); setPosClient(c || null); }} value="">
                      <option value="">Consumidor Final</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.tipoCliente === 'mayorista' ? ' ⭐' : ''}</option>)}
                    </select>
                  )}
                </div>

                {/* Search Results */}
                {posSearchFocused && filteredPosResults.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {filteredPosResults.map((tire, idx) => {
                      const pm = PAYMENT_METHODS.find(p => p.id === posPayment);
                      const price = calculatePrice(tire.costPrice, tire.margin, pm?.surcharge || 0);
                      return (
                        <button
                          key={tire.id}
                          onClick={() => addToCart(tire)}
                          className={`w-full text-left p-3 hover:bg-orange-50 flex items-center justify-between ${idx === posSelectedIndex ? 'bg-orange-50' : ''}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{tire.brand} {tire.model}</p>
                            <p className="text-xs text-gray-500">{tire.size} • Stock: {tire.stock} • {tire.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#c47b12]">{formatCurrency(price)}</p>
                            <p className="text-xs text-gray-400">Costo: {formatCurrency(tire.costPrice)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Carrito ({cart.length})</h3>
              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Carrito vacío</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => {
                    const pm = PAYMENT_METHODS.find(p => p.id === posPayment);
                    const price = calculatePrice(item.tire.costPrice, item.tire.margin, pm?.surcharge || 0);
                    return (
                      <div key={item.tire.id} className="border rounded-lg p-2">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="text-sm font-medium">{item.tire.brand} {item.tire.model}</p>
                            <p className="text-xs text-gray-400">{item.tire.size}</p>
                          </div>
                          <button onClick={() => removeFromCart(item.tire.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateCartQty(item.tire.id, item.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-500"><Minus className="w-3 h-3" /></button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={e => updateCartQty(item.tire.id, Number(e.target.value))}
                              className="w-10 text-center border rounded text-sm py-0.5"
                              min={1}
                              max={item.tire.stock}
                            />
                            <button onClick={() => updateCartQty(item.tire.id, item.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-500"><Plus className="w-3 h-3" /></button>
                          </div>
                          <p className="font-bold text-sm">{formatCurrency(price * item.quantity)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-[#c47b12]">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={completeSale} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">✓ Confirmar Venta</button>
                    <button onClick={() => printSale({ id: '', items: cart.map(i => { const pm2 = PAYMENT_METHODS.find(p => p.id === posPayment); const price = calculatePrice(i.tire.costPrice, i.tire.margin, pm2?.surcharge || 0); return { tireId: i.tire.id, brand: i.tire.brand, model: i.tire.model, size: i.tire.size, quantity: i.quantity, unitPrice: price, subtotal: price * i.quantity }; }), total: cartTotal, paymentMethod: posPayment, clientName: posClient?.name, date: new Date().toISOString(), notes: '' })} className="px-3 py-2.5 border rounded-lg text-sm hover:bg-gray-50"><Printer className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            INVENTORY TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setInvView('stock')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${invView === 'stock' ? 'bg-[#c47b12] text-white' : 'bg-white border'}`}>Vista Stock</button>
                <button onClick={() => setInvView('seller')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${invView === 'seller' ? 'bg-[#c47b12] text-white' : 'bg-white border'}`}>Vista Vendedor</button>
                <span className="text-xs text-gray-400 ml-1">{filteredTires.length} / {tires.length} productos</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                <div className="flex-1 min-w-[160px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Buscar..." />
                </div>
                {/* CSV import: drag-and-drop zone */}
                <label
                  className="px-3 py-2 border border-dashed border-[#c47b12] text-[#c47b12] rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer hover:bg-amber-50 transition"
                  title="Importar desde archivo CSV"
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
                      handleCsvFile(file);
                      setShowCsvImport(true);
                    } else {
                      setToast({ message: 'Solo se aceptan archivos .csv', type: 'error' });
                    }
                  }}
                >
                  <input
                    type="file" accept=".csv,text/csv" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { handleCsvFile(file); setShowCsvImport(true); }
                      e.target.value = '';
                    }}
                  />
                  <Upload className="w-4 h-4" /> Importar CSV
                </label>
                <button
                  onClick={handleCsvImportFromSupplierCatalog}
                  className="px-3 py-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap transition"
                  title="Carga los 978 productos de Firemax, Triangle, Kumho, Corral, Bull Vial, Linglong, Milever, Xbri, Fate y Maxi-Tango"
                >
                  <Package className="w-4 h-4" /> Catálogo Proveedores
                </button>
                <button onClick={() => { setInvEditing(null); setInvShowForm(true); }} className="px-3 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium flex items-center gap-1 whitespace-nowrap"><Plus className="w-4 h-4" /> Nuevo</button>
              </div>
            </div>

            {/* Category + brand filters */}
            <div className="flex flex-wrap gap-2">
              {[...new Set(tires.map(t => t.brand))].sort().map(brand => (
                <button
                  key={brand}
                  onClick={() => setInvSearch(prev => prev === brand ? '' : brand)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${invSearch === brand ? 'bg-[#c47b12] text-white border-[#c47b12]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#c47b12] hover:text-[#c47b12]'}`}
                >
                  {brand}
                </button>
              ))}
              {invSearch && (
                <button onClick={() => setInvSearch('')} className="px-2.5 py-1 rounded-full text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition flex items-center gap-1">
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>

            {/* CSV Format Guide */}
            <details className="bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <summary className="px-4 py-2.5 cursor-pointer font-medium text-blue-800 flex items-center gap-2 select-none">
                <Info className="w-4 h-4" /> Formato CSV para importación — click para ver
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-2 text-blue-900">
                <p className="text-xs">El archivo puede usar separador <code className="bg-blue-100 px-1 rounded">;</code> o <code className="bg-blue-100 px-1 rounded">,</code>. Los nombres de columna se detectan automáticamente en español o inglés.</p>
                <div className="bg-white rounded-lg border border-blue-200 overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead className="bg-blue-100">
                      <tr>
                        {['Columna','Nombres aceptados','Obligatorio','Ejemplo'].map(h => (
                          <th key={h} className="text-left px-3 py-1.5 font-semibold text-blue-800">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {[
                        ['Marca','marca, brand','✓','Kumho'],
                        ['Modelo','modelo, model, diseño','✓','ES31'],
                        ['Medida','medida, size, talla','✓','185/65 R15'],
                        ['Precio venta','precio_venta, precio, reventa, contado','✓ o con margen','85000'],
                        ['Precio costo','precio_costo, costo, cost','Opcional','65000'],
                        ['Margen %','margen, margin','Opcional (se calcula)','30'],
                        ['Stock','stock, cantidad, qty','Opcional','8'],
                        ['Stock mínimo','stock_minimo, minimo, min_stock','Opcional','2'],
                        ['Categoría','categoria, category, tipo','Opcional (se infiere)','Auto'],
                        ['Ubicación','ubicacion, location, pasillo','Opcional','A-3'],
                        ['Notas','notas, notes, observaciones','Opcional','Importado'],
                      ].map(([col, names, req, ex]) => (
                        <tr key={col} className="hover:bg-blue-50">
                          <td className="px-3 py-1.5 font-medium">{col}</td>
                          <td className="px-3 py-1.5 font-mono text-blue-700">{names}</td>
                          <td className="px-3 py-1.5">{req}</td>
                          <td className="px-3 py-1.5 text-gray-600">{ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-blue-700 mt-1">💡 Si precio_costo y margen están presentes pero precio_venta no, el precio se calcula automáticamente. Los duplicados exactos (misma marca+modelo+medida y mismo precio) se saltean sin error.</p>
              </div>
            </details>

            {invShowForm && <TireForm tire={invEditing} onSave={saveTire} onCancel={() => { setInvShowForm(false); setInvEditing(null); }} />}

            {invView === 'stock' ? (
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Marca</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Modelo</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Medida</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600">Costo</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600">Margen</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600">P. Venta</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">Stock</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">Ubic.</th>
                    <th className="px-3 py-2.5"></th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filteredTires.map(t => (
                      <tr key={t.id} className={`hover:bg-gray-50 ${t.stock <= t.minStock ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 font-medium">{t.brand}</td>
                        <td className="px-3 py-2">{t.model}</td>
                        <td className="px-3 py-2"><Badge color="bg-gray-100 text-gray-700">{t.size}</Badge></td>
                        <td className="px-3 py-2 text-right">{formatCurrency(t.costPrice)}</td>
                        <td className="px-3 py-2 text-right">{t.margin}%</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(t.salePrice)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${t.stock <= t.minStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{t.stock}</span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{t.location}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => { setInvEditing(t); setInvShowForm(true); }} className="p-1 text-gray-400 hover:text-[#c47b12]"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => setModal({ show: true, title: 'Eliminar neumático', message: `¿Eliminar ${t.brand} ${t.model} ${t.size}?`, type: 'danger', onConfirm: () => deleteTire(t.id), confirmText: 'Eliminar' })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTires.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No hay neumáticos</p>}
              </div>
            ) : (
              /* Vista Vendedor */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTires.map(t => (
                  <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.stock <= t.minStock ? 'border-red-300' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{t.brand}</p>
                        <p className="text-sm text-gray-600">{t.model}</p>
                      </div>
                      <Badge color="bg-gray-100 text-gray-700">{t.size}</Badge>
                    </div>
                    <div className="space-y-1 mt-3">
                      {PAYMENT_METHODS.filter(p => p.id !== 'cuenta_corriente').map(p => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className="text-gray-500">{p.label}:</span>
                          <span className="font-medium">{formatCurrency(calculatePrice(t.costPrice, t.margin, p.surcharge))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-between items-center text-xs text-gray-400">
                      <span>Stock: <span className={`font-bold ${t.stock <= t.minStock ? 'text-red-600' : 'text-green-600'}`}>{t.stock}</span></span>
                      <span>{t.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            CLIENTS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white" placeholder="Buscar cliente..." />
              </div>
              <button onClick={() => { setSelectedClient(null); setShowClientForm(true); }} className="px-3 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Nuevo</button>
            </div>

            {showClientForm && <ClientForm client={selectedClient && clientEditing ? selectedClient : null} onSave={saveClient} onCancel={() => { setShowClientForm(false); setClientEditing(false); }} />}

            {selectedClient && !showClientForm ? (
              /* Client Detail */
              <div className="space-y-4">
                <button onClick={() => setSelectedClient(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Volver</button>
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">{selectedClient.name}</h2>
                        {selectedClient.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700"><Crown className="w-3 h-3 mr-1" />Mayorista</Badge>}
                        <Badge color={getDebtStatus(selectedClient).color}>{getDebtStatus(selectedClient).label}</Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        {selectedClient.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedClient.phone}</span>}
                        {selectedClient.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedClient.email}</span>}
                        {selectedClient.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedClient.address}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(() => {
                        const lastOrder = orders.filter(o => o.clientId === selectedClient.id && o.status !== 'cancelado').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                        if (lastOrder && !showRepeatOrderConfirm) return (
                          <button
                            onClick={() => setShowRepeatOrderConfirm(true)}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-1"
                          >
                            <RotateCcw className="w-4 h-4" /> Repetir último pedido
                          </button>
                        );
                        return null;
                      })()}
                      <button onClick={() => { setClientEditing(true); setShowClientForm(true); }} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"><Edit className="w-4 h-4" /> Editar</button>
                    </div>
                    {showRepeatOrderConfirm && (() => {
                      const lastOrder = orders.filter(o => o.clientId === selectedClient.id && o.status !== 'cancelado').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                      return (
                        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <h4 className="font-semibold text-sm text-emerald-900 flex items-center gap-2"><RotateCcw className="w-4 h-4" />Repetir pedido</h4>
                          <p className="text-sm text-emerald-800 mt-1">Se cargará en el carrito:</p>
                          <div className="mt-2 space-y-1">
                            {lastOrder.items.map(i => (
                              <p key={i.tireId} className="text-sm text-emerald-700">{i.quantity}x {i.brand} {i.model} {i.size} — {formatCurrency(i.unitPrice * i.quantity)}</p>
                            ))}
                          </div>
                          <p className="text-sm font-bold text-emerald-900 mt-2">Total: {formatCurrency(lastOrder.totalAmount)}</p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => {
                                // Load items into POS cart
                                const cartItems: CartItem[] = lastOrder.items.map(item => {
                                  const tire = tires.find(t => t.id === item.tireId);
                                  return tire ? { tire, quantity: item.quantity, unitPrice: tire.salePrice } : null;
                                }).filter(Boolean) as CartItem[];
                                setCart(cartItems);
                                setPosClient(selectedClient);
                                setShowRepeatOrderConfirm(false);
                                setSelectedClient(null);
                                setActiveTab('pos');
                                setToast({ message: `Items del pedido ${lastOrder.numero} cargados en el mostrador`, type: 'success' });
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                            >
                              Cargar en Mostrador
                            </button>
                            <button onClick={() => setShowRepeatOrderConfirm(false)} className="px-4 py-2 border rounded-lg text-sm">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Saldo</p>
                      <p className={`text-lg font-bold ${selectedClient.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(selectedClient.balance)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Cupo Crédito</p>
                      <p className="text-lg font-bold text-gray-700">{selectedClient.cupoCredito ? formatCurrency(selectedClient.cupoCredito) : 'Sin límite'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Compras</p>
                      <p className="text-lg font-bold text-gray-700">{sales.filter(s => s.clientId === selectedClient.id).length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">PIN Portal</p>
                      <p className="text-lg font-bold text-gray-700">{selectedClient.pinHash ? '✓' : '✗'}</p>
                    </div>
                  </div>
                </div>

                {/* Client's purchase history */}
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-bold text-gray-900 mb-3">Historial de Compras</h3>
                  {sales.filter(s => s.clientId === selectedClient.id).slice(0, 10).map(sale => (
                    <div key={sale.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm">{sale.items.map(i => `${i.quantity}x ${i.brand} ${i.model}`).join(', ')}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(sale.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatCurrency(sale.total)}</p>
                        <button onClick={() => printSale(sale)} className="text-xs text-[#c47b12] hover:underline">Reimprimir</button>
                      </div>
                    </div>
                  ))}
                  {sales.filter(s => s.clientId === selectedClient.id).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin compras registradas</p>
                  )}
                </div>
              </div>
            ) : !showClientForm && (
              /* Client List */
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="divide-y">
                  {filteredClients.map(c => {
                    const debt = getDebtStatus(c);
                    return (
                      <button key={c.id} onClick={() => setSelectedClient(c)} className="w-full text-left p-4 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${c.tipoCliente === 'mayorista' ? 'bg-amber-500' : 'bg-gray-400'}`}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{c.name}</p>
                              {c.tipoCliente === 'mayorista' && <Badge color="bg-amber-100 text-amber-700"><Crown className="w-3 h-3" /></Badge>}
                              <Badge color={debt.color}>{debt.label}</Badge>
                            </div>
                            <p className="text-xs text-gray-400">{c.phone} {c.email ? `• ${c.email}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${c.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(c.balance)}</p>
                          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {filteredClients.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No hay clientes</p>}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ACCOUNTS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Cuentas Corrientes</h2>
            {clients.filter(c => c.balance !== 0).length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay cuentas con saldo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clients.filter(c => c.balance !== 0).sort((a, b) => b.balance - a.balance).map(c => (
                  <AccountCard key={c.id} client={c} addPayment={addPayment} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            INVOICES TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={invFilter} onChange={e => setInvFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white" placeholder="Buscar factura..." />
              </div>
              <button onClick={() => { setEditingInvoice(null); setShowInvoiceForm(true); }} className="px-3 py-2 bg-[#c47b12] text-white rounded-lg text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Nueva</button>
            </div>

            {showInvoiceForm && <InvoiceForm invoice={editingInvoice} onSave={saveInvoice} onCancel={() => { setShowInvoiceForm(false); setEditingInvoice(null); }} />}

            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600">Número</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600">Proveedor</th>
                  <th className="text-left px-3 py-2.5 font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-3 py-2.5 font-medium text-gray-600">Total</th>
                  <th className="text-center px-3 py-2.5 font-medium text-gray-600">Estado</th>
                  <th className="px-3 py-2.5"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2"><Badge color="bg-blue-100 text-blue-700">{inv.type}</Badge></td>
                      <td className="px-3 py-2 font-medium">{inv.number}</td>
                      <td className="px-3 py-2">{inv.supplier}</td>
                      <td className="px-3 py-2 text-gray-500">{formatDate(inv.date)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(inv.total)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge color={inv.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{inv.paid ? 'Pagada' : 'Pendiente'}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => { setEditingInvoice(inv); setShowInvoiceForm(true); }} className="p-1 text-gray-400 hover:text-[#c47b12]"><Edit className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInvoices.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No hay facturas</p>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ORDERS TAB (EMPLOYEE) — Kanban / List / Calendar
            ═══════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Order Detail Overlay */}
            {selectedOrderId && (() => {
              const order = orders.find(o => o.id === selectedOrderId);
              if (!order) return null;
              const client = clients.find(c => c.id === order.clientId);
              const isWholesale = client?.tipoCliente === 'mayorista';

              // Build status timeline
              const timelineStatuses = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado'];
              const currentIdx = timelineStatuses.indexOf(order.status);

              return (
                <div className="bg-white rounded-xl border shadow-lg">
                  <div className="p-4 flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{order.numero}</h3>
                        {isWholesale && <Badge color="bg-amber-100 text-amber-700"><Crown className="w-3 h-3 mr-1" />Mayorista</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">{order.clientName} • {order.items.map(i => `${i.quantity}x ${i.brand} ${i.size}`).join(', ')}</p>
                    </div>
                    <button onClick={() => setSelectedOrderId('')} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Status Timeline */}
                  <div className="px-4 pb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Seguimiento</h4>
                    <div className="flex items-center gap-1">
                      {timelineStatuses.map((s, idx) => {
                        const done = idx <= currentIdx;
                        const isCancelled = order.status === 'cancelado';
                        if (isCancelled && s === 'entregado') {
                          return (
                            <div key={s} className="flex items-center gap-1 flex-1">
                              <div className="flex-1 h-0.5 bg-red-200" style={{ marginTop: '-12px' }} />
                              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0" style={{ marginTop: '-12px' }}>
                                <X className="w-3 h-3 text-red-600" />
                              </div>
                              <span className="text-xs text-red-600 font-medium min-w-[48px]" style={{ marginTop: '-12px' }}>Cancelado</span>
                            </div>
                          );
                        }
                        return (
                          <div key={s} className="flex items-center gap-1 flex-1">
                            <div className={`flex-1 h-0.5 ${idx === 0 ? 'opacity-0' : done ? 'bg-[#c47b12]' : 'bg-gray-200'}`} style={{ marginTop: '-12px' }} />
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-[#c47b12]' : 'bg-gray-200'}`} style={{ marginTop: '-12px' }}>
                              {done ? <Check className="w-3 h-3 text-white" /> : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                            </div>
                            <span className={`text-xs font-medium min-w-[48px] ${done ? 'text-gray-900' : 'text-gray-400'}`} style={{ marginTop: '-12px' }}>{STATUS_LABELS[s]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Última actualización: {formatDateTime(order.updatedAt)}
                    </div>
                  </div>

                  {/* Order details */}
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Forma de pago:</span> <span className="font-medium">{PAYMENT_METHODS.find(p => p.id === order.paymentMethod)?.label || order.paymentMethod}</span></div>
                    <div><span className="text-gray-500">Total:</span> <span className="font-bold text-[#c47b12]">{formatCurrency(order.totalAmount)}</span></div>
                    <div><span className="text-gray-500">Fecha retiro/entrega:</span> <span className="font-medium">{formatDate(order.scheduledDate)} {order.scheduledTime}</span></div>
                    <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{order.tipo === 'retiro' ? 'Retiro en local' : 'Entrega a domicilio'}</span></div>
                    {order.address && <div className="col-span-2"><span className="text-gray-500">Dirección:</span> <span className="font-medium">{order.address}</span></div>}
                    {order.notes && <div className="col-span-2"><span className="text-gray-500">Notas cliente:</span> <span className="font-medium">{order.notes}</span></div>}
                    {order.internalNotes && <div className="col-span-2"><span className="text-gray-500">Notas internas:</span> <span className="font-medium text-blue-700">{order.internalNotes}</span></div>}
                    {order.clientMessage && <div className="col-span-2"><span className="text-gray-500">Mensaje al cliente:</span> <span className="font-medium text-green-700">{order.clientMessage}</span></div>}
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-4 flex gap-2 flex-wrap">
                    {STATUS_FLOW[order.status]?.filter(s => s !== 'cancelado').map(nextStatus => (
                      <WhatsAppQuickButton key={nextStatus} order={order} nextStatus={nextStatus} updateOrderStatus={updateOrderStatus} setModal={setModal} setToast={setToast} />
                    ))}
                    {STATUS_FLOW[order.status]?.map(nextStatus => (
                      nextStatus === 'cancelado' && (
                        <button key={nextStatus} onClick={() => {
                          setModal({ show: true, title: 'Cancelar pedido', message: `¿Cancelar pedido ${order.numero}?`, type: 'danger', confirmText: 'Cancelar pedido', onConfirm: () => updateOrderStatus(order.id, 'cancelado') });
                        }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200">
                          <X className="w-3 h-3 inline mr-1" />Cancelar
                        </button>
                      )
                    ))}
                    <button onClick={() => printOrder(order)} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 flex items-center gap-1"><Printer className="w-3 h-3" />Imprimir</button>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
              <div className="flex gap-2 items-center flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">Pedidos</h2>
                <div className="flex gap-0.5 border rounded-lg overflow-hidden">
                  {[
                    { id: 'kanban' as OrdersViewMode, label: 'Kanban' },
                    { id: 'list' as OrdersViewMode, label: 'Lista' },
                    { id: 'calendar' as OrdersViewMode, label: 'Calendario' },
                  ].map(view => (
                    <button
                      key={view.id}
                      onClick={() => setOrdersViewMode(view.id)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${ordersViewMode === view.id ? 'bg-[#c47b12] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
                  <option value="all">Todos los estados</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
                  <option value="all">Todos los tipos</option>
                  <option value="retiro">Retiro</option>
                  <option value="entrega_domicilio">Entrega</option>
                </select>
                <input type="date" value={orderDateFilter} onChange={e => setOrderDateFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
                {orderDateFilter && <button onClick={() => setOrderDateFilter('')} className="text-xs text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>}
              </div>
            </div>

            {ordersViewMode === 'kanban' ? (
              /* ═══ Kanban View ═══ */
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto">
                {(['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado'] as const).map(status => {
                  const statusOrders = filteredOrders.filter(o => o.status === status);
                  return (
                    <div key={status} className="bg-stone-100 rounded-xl p-3 min-w-[230px]">
                      <div className="flex items-center gap-2 mb-3">
                        <StatusBadge status={status} />
                        <span className="text-xs text-gray-400">({statusOrders.length})</span>
                      </div>
                      <div className="space-y-2" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                        {statusOrders.map(order => {
                          const client = clients.find(c => c.id === order.clientId);
                          const isWholesale = client?.tipoCliente === 'mayorista';
                          return (
                            <div
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className={`bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${isWholesale ? 'border-amber-300 ring-1 ring-amber-200' : ''} ${selectedOrderId === order.id ? 'ring-2 ring-[#c47b12]' : ''}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-bold text-xs text-gray-900">{order.numero}</p>
                                <div className="flex items-center gap-1">
                                  {isWholesale && <Crown className="w-3 h-3 text-amber-500" />}
                                  <p className="font-bold text-xs text-[#c47b12]">{formatCurrency(order.totalAmount)}</p>
                                </div>
                              </div>
                              <p className="text-xs font-medium text-gray-700">{order.clientName}</p>
                              <p className="text-xs text-gray-400 mt-1">{order.items.map(i => `${i.quantity}x ${i.brand}`).join(', ')}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-400">{formatDate(order.scheduledDate)}</span>
                                {order.tipo === 'retiro' ? <MapPin className="w-3 h-3 text-gray-400" /> : <Truck className="w-3 h-3 text-gray-400" />}
                              </div>
                              {/* Quick confirm for pending */}
                              {order.status === 'pendiente' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'confirmado', 'Pedido confirmado por empleado'); }}
                                  className="w-full mt-2 px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Confirmar rápido
                                </button>
                              )}
                              {order.status === 'listo' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'entregado'); }}
                                  className="w-full mt-2 px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Entregado
                                </button>
                              )}
                              {/* Action row */}
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {STATUS_FLOW[order.status]?.map(nextStatus => {
                                  if (order.status === 'pendiente' && nextStatus === 'confirmado') return null;
                                  if (order.status === 'listo' && nextStatus === 'entregado') return null;
                                  return (
                                    <button
                                      key={nextStatus}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (nextStatus === 'cancelado') {
                                          setModal({ show: true, title: 'Cancelar pedido', message: `¿Cancelar pedido ${order.numero}?`, type: 'danger', confirmText: 'Cancelar pedido', onConfirm: () => updateOrderStatus(order.id, 'cancelado') });
                                        } else if (nextStatus === 'listo') {
                                          updateOrderStatus(order.id, 'listo', undefined, 'Su pedido está listo para retirar');
                                        } else {
                                          updateOrderStatus(order.id, nextStatus);
                                        }
                                      }}
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        nextStatus === 'cancelado' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                                        nextStatus === 'entregado' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                        'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                      }`}
                                    >
                                      {STATUS_LABELS[nextStatus]}
                                    </button>
                                  );
                                })}
                                <button onClick={(e) => { e.stopPropagation(); printOrder(order); }} className="p-1 text-gray-400 hover:text-[#c47b12]"><Printer className="w-3 h-3" /></button>
                              </div>
                            </div>
                          );
                        })}
                        {statusOrders.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin pedidos</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : ordersViewMode === 'calendar' ? (
              /* ═══ Calendar View — Weekly grid ═══ */
              (() => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const monday = new Date(now);
                monday.setDate(now.getDate() - dayOfWeek + 1);
                const weekDays = [];
                for (let i = 0; i < 7; i++) {
                  const d = new Date(monday);
                  d.setDate(monday.getDate() + i);
                  weekDays.push(d);
                }
                const isToday = (d: Date) => d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
                const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

                return (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-gray-700">
                        Semana del {formatDate(monday.toISOString())} al {formatDate(weekDays[6].toISOString())}
                      </h3>
                      <span className="text-xs text-gray-400">{filteredOrders.filter(o => o.status !== 'cancelado' && o.status !== 'entregado').length} pedidos activos en la semana</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day, idx) => {
                        const dateStr = day.toISOString().slice(0, 10);
                        const dayOrders = filteredOrders.filter(o => o.scheduledDate === dateStr);
                        return (
                          <div key={idx} className={`rounded-lg border p-2 ${isToday(day) ? 'bg-orange-50 border-[#c47b12]' : 'bg-white'}`}>
                            <div className="text-center mb-2">
                              <p className={`text-xs font-medium ${isToday(day) ? 'text-[#c47b12]' : 'text-gray-500'}`}>{dayNames[idx]}</p>
                              <p className={`text-lg font-bold ${isToday(day) ? 'text-[#c47b12]' : 'text-gray-700'}`}>{day.getDate()}</p>
                            </div>
                            <div className="space-y-1.5" style={{ minHeight: '60px' }}>
                              {dayOrders.map(order => {
                                const client = clients.find(c => c.id === order.clientId);
                                const isWholesale = client?.tipoCliente === 'mayorista';
                                return (
                                  <div
                                    key={order.id}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={`bg-stone-50 rounded p-2 cursor-pointer hover:bg-stone-100 transition-colors text-xs ${isWholesale ? 'border-l-2 border-amber-400' : ''}`}
                                  >
                                    <div className="font-medium truncate">{order.clientName}</div>
                                    <div className="text-gray-400 truncate">{order.items.map(i => `${i.quantity}x ${i.brand}`).join(', ')}</div>
                                    <div className="flex items-center justify-between mt-1">
                                      <StatusBadge status={order.status} />
                                      <span className="font-bold text-[#c47b12]">{formatCurrency(order.totalAmount)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {dayOrders.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Sin pedidos</p>}
                            </div>
                            {dayOrders.length > 0 && (
                              <div className="mt-2 pt-1 border-t text-center">
                                <span className="text-xs font-medium text-gray-500">{dayOrders.length} pedido{dayOrders.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ═══ List View ═══ */
              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">N° Pedido</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Cliente</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Items</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Fecha</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600">Total</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">Estado</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600">Tipo</th>
                    <th className="px-3 py-2.5"></th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {filteredOrders.map(order => {
                      const client = clients.find(c => c.id === order.clientId);
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-gray-50 cursor-pointer ${client?.tipoCliente === 'mayorista' ? 'bg-amber-50/50' : ''}`}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <td className="px-3 py-2 font-medium">{order.numero}</td>
                          <td className="px-3 py-2">{order.clientName}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{order.items.map(i => `${i.quantity}x ${i.brand}`).join(', ')}</td>
                          <td className="px-3 py-2 text-gray-500">{formatDate(order.scheduledDate)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(order.totalAmount)}</td>
                          <td className="px-3 py-2 text-center"><StatusBadge status={order.status} /></td>
                          <td className="px-3 py-2 text-center">{order.tipo === 'retiro' ? <MapPin className="w-3 h-3 mx-auto text-gray-400" /> : <Truck className="w-3 h-3 mx-auto text-gray-400" />}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {STATUS_FLOW[order.status]?.filter(s => s !== 'cancelado').map(nextStatus => (
                                <button key={nextStatus} onClick={(e) => {
                                  e.stopPropagation();
                                  if (nextStatus === 'listo') updateOrderStatus(order.id, 'listo', undefined, 'Su pedido está listo para retirar');
                                  else updateOrderStatus(order.id, nextStatus);
                                }} className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200">{STATUS_LABELS[nextStatus]}</button>
                              ))}
                              <button onClick={(e) => { e.stopPropagation(); printOrder(order); }} className="p-1 text-gray-400 hover:text-[#c47b12]"><Printer className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredOrders.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No hay pedidos</p>}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ANALYTICS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Análisis y Métricas</h2>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Ventas del Mes</p>
                <p className="text-2xl font-bold text-[#c47b12]">{formatCurrency(analytics.monthRevenue)}</p>
                <p className="text-xs text-gray-400">{analytics.monthSalesCount} ventas</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Mes Anterior</p>
                <p className="text-2xl font-bold text-gray-700">{formatCurrency(analytics.lastMonthRevenue)}</p>
                {analytics.lastMonthRevenue > 0 && (
                  <p className={`text-xs flex items-center gap-0.5 ${analytics.monthRevenue >= analytics.lastMonthRevenue ? 'text-green-600' : 'text-red-600'}`}>
                    {analytics.monthRevenue >= analytics.lastMonthRevenue ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(Math.round((analytics.monthRevenue - analytics.lastMonthRevenue) / analytics.lastMonthRevenue * 100))}%
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Stock Total</p>
                <p className="text-2xl font-bold text-gray-700">{analytics.totalTires}</p>
                <p className="text-xs text-red-500">{analytics.lowStock.length} bajo mínimo</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Deuda Total</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(analytics.totalDebt)}</p>
                <p className="text-xs text-gray-400">{clients.filter(c => c.balance > 0).length} clientes</p>
              </div>
            </div>

            {/* Orders KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Pedidos Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">{analytics.pendingOrders}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Pedidos Entregados</p>
                <p className="text-2xl font-bold text-green-600">{analytics.deliveredOrders}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Clientes Activos</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.activeClients}</p>
                <p className="text-xs text-gray-400">{analytics.inactiveClients} inactivos</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Pedidos por Tipo</p>
                <p className="text-sm font-medium">📍 Retiro: {analytics.ordersByType.retiro}</p>
                <p className="text-sm font-medium">🚛 Entrega: {analytics.ordersByType.entrega}</p>
              </div>
            </div>

            {/* Brand chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-bold text-gray-900 mb-3">Ventas por Marca</h3>
                {analytics.topBrands.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.topBrands.map(([brand, qty]) => (
                      <div key={brand}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{brand}</span>
                          <span className="text-gray-500">{qty} unidades</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#c47b12] rounded-full" style={{ width: `${(qty / analytics.maxBrandQty) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-bold text-gray-900 mb-3">Top 5 Clientes por Volumen</h3>
                {analytics.topClients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.topClients.map(([name, total], idx) => (
                      <div key={name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                          <span className="text-sm font-medium">{name}</span>
                        </div>
                        <span className="font-bold text-sm text-[#c47b12]">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Low stock alert */}
            {analytics.lowStock.length > 0 && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Stock Bajo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {analytics.lowStock.map(t => (
                    <div key={t.id} className="bg-white rounded-lg p-2 flex justify-between items-center">
                      <span className="text-sm">{t.brand} {t.model} {t.size}</span>
                      <Badge color="bg-red-100 text-red-700">Stock: {t.stock}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales History */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-bold text-gray-900 mb-3">Últimas Ventas</h3>
              <div className="divide-y">
                {sales.slice(0, 15).map(sale => (
                  <div key={sale.id} className="flex justify-between items-center py-2">
                    <div>
                      <p className="text-sm">{sale.items.map(i => `${i.quantity}x ${i.brand} ${i.model}`).join(', ')}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(sale.date)} {sale.clientName ? `• ${sale.clientName}` : ''} • {PAYMENT_METHODS.find(p => p.id === sale.paymentMethod)?.label}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="font-bold text-sm">{formatCurrency(sale.total)}</p>
                      <button onClick={() => printSale(sale)} className="text-gray-400 hover:text-[#c47b12]"><Printer className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              {sales.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin ventas registradas</p>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SETTINGS TAB
            ═══════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-lg font-bold text-gray-900">Ajustes</h2>

            {/* Change Password */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Lock className="w-4 h-4" /> Cambiar Contraseña Empleado</h3>
              <PasswordChanger onChangeHash={setEmployeeHash} setToast={(t) => setToast(t)} />
            </div>

            {/* Order Availability Config */}
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-4 h-4" /> Disponibilidad para Pedidos</h3>

              <div className="flex items-center justify-between">
                <span className="text-sm">Recepción de pedidos online</span>
                <button
                  onClick={() => setOrderConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors ${orderConfig.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${orderConfig.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 block mb-2">Días hábiles</label>
                <div className="flex gap-2 flex-wrap">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => setOrderConfig(prev => {
                        const workDays = [...prev.workDays];
                        workDays[idx] = !workDays[idx];
                        return { ...prev, workDays };
                      })}
                      className={`w-10 h-10 rounded-lg text-xs font-medium ${orderConfig.workDays[idx] ? 'bg-[#c47b12] text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Anticipación mínima (días)</label>
                  <input type="number" value={orderConfig.minDaysAhead} onChange={e => setOrderConfig(prev => ({ ...prev, minDaysAhead: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={0} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Anticipación máxima (días)</label>
                  <input type="number" value={orderConfig.maxDaysAhead} onChange={e => setOrderConfig(prev => ({ ...prev, maxDaysAhead: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={1} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Máximo pedidos por día</label>
                <input type="number" value={orderConfig.maxOrdersPerDay} onChange={e => setOrderConfig(prev => ({ ...prev, maxOrdersPerDay: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={1} />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Horarios disponibles</label>
                <div className="space-y-1">
                  {orderConfig.timeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input type="text" value={slot} onChange={e => setOrderConfig(prev => {
                        const timeSlots = [...prev.timeSlots];
                        timeSlots[idx] = e.target.value;
                        return { ...prev, timeSlots };
                      })} className="flex-1 border rounded px-2 py-1.5 text-sm" />
                      <button onClick={() => setOrderConfig(prev => ({ ...prev, timeSlots: prev.timeSlots.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrderConfig(prev => ({ ...prev, timeSlots: [...prev.timeSlots, ''] }))} className="text-xs text-[#c47b12] hover:underline">+ Agregar horario</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Fechas bloqueadas</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {orderConfig.blockedDates.map(d => (
                    <span key={d} className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                      {formatDate(d)}
                      <button onClick={() => setOrderConfig(prev => ({ ...prev, blockedDates: prev.blockedDates.filter(bd => bd !== d) }))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <input type="date" onChange={e => {
                  if (e.target.value && !orderConfig.blockedDates.includes(e.target.value)) {
                    setOrderConfig(prev => ({ ...prev, blockedDates: [...prev.blockedDates, e.target.value] }));
                  }
                  e.target.value = '';
                }} className="border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>

            {/* Wholesale Config */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Configuración Mayorista</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Descuento global (%)</label>
                  <input type="number" value={wholesaleConfig.globalDiscount} onChange={e => setWholesaleConfig(prev => ({ ...prev, globalDiscount: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={0} max={50} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Mín. unid. por artículo</label>
                  <input type="number" value={wholesaleConfig.minUnitsPerItem} onChange={e => setWholesaleConfig(prev => ({ ...prev, minUnitsPerItem: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={1} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Mín. monto pedido</label>
                  <input type="number" value={wholesaleConfig.minOrderAmount} onChange={e => setWholesaleConfig(prev => ({ ...prev, minOrderAmount: Number(e.target.value) }))} className="w-full border rounded px-2 py-1.5 text-sm" min={0} />
                </div>
              </div>
            </div>

            {/* Backup / Restore */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Download className="w-4 h-4" /> Backup y Restauración</h3>
              <div className="flex gap-2">
                <button onClick={exportBackup} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><Download className="w-4 h-4" /> Descargar Backup</button>
                <label className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1 cursor-pointer">
                  <Upload className="w-4 h-4" /> Restaurar
                  <input type="file" accept=".json" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setModal({
                        show: true, title: 'Restaurar backup', message: '¿Está seguro? Esto reemplazará todos los datos actuales.',
                        type: 'warning', confirmText: 'Restaurar',
                        onConfirm: () => importBackup(file),
                      });
                    }
                  }} />
                </label>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 space-y-3">
              <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Zona de Peligro</h3>
              <button
                onClick={() => setModal({
                  show: true, title: 'Resetear datos', message: 'Esta acción eliminará TODOS los datos del sistema. No se puede deshacer.',
                  type: 'danger', confirmText: 'Eliminar Todo',
                  onConfirm: () => {
                    setTires([]);
                    setClients([]);
                    setSales([]);
                    setInvoices([]);
                    setOrders([]);
                    setOrderConfig(DEFAULT_ORDER_CONFIG);
                    setWholesaleConfig(DEFAULT_WHOLESALE_CONFIG);
                    setEmployeeHash(EMPLOYEE_HASH_DEFAULT);
                    setToast({ message: 'Todos los datos han sido eliminados', type: 'info' });
                  },
                })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
              >
                Resetear Todos los Datos
              </button>
            </div>

            <div className="text-center text-xs text-gray-400 py-4">
              Baliña Ruedas — Sistema de Gestión v4.0 — Juan B. Justo 1980, Mar del Plata
            </div>
          </div>
        )}
      </main>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <ConfirmModal modal={modal} setModal={setModal} />
      {showCsvImport && (
        <CsvImportModal
          summary={csvSummary}
          fileName={csvFileName}
          activeTab={csvImportTab}
          setActiveTab={setCsvImportTab}
          applyUpdates={csvApplyUpdates}
          setApplyUpdates={setCsvApplyUpdates}
          onConfirm={confirmCsvImport}
          onClose={() => { setShowCsvImport(false); setCsvSummary(null); setCsvFileName(''); }}
          loading={csvLoading}
        />
      )}
    </div>
  );
}
