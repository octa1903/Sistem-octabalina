# Plan de contingencia — Sistema Octabalina

Qué hacer cuando algo va mal en el POS de la gomería. Ordenado por escenario, del menos grave al más grave.

## Escenarios

### 1. Internet caído por unas horas

**Síntoma**: banner naranja "Sin conexión".

**Acción**:
- Seguí vendiendo con normalidad — las ops se encolan localmente.
- NO hagas cierre Z mientras dure el corte (no funciona offline).
- Cuando vuelva el internet, el banner se pone verde y sincroniza solo.
- Verificá después de la sincronización que el conteo de ventas del día cuadre (Reporte X).

**Si dura > 8 horas**: cerrá la jornada a mano en papel y carga las ventas al día siguiente cuando vuelva la red. El cierre Z lo hacés cuando todo esté sincronizado.

---

### 2. Impresora térmica no imprime

**Síntoma**: apretás "Imprimir" y no sale nada / sale en blanco / sale recortado.

**Acción inmediata** (para no parar la venta):
- Confirmá la venta igual (queda registrada en el sistema).
- Anotá el número de ticket en papel y dáselo al cliente.
- Después arreglás la impresora sin urgencia.

**Diagnóstico**:
1. ¿La impresora está encendida y conectada (luz verde)?
2. ¿Tiene papel cargado?
3. Imprimí una página de prueba desde Windows → Configuración → Impresoras → Propiedades → Imprimir página de prueba.
4. Si la página de prueba sale: el problema es con el formato 80mm. Verificá tamaño de papel en la impresora.
5. Si la página de prueba NO sale: el driver de Windows está roto. Reinstalá el driver.

---

### 3. PC del TPV se rompe (no enciende)

**Síntoma**: la PC física no arranca o pantalla negra.

**Acción**:
1. **Para seguir vendiendo el mismo día**:
   - Si tenés una segunda PC (notebook, otra de oficina), abrí el navegador y andá a la URL del POS.
   - Login con el mismo email/password del dueño.
   - Identificate como operador con tu PIN.
   - Listo. **Todos los datos están en Supabase**, no en la PC.
2. **Si NO tenés segunda PC**:
   - Vendé en papel (talonario), anotá monto, método, cliente.
   - Cuando consigás otra PC (o reparen la actual), cargá las ventas a mano desde el POS.

**Por qué funciona**: el POS es una web app que carga desde el servidor. Los datos viven en Supabase Cloud. La PC es solo una interfaz — cualquier PC con internet puede ser el TPV.

---

### 4. Olvidaste tu PIN y no hay otro admin

**Síntoma**: el EmployeeSelector te bloquea, ningún otro PIN funciona.

**Acción**:
1. Si tenés acceso al dashboard de Supabase:
   - Login en https://supabase.com/dashboard
   - Proyecto Octabalina → Table Editor → tabla `employees`.
   - Editá tu fila → cambiá `pin_hash` por el hash de un PIN nuevo.
   - Para generar el hash: pegá esto en la consola del navegador (cualquier página del POS abierta):
     ```js
     const { hashPin } = await import('/src/utils/hash.ts');
     console.log(await hashPin('1234'));
     ```
     Copiá el resultado (empieza con `pbkdf2$300000$...`).
   - Pegalo en el campo `pin_hash` y guardás.
2. Volvés al POS y entrás con el PIN nuevo.

---

### 5. Datos corruptos / venta fantasma / saldo de cliente mal

**Síntoma**: AccountsView muestra saldo absurdo, falta una venta que sabés hiciste, etc.

**Acción**:
1. **NO sigas operando** con esa cuenta hasta investigar.
2. Revisá el último backup disponible (Configuración → Respaldo).
3. Bajá un backup AHORA mismo (antes de cualquier cambio).
4. Andá al dashboard de Supabase → Table Editor → tabla afectada y revisá las filas a mano.
5. Si la corrupción es puntual (1 fila), corregila a mano (UPDATE en SQL Editor).
6. Si la corrupción es masiva, restaurá desde el último backup bueno (ver [BACKUP.md](BACKUP.md) sección "Restore manual").

---

### 6. Supabase Cloud cae (servicio caído del proveedor)

**Síntoma**: error "Failed to fetch" en todas las operaciones, banner ofline permanente.

**Acción inmediata**:
1. Verificá status en https://status.supabase.com — si está rojo, no es tu problema, esperá.
2. Vendé en modo offline (las ventas se encolan).
3. Cuando Supabase vuelva, verificá que las ops encoladas se sincronizaron sin errores.

**Si dura > 24 hs**:
- Es un escenario raro. Sigan vendiendo offline.
- Si tienen un backup reciente, podrían migrar a otro proveedor (Postgres self-hosted, Neon, otro proyecto Supabase). Trabajo: ~1 día con ayuda técnica.

---

### 7. Pérdida total de la base (proyecto Supabase eliminado por error / hackeado / etc.)

**Síntoma**: el proyecto Supabase no existe más. Sin acceso al dashboard, sin backups del proveedor.

**Acción** (escenario apocalíptico):
1. Crear un proyecto Supabase nuevo desde cero.
2. Aplicar todas las migraciones del repo en orden:
   - Dashboard → SQL Editor.
   - Copiar y pegar cada `supabase/migrations/000X_*.sql` en orden (0001 → 0035).
3. Cargar las seeds básicas:
   - Roles (Propietario, Administrador, Gerente, Cajero) — script `scripts/seedRoles.ts` (pendiente).
   - Payment methods (efectivo, transferencia, débito, crédito, cuenta corriente).
   - Taxes (IVA 21%, IVA 10.5%).
   - Categorías (Auto, Camioneta, etc).
4. Restaurar el último backup JSON disponible (ver [BACKUP.md](BACKUP.md)).
5. Actualizar `.env`:
   - `VITE_SUPABASE_URL` apuntando al nuevo proyecto.
   - `VITE_SUPABASE_ANON_KEY` con la nueva anon key.
6. Re-deployar la app (Vercel u otro).
7. Probar end-to-end: login, abrir caja, vender, cerrar caja.

**Tiempo estimado**: 4–8 horas si tenés el backup a mano y conocés el stack. Sin backup, perdés todas las ventas posteriores al backup más reciente.

**Conclusión**: el backup semanal NO es opcional.

---

## Niveles de severidad (resumen)

| Nivel | Escenario | Tiempo de recuperación | Acción |
|---|---|---|---|
| 🟢 Bajo | Internet caído breve | minutos | Banner naranja, seguir vendiendo offline |
| 🟢 Bajo | Impresora rota | 0 min (no bloquea) | Confirmar venta, arreglar impresora después |
| 🟡 Medio | PC del TPV rota | minutos | Usar otra PC con el mismo login |
| 🟡 Medio | PIN olvidado | minutos | Cambiar pin_hash en Supabase dashboard |
| 🟠 Alto | Corrupción puntual | horas | Investigar, restaurar fila o backup parcial |
| 🟠 Alto | Supabase Cloud caído | horas–días | Esperar, operar offline |
| 🔴 Crítico | Base perdida total | 4–8 horas con backup | Recrear proyecto, restaurar JSON |

---

## Contactos de emergencia

- **Dashboard Supabase**: https://supabase.com/dashboard/project/aaplvlvewjeovitpyscg
- **Status Supabase**: https://status.supabase.com
- **Status Vercel**: https://www.vercel-status.com (si hosteás en Vercel)
- **Soporte Supabase** (plan Pro): support@supabase.io
