import { useState, useEffect, useCallback } from 'react';
import type { Role } from '@/types';
import { roleService } from '@/services/roleService';
import { Button } from '@/components/ui';
import { Percent, Save, Shield } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * Sección de roles: lista todos los roles del sistema y permite editar el
 * tope de descuento (max_discount_percent) sin tocar permisos.
 *
 * Coordinado con migration 0020: el server valida server-side en
 * create_receipt_with_lines que el descuento aplicado no exceda este tope
 * (salvo que el rol tenga el permiso `discounts.unrestricted`).
 */
export function RolesSection({ addToast }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Map<string, number>>(new Map());
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roleService.getAll();
      setRoles(data);
      setDirty(new Map());
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando roles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void refresh(); }, [refresh]);

  function handleChange(roleId: string, raw: string) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const clamped = Math.max(0, Math.min(100, v));
    setDirty(prev => {
      const next = new Map(prev);
      next.set(roleId, clamped);
      return next;
    });
  }

  async function saveRow(role: Role) {
    const value = dirty.get(role.id);
    if (value === undefined) return;
    setSavingId(role.id);
    try {
      await roleService.updateMaxDiscount(role.id, value);
      addToast(`Tope de "${role.name}" actualizado a ${value}%.`, 'success');
      await refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando el rol.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando roles…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--br-txt2)' }}>
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Tope de descuento (%) que el rol puede aplicar a un ticket. 100 = sin tope.
          El permiso <code>discounts.unrestricted</code> ignora este valor. El servidor
          valida la regla al confirmar la venta (migration 0020).
        </p>
      </div>

      <div className="rounded-lg border" style={{ borderColor: 'var(--br-bor)', background: 'var(--br-srf)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <th className="text-left px-3 py-2 font-semibold">Rol</th>
              <th className="text-left px-3 py-2 font-semibold">Sistema</th>
              <th className="text-left px-3 py-2 font-semibold">Descuento sin tope</th>
              <th className="text-left px-3 py-2 font-semibold">Tope (%)</th>
              <th className="text-right px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map(role => {
              const unrestricted = role.permissions.includes('discounts.unrestricted');
              const editing = dirty.get(role.id);
              const value = editing ?? role.maxDiscountPercent;
              const isDirty = editing !== undefined && editing !== role.maxDiscountPercent;
              return (
                <tr key={role.id} style={{ borderBottom: '1px solid var(--br-bor)' }}>
                  <td className="px-3 py-2 font-medium">{role.name}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--br-txt2)' }}>
                    {role.isSystem ? 'sí' : 'no'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {unrestricted ? (
                      <span style={{ color: 'var(--br-txt2)' }}>sí (ignora tope)</span>
                    ) : 'no'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={value}
                        disabled={unrestricted || savingId === role.id}
                        onChange={e => handleChange(role.id, e.target.value)}
                        className="w-20 rounded border px-2 py-1 text-right font-mono"
                        style={{ borderColor: 'var(--br-bor)', background: 'var(--br-bg)' }}
                      />
                      <Percent className="w-3.5 h-3.5" style={{ color: 'var(--br-txt2)' }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isDirty && !unrestricted && (
                      <Button
                        variant="primary"
                        onClick={() => saveRow(role)}
                        disabled={savingId === role.id}
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        {savingId === role.id ? 'Guardando…' : 'Guardar'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
