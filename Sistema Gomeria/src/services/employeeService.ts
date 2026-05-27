import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Employee, Role } from '@/types';

const TABLE = 'employees';

export interface EmployeeWithRole extends Employee {
  role: Role | null;
}

export const employeeService = {
  async getAll(opts: { activeOnly?: boolean } = {}): Promise<Employee[]> {
    let q = supabase.from(TABLE).select('*').order('name', { ascending: true });
    if (opts.activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    return ensureNoError(data, error, 'employeeService.getAll').map(r => rowToCamel<Employee>(r));
  },

  /** Lista activos cuyo `store_ids` contenga la tienda dada (o sea null = global). */
  async getActiveByStore(storeId: string): Promise<Employee[]> {
    const all = await this.getAll({ activeOnly: true });
    return all.filter(e => e.storeIds === null || e.storeIds.includes(storeId));
  },

  async getById(id: string): Promise<Employee | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Employee>(data) : undefined;
  },

  async getWithRole(id: string): Promise<EmployeeWithRole | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, role:roles(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const { role: roleRow, ...empRow } = data as Record<string, unknown> & { role: Record<string, unknown> | null };
    const emp = rowToCamel<Employee>(empRow);
    return { ...emp, role: roleRow ? rowToCamel<Role>(roleRow) : null };
  },

  async save(emp: Partial<Employee> & { name: string; roleId: string; pinHash: string }): Promise<Employee> {
    const payload = stripUndefined(camelToRow(emp as Record<string, unknown>));
    if (emp.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', emp.id)
        .select()
        .single();
      return rowToCamel<Employee>(ensureNoError(data, error, 'employeeService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Employee>(ensureNoError(data, error, 'employeeService.save(insert)'));
  },

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ active }).eq('id', id);
    if (error) throw error;
  },

  /**
   * Cuenta empleados activos en la tienda dada que tengan al menos uno de
   * los permisos requeridos (típicamente `settings.manage` para el bootstrap).
   *
   * Se hace en cliente porque no hay tabla `employees_with_perms` y unir
   * `roles` requiere un JOIN que igual paginaríamos. La cantidad de
   * empleados por tienda es chica (<50) — el costo es despreciable.
   */
  async countActiveWithPermission(
    storeId: string,
    permission: string,
  ): Promise<number> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('store_ids, role:roles(permissions)')
      .eq('active', true);
    if (error) throw error;
    type Row = { store_ids: string[] | null; role: { permissions: string[] } | null };
    const rows = (data ?? []) as Row[];
    return rows.filter(
      (r) =>
        (r.store_ids === null || r.store_ids.includes(storeId)) &&
        r.role?.permissions.includes(permission),
    ).length;
  },
};

/**
 * True cuando una tienda NO tiene ningún empleado activo con `settings.manage`,
 * lo que dejaría al sistema imposible de operar (nadie puede entrar a Configuración
 * para crear empleados). El wizard de first-run usa este check para forzar
 * la creación de un admin inicial.
 */
export async function needsAdminBootstrap(storeId: string): Promise<boolean> {
  const count = await employeeService.countActiveWithPermission(storeId, 'settings.manage');
  return count === 0;
}
