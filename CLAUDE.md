# Sistema Octabalina — Baliña Ruedas

POS multi-tienda para gomería en Mar del Plata. Migrando de localStorage → Supabase. Objetivo: paridad con Loyverse + diferenciadores propios (cuentas corrientes, facturas AFIP, portal cliente, mayorista).

## Stack
React 19 · TypeScript 5.9 · Vite 7 · Tailwind 4 · Supabase (Postgres + Auth + RLS + Realtime) · Vitest · Dexie (offline-first futuro).

App vive en `Sistema Gomeria/` (subcarpeta — no ejecutes npm en la raíz del repo).

## Comandos
```
cd "Sistema Gomeria"
npm run dev          # Vite en :5173
npm run build        # build prod (vite-plugin-singlefile → index.html único)
npm test             # vitest run (one-shot)
npx tsc --noEmit     # type-check
```

Slash commands del proyecto: `/phase-status`, `/check`, `/regen-types`. Ver `.claude/commands/`.

## Convenciones críticas

### Servicios v1 (legacy) vs v2 (Supabase)
- **v1** (`storageService.ts`): localStorage cifrado AES-GCM. **No usar en código nuevo.** Aún consumido por: `main.tsx`, `AnalyticsView`, `OrdersView`, `MyOrdersView`, `SettingsView` (parcial).
- **v2** (`*ServiceV2.ts`, `cashSessionService`, `receiptService`, etc.): Supabase. Mapean row → tipo legacy v1 vía `toLegacy()` para no romper la UI. **Toda lógica nueva consume v2.**
- Tipos: `src/types/index.ts` (legacy, en uso) + `src/types/database.ts` (Supabase, regenerado a mano — ver `/regen-types`).

### Multi-tienda
1 TPV por tienda (no entidad PosDevice separada). El operador del TPV se identifica con PIN vía `useCurrentEmployee` (expira a 30 min, persiste en localStorage). Empleado ≠ usuario Supabase Auth: el dueño hace login con email/password, el operador hace check-in con PIN.

### RLS
Migraciones en `Sistema Gomeria/supabase/migrations/000X_*.sql`. Toda tabla nueva DEBE tener políticas RLS. Patrón: scope por `store_id` + check de rol (`employees.manage`, `pos.openCash`, etc.).

### Reports
9 RPCs en `0004_reports.sql` consumidos vía `reportService` + `callRpc()`. CSV export RFC4180 con BOM (Excel-friendly, separador `,`).

## Plan por fases
Plan maestro: `~/.claude/plans/quiero-que-act-es-como-sorted-wigderson.md` §6.
Estado vivo: ver memoria persistente `project_octabalina.md` (índice en `MEMORY.md`).

Fases hechas: 0, 1, 1.5, 2, 4. Parciales: 3, 5, 6. Pendiente: 7 (realtime/offline/impresoras), 8.

## Qué evitar
- Crear servicios v1 nuevos o tocar `storageService.ts` salvo para borrar.
- Tablas Supabase sin RLS.
- npm install en raíz del repo (instalar en `Sistema Gomeria/`).
- Duplicar lógica de impuestos/descuentos: vive en `utils/buildLine` y `utils/rollupTaxes` (testeados).
- Reescribir UI cuando un mapper `toLegacy()` resuelve el problema.

## Comunicación
Español. Octavio es dueño/desarrollador, prefiere autonomía y avance continuo: cuando dice "te cedo permisos" o "continuá", no pidas confirmación a cada paso. Pasos numerados breves, jerga técnica mínima.
