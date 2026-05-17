import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel } from './supabaseHelpers';
import type { Role, Permission } from '@/types';

const TABLE = 'roles';

export const roleService = {
  async getAll(): Promise<Role[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'roleService.getAll').map(r => rowToCamel<Role>(r));
  },

  async getById(id: string): Promise<Role | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Role>(data) : undefined;
  },

  async updateMaxDiscount(id: string, maxDiscountPercent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(maxDiscountPercent * 100) / 100));
    const { error } = await supabase
      .from(TABLE)
      .update({ max_discount_percent: clamped })
      .eq('id', id);
    if (error) throw error;
  },
};

export function hasPermission(role: Role | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return role.permissions.includes(perm);
}

/**
 * Tope de descuento (en %) que el rol puede aplicar a un ticket.
 * - Si tiene 'discounts.unrestricted' → 100 (sin tope).
 * - Si maxDiscountPercent no está definido → 100 (default seguro).
 * Coordinado con migration 0020 (validación server-side en create_receipt_with_lines).
 */
export function maxDiscountFor(role: Role | null | undefined): number {
  if (!role) return 100;
  if (role.permissions.includes('discounts.unrestricted' as Permission)) return 100;
  return role.maxDiscountPercent ?? 100;
}
