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
};

/**
 * `permissions` está en la DB como text[] sin restricción de valores.
 * Esta función no narrowea el tipo runtime — confía en el seed y RLS para
 * mantener consistencia. La firma usa `Permission` para que la UI tenga
 * autocomplete.
 */
export function hasPermission(role: Role | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return role.permissions.includes(perm);
}
