# Setup Supabase — Sistema Octabalina (Fase 0)

Esta carpeta contiene el schema SQL, las policies RLS y las semillas para
inicializar un proyecto Supabase desde cero. Es el primer paso de la Fase 0
del plan ([plan completo](../../../.claude/plans/quiero-que-act-es-como-sorted-wigderson.md)).

## 1. Crear el proyecto Supabase

1. Ir a https://app.supabase.com → **New project**.
2. Elegir región cercana (San Pablo / São Paulo para AR).
3. Anotar la contraseña de la base — la vas a necesitar para el CLI.
4. Cuando termine de provisionar (~2 min), ir a **Project Settings → API** y copiar:
   - `Project URL`
   - `anon` `public` key

## 2. Configurar el cliente

```bash
cd "Sistema Gomeria"
cp .env.example .env
```

Editar `.env` con los valores que copiaste:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Instalar las nuevas dependencias:

```bash
npm install
```

## 3. Aplicar el schema

### Opción A — desde la UI de Supabase (más rápido)

1. Abrir **SQL Editor** en el dashboard.
2. Pegar el contenido de `migrations/0001_init.sql` y ejecutar.
3. Pegar el contenido de `migrations/0002_rls.sql` y ejecutar.
4. Pegar el contenido de `seed.sql` y ejecutar.

### Opción B — con Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-id>
supabase db push --include-all
psql "$DATABASE_URL" -f supabase/seed.sql
```

## 4. Crear el primer usuario admin

En el dashboard, **Authentication → Users → Add user**.
Creá un usuario con tu email + contraseña.

Después en SQL Editor, vinculá ese auth user a un `Employee` con rol Propietario:

```sql
-- Reemplazá los UUIDs con los reales
insert into employees (name, email, role_id, store_ids, pin_hash, auth_user_id)
values (
  'Tu Nombre',
  'tu@email.com',
  (select id from roles where name = 'Propietario'),
  null,  -- null = acceso a todas las tiendas
  encode(digest('1234', 'sha256'), 'hex'),  -- PIN 1234, cambialo después
  (select id from auth.users where email = 'tu@email.com')
);
```

## 5. Verificar el setup

```bash
npm run dev
```

Abrir la app. La UI vieja debería funcionar igual que antes — todavía no
hay cambios visibles, sólo cambió la fuente de datos.

## 6. Migrar datos existentes (opcional)

Si tenés datos en `localStorage` o un backup JSON (como
`balina-backup-2026-04-25.json`), podés migrarlos.

### Desde localStorage en uso

Abrir la consola del navegador en la app:

```js
import('@/migrations/v1_to_supabase').then(async m => {
  // Primero un dry-run para ver qué pasaría
  const dryReport = await m.migrateLocalToSupabase({ dryRun: true });
  console.log(dryReport);
  // Si todo se ve bien, correr la migración real:
  // const report = await m.migrateLocalToSupabase();
  // console.log(report);
});
```

### Desde un backup JSON

```js
import('@/migrations/v1_to_supabase').then(async m => {
  const json = await fetch('/balina-backup-2026-04-25.json').then(r => r.text());
  const report = await m.migrateFromJsonBackup(json, { dryRun: true });
  console.log(report);
});
```

El reporte incluye:
- `tiresMigrated`, `customersMigrated`, `receiptsMigrated`, etc.
- `errors[]` con cualquier fila que falló
- `defaultStoreId` y `systemEmployeeId` creados

Si el dry-run no tiene errores, correr de nuevo sin `dryRun: true`.

## 7. Resetear todo (durante desarrollo)

Si querés tirar abajo todo y volver a empezar:

```sql
-- En SQL Editor
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated;
```

Luego volver a aplicar `0001_init.sql` + `0002_rls.sql` + `seed.sql`.

Y en el navegador:

```js
import('@/migrations/v1_to_supabase').then(m => m.clearMigrationFlag());
```

## Próximos pasos

Una vez que Fase 0 está corriendo:

- **Fase 1** (3 semanas): vistas multi-tienda + caja real
- **Fase 2** (1-2 sem): empleados, roles, login PIN
- **Fase 3** (2-3 sem): descuentos, impuestos, métodos de pago, modificadores
- **Fase 4** (2-3 sem): los 10 informes Loyverse
- **Fase 5** (1-2 sem): lealtad, recibos imprimibles, tickets abiertos
- **Fase 6** (2 sem): reintegrar cuentas corrientes, facturas proveedor, portal cliente
- **Fase 7** (1-2 sem): realtime + offline-first + impresoras

Ver `.claude/plans/quiero-que-act-es-como-sorted-wigderson.md` para el detalle.
