// ═══════════════════════════════════════════════════
// Sistema Octabalina (Baliña Ruedas) — Tipos de dominio
// ═══════════════════════════════════════════════════
//
// Estrategia de migración:
//   v1 (localStorage) coexiste con v2 (Supabase / multi-tienda) durante la
//   migración. Los componentes existentes siguen consumiendo tipos v1
//   (Tire, Client, Sale, Order, Invoice). Los servicios de Supabase mapean
//   row → tipo v1 para no romper la UI hasta Fase 1.
//
//   Las entidades NUEVAS (Store, Category, Employee, Receipt, CashSession,
//   ModifierGroup, Discount, Tax, PaymentMethod, etc.) se agregan abajo
//   sin tocar lo viejo.

// ═══════════════════════════════════════════════════
// v1 — Modelo legacy (UI sigue usando estos tipos)
// ═══════════════════════════════════════════════════

export interface Tire {
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
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  balance: number;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
  tipoCliente: 'minorista' | 'mayorista';
  descuentoMayorista: number;
  pinHash: string;
  cupoCredito: number;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  notes: string;
}

export interface SaleItem {
  tireId: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  surcharge: number;
  clientId?: string;
  clientName?: string;
  date: string;
  notes: string;
}

export interface Invoice {
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

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderItem {
  tireId: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type OrderStatus =
  | 'pendiente'
  | 'confirmado'
  | 'en_preparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export interface Order {
  id: string;
  numero: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  paymentMethod: string;
  status: OrderStatus;
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

export interface OrderConfig {
  enabled: boolean;
  workDays: boolean[];
  blockedDates: string[];
  minDaysAhead: number;
  maxDaysAhead: number;
  timeSlots: string[];
  maxOrdersPerDay: number;
}

export interface WholesaleConfig {
  globalDiscount: number;
  minUnitsPerItem: number;
  minOrderAmount: number;
}

export interface CartItem {
  tire: Tire;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ═══════════════════════════════════════════════════
// v2 — Entidades nuevas (Loyverse parity, multi-tienda)
// ═══════════════════════════════════════════════════

export interface Address {
  street: string;
  city: string;
  region: string;
  zip: string;
  country: string;
}

// ── Catálogo ───────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  address?: Address;
  phone?: string;
  description?: string;
  posDeviceName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

/**
 * Tire del modelo v2 — usado en Fase 1+. Por ahora se mapea desde Supabase
 * al `Tire` v1 antes de exponerse a la UI vieja.
 */
export interface TireV2 {
  id: string;
  brand: string;
  model: string;
  size: string;
  categoryId: string;
  cost: number;
  defaultPrice: number;
  defaultMargin: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  notes?: string;
  taxIds: string[];
  modifierGroupIds: string[];
  availableInAllStores: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TireStoreOverride {
  tireId: string;
  storeId: string;
  available: boolean;
  price: number;
  stock: number;
  lowStockThreshold: number;
  location?: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
  storeIds: string[] | null;
}

export interface Discount {
  id: string;
  name: string;
  type: 'percent' | 'amount';
  value: number | null;
  pinRestricted: boolean;
  storeIds: string[] | null;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  inclusion: 'included' | 'added';
  appliesToTireIds: string[];
  applyToNewTires: boolean;
  dependsOnOrderType: boolean;
  storeIds: string[] | null;
}

export interface PaymentMethod {
  id: string;
  type: 'cash' | 'card' | 'transfer' | 'other';
  name: string;
  surchargePercent: number;
  storeIds: string[] | null;
  sortOrder: number;
}

// ── Personas ───────────────────────────────────────

export type Permission =
  | 'pos.sell'
  | 'pos.refund'
  | 'pos.discount'
  | 'pos.openTickets'
  | 'pos.openCash'
  | 'pos.closeCash'
  | 'pos.cashMovement'
  | 'discounts.unrestricted'
  | 'backoffice.access'
  | 'tires.view'
  | 'tires.manage'
  | 'reports.view'
  | 'employees.manage'
  | 'customers.view'
  | 'customers.manage'
  | 'settings.manage';

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
}

export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  roleId: string;
  storeIds: string[] | null;
  pinHash: string;
  authUserId?: string;
  active: boolean;
  createdAt: string;
}

/**
 * Customer del modelo v2 — Fase 1+. Por ahora se mapea al `Client` v1
 * para mantener la UI vieja funcionando.
 */
export interface Customer {
  id: string;
  name: string;
  label?: string;
  email?: string;
  phone?: string;
  address?: Address;
  birthday?: string;
  note?: string;
  firstVisit?: string;
  lastVisit?: string;
  totalVisits: number;
  totalSpent: number;
  pointsBalance: number;
  creditLimit: number;
  accountBalance: number;
  pinHash?: string;
  customerType: 'retail' | 'wholesale';
  wholesaleDiscount?: number;
  authUserId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Transacciones ──────────────────────────────────

export interface AppliedDiscount {
  discountId: string;
  amount: number;
}

export interface AppliedTax {
  taxId: string;
  base: number;
  amount: number;
}

export interface PaymentSplit {
  paymentMethodId: string;
  amount: number;
}

export interface ReceiptLineModifier {
  groupId: string;
  optionId: string;
  name: string;
  price: number;
}

export interface LineDiscount {
  discountId: string;
  amount: number;
}

export interface LineTax {
  taxId: string;
  rate: number;
  amount: number;
  addedToTotal: boolean;
}

export interface ReceiptLine {
  id: string;
  receiptId: string;
  tireId: string;
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  categoryId: string;
  categoryName: string;
  modifiers: ReceiptLineModifier[];
  unitPrice: number;
  unitCost: number;
  quantity: number;
  lineDiscounts: LineDiscount[];
  lineTaxes: LineTax[];
  gross: number;
  net: number;
  total: number;
}

export type ReceiptType = 'sale' | 'refund';
export type ReceiptStatus = 'completed' | 'parked';

export interface Receipt {
  id: string;
  receiptNumber: string;
  storeId: string;
  cashSessionId: string;
  employeeId: string;
  customerId?: string;
  type: ReceiptType;
  status: ReceiptStatus;
  parkedName?: string;
  refundOfReceiptId?: string;
  appliedDiscounts: AppliedDiscount[];
  appliedTaxes: AppliedTax[];
  payments: PaymentSplit[];
  subtotalGross: number;
  totalDiscounts: number;
  subtotalNet: number;
  totalTaxes: number;
  totalCogs: number;
  total: number;
  pointsEarned: number;
  pointsRedeemed: number;
  notes?: string;
  createdAt: string;
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: 'pay_in' | 'pay_out';
  amount: number;
  reason: string;
  employeeId: string;
  at: string;
}

export interface CashSession {
  id: string;
  storeId: string;
  openedAt: string;
  openedByEmployeeId: string;
  openingFloat: number;
  closedAt?: string;
  closedByEmployeeId?: string;
  expectedCash?: number;
  countedCash?: number;
  variance?: number;
  notes?: string;
  status: 'open' | 'closed';
}

// Input para construir un Receipt en el cliente
export interface CartLine {
  tireId: string;
  quantity: number;
  modifiers: ReceiptLineModifier[];
  lineDiscountId?: string;
}

export interface BuildReceiptInput {
  storeId: string;
  cashSessionId: string;
  employeeId: string;
  customerId?: string;
  cart: CartLine[];
  ticketDiscountIds: string[];
  paymentSplits: PaymentSplit[];
  type: ReceiptType;
  parkedName?: string;
  pointsRedeemed?: number;
  notes?: string;
}

// ── Configuración ──────────────────────────────────

export interface AppFeatures {
  cashShifts: boolean;
  timeClock: boolean;
  openTickets: boolean;
  customerDisplay: boolean;
  orderTypes: boolean;
  lowStockNotifications: boolean;
  negativeStockAlert: boolean;
}

export interface LoyaltyConfig {
  enabled: boolean;
  earnPercent: number;
}

export interface ReceiptConfig {
  storeId: string;
  emailLogoUrl?: string;
  printedLogoUrl?: string;
  header: string;
  footer: string;
  showCustomerInfo: boolean;
  showComments: boolean;
}

export interface OpenTicketsConfig {
  storeId: string;
  usePredefined: boolean;
  predefinedNames: string[];
}

// ── Diferenciadores Octabalina (v2 de Invoice y Order) ──

export interface SupplierInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SupplierInvoice {
  id: string;
  type: 'A' | 'B' | 'C' | 'X';
  number: string;
  supplier: string;
  date: string;
  dueDate?: string;
  items: SupplierInvoiceItem[];
  subtotal: number;
  iva: number;
  total: number;
  paid: boolean;
  notes?: string;
  storeId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerOrderStatus = OrderStatus;

export interface CustomerOrderItem {
  tireId: string;
  brand: string;
  model: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CustomerOrder {
  id: string;
  numero: string;
  customerId?: string;
  customerName: string;
  storeId?: string;
  items: CustomerOrderItem[];
  paymentMethodId?: string;
  status: CustomerOrderStatus;
  tipo: 'retiro' | 'entrega_domicilio';
  scheduledDate?: string;
  scheduledTime?: string;
  address?: string;
  notes?: string;
  internalNotes?: string;
  clientMessage?: string;
  totalAmount: number;
  confirmedByEmployeeId?: string;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAccountMovement {
  id: string;
  customerId: string;
  type: 'charge' | 'payment';
  amount: number;
  paymentMethodId?: string;
  notes?: string;
  receiptId?: string;
  employeeId?: string;
  at: string;
}

export interface AppMetadata {
  schemaVersion: number;
  lastLocalBackupAt?: string;
  migratedFromLocalAt?: string;
}

// ═══════════════════════════════════════════════════
// UI / sesión (tipos compartidos)
// ═══════════════════════════════════════════════════

export type EmployeeTab =
  | 'pos'
  | 'inventory'
  | 'clients'
  | 'accounts'
  | 'invoices'
  | 'orders'
  | 'analytics'
  | 'settings';

export type ClientTab = 'catalog' | 'orders' | 'history' | 'account';

export type SessionType = 'employee' | 'client' | null;

export interface ModalState {
  show: boolean;
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  onConfirm?: (inputValue?: string) => void;
  confirmText?: string;
  inputField?: boolean;
  inputValue?: string;
  inputPlaceholder?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  clientId?: string;
  clientName?: string;
  expiresAt: number;
  loginAttempts: number;
  lockoutUntil: number;
}

export interface AppData {
  tires: Tire[];
  clients: Client[];
  sales: Sale[];
  invoices: Invoice[];
  orders: Order[];
  orderConfig: OrderConfig;
  wholesaleConfig: WholesaleConfig;
  employeeHash: string;
  lastBackup: string | null;
}
