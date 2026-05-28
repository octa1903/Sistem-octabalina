# Critique UX — Sistema Octabalina
**Fecha:** 2026-05-27
**Branch:** main
**Agente:** pos-ux-reviewer

---

## Anti-Patterns Verdict

**No es slop.** El sistema no tiene ni un gradiente decorativo, ni glassmorphism, ni hero metric card, ni sidebar azul. El design system propio (`--br-*` tokens, DM Sans 19px, paleta tierra) es coherente y está aplicado con consistencia. Los tokens se usan en casi todos los componentes en lugar de hex inline. La base de 19px para goma táctil es una decisión deliberada y correcta.

Tells positivos: token coverage ~95%, jerarquía de superficies `bg → sur → sur2` respetada, colores semánticos coherentes (rojo = peligro, verde = éxito, ámbar = marca/neutro). No se detecta estructura copy-paste de shadcn ni template Tailwind.

Un único antipatrón borderline: `CloseCashModal.tsx` línea 101 invierte la lógica del mensaje de descuadre. Es bug de lógica de negocio, no de estética.

---

## Design Health Score (Nielsen)

| # | Heurística | Score 0-4 | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | 3 | Skeleton en POS/Inventory, banner offline, badge caja abierta/cerrada. Falta: AnalyticsView solo muestra "Cargando…" texto sin skeleton mientras carga 9 RPCs en paralelo (línea 331). |
| 2 | Coincidencia sistema-mundo real | 4 | Vocabulario gomería: "medida", "stock bajo", "caja abierta/cerrada", "cuenta corriente". Español rioplatense. Sin jerga técnica en errores. |
| 3 | Control y libertad del usuario | 3 | Parked tickets bien implementados. Falta undo real en eliminaciones: borrar cliente o neumático dispara ConfirmDialog pero no hay opción de recuperación post-borrado (softDelete existe en el service pero no está expuesto en ClientsView). |
| 4 | Consistencia y estándares | 3 | InventoryView usa `<IconButton size="sm">` (h-10, 40px) mientras que CartPanel usa botones raw `w-12 h-12` (48px). El tamaño táctil correcto se aplica solo en algunos lugares. |
| 5 | Prevención de errores | 4 | Doble-tap guard con `confirmingRef` en POS (línea 107), validación de crédito antes del submit, guard `isAccountPaymentMethod + !customerId`. Muy sólido. |
| 6 | Reconocimiento mejor que recuerdo | 3 | Los badges de stock en POS son buenos. En InventoryView la columna "Stock" muestra número sin unidad visual dominante — verde/ámbar/rojo solo por color (dependencia de hue). |
| 7 | Flexibilidad y eficiencia | 2 | No hay atajos de teclado declarados (F2, F4, etc.) fuera del Enter/Esc en modales. El flujo express en POS (líneas 344-356) es un buen atajo pero no es descubrible. |
| 8 | Diseño estético y minimalista | 3 | SettingsView es la vista más densa: 13+ secciones en scroll vertical sin agrupación por categoría o pestañas. |
| 9 | Ayuda a reconocer, diagnosticar y recuperar errores | 4 | Mensajes en español, accionables, sin stack traces. Los tres códigos de constraint SQL se mapean a strings legibles en POSView.tsx líneas 455-464. |
| 10 | Ayuda y documentación | 2 | No hay tooltips contextuales en acciones no obvias (qué es "Tickets abiertos", qué hace "Ajuste masivo"). |

**Total: 31/40** (banda: Bueno — apuntar al 35+ para flagship)

---

## Overall Impression

El núcleo del POS (cobrar, carrito, parked tickets) está bien ejecutado: flujo directo, sin modales innecesarios en el camino crítico, guard anti-doble-tap, mensajes accionables. El sistema respeta la persona operador en las pantallas que más importa que respete.

Los problemas reales están en backoffice: SettingsView es un scroll monolítico de 13 secciones sin jerarquía navegable, AnalyticsView no tiene feedback de carga proporcional al tiempo que tarda, y la inconsistencia de targets táctiles entre vistas backoffice vs POS crea una brecha que se siente cuando el operador accidentalmente toca Inventario.

---

## What's Working

1. **Flujo express de cobro** (`POSView.tsx` líneas 344-356): ventas en efectivo de hasta 3 ítems saltean el modal de confirmación. Es exactamente la heurística de "≤2 taps para el flujo principal". La implementación con `selectedPm?.type === 'cash'` es correcta y el comentario explica el racional.

2. **Token coverage del design system**: los 45 tokens `--br-*` se aplican consistentemente via `style={{ ... }}` y clases `var(--br-*)`. No hay hex inline en componentes críticos del POS ni CartPanel. El sistema puede cambiar de paleta sin tocar 30 archivos.

3. **ConfirmDialog y prevención de errores en flujo monetario**: la combinación de `confirmingRef.current` (sync guard), validación client-side de crédito antes del submit, y mapping de errores de constraint SQL a mensajes legibles elimina prácticamente los casos de venta duplicada o error huérfano.

---

## Priority Issues (P0-P3)

### P0 — El CloseCashModal invierte el significado de variance

**What:** `CloseCashModal.tsx` línea 101-105. `variance > 0` se etiqueta como "Hay menos efectivo del esperado (faltante)" pero `variance` en `useCashSession` se calcula como `countedCash - expectedCash`. Por lo tanto `variance > 0` significa que hay MÁS efectivo del esperado (sobrante), no faltante. El mensaje está al revés.

**Why:** Si el cierre de caja muestra "faltante" cuando en realidad hay sobrante, el dueño va a buscar plata que no falta — o peor, no va a investigar una diferencia que sí existe.

**Fix:** En `CloseCashModal.tsx` línea 102-103, invertir las condiciones:
```
variance > 0 → "Hay más efectivo del esperado (sobrante)."
variance < 0 → "Hay menos efectivo del esperado (faltante)."
```

**Suggested command:** /impeccable harden

---

### P1 — AnalyticsView no tiene feedback de carga proporcional al tiempo de espera

**What:** `AnalyticsView.tsx` línea 331. Mientras se ejecutan 9 RPCs en paralelo (1-3s), el único feedback es un texto pequeño `"Cargando…"` en `--br-txt2`. No hay skeleton, no hay spinner prominente.

**Why:** Octavio puede dudar si está cargando, se trabó, o falló el filtro. La heurística 1 se viola en la vista que más lo necesita porque las consultas son las más lentas.

**Fix:** Envolver el área de contenido con un estado de loading que reemplace las tablas con un skeleton de filas (como InventoryView líneas 341-349). Alternativamente, un `<Spinner />` centrado con label "Cargando informes…".

**Suggested command:** /impeccable layout

---

### P1 — SettingsView es un scroll de 13 secciones sin jerarquía navegable

**What:** `SettingsView.tsx` líneas 161-420. 13 secciones en un único scroll vertical con el mismo nivel visual (Impuestos, Descuentos, Fidelización, Identidad fiscal, Recibos, Empleados, Roles, Vendedores, Aseguradoras, Seguridad, Backup Supabase, Backup legacy, Mayorista, Pedidos).

**Why:** Para Octavio, encontrar "Descuentos" requiere scroll mental y visual. A 13 secciones se supera el límite de carga cognitiva.

**Fix:** Agrupar en 3-4 pestañas internas: "Ventas" (Impuestos, Descuentos, Fidelización, Mayorista), "Tienda" (Identidad, Recibos, Pedidos), "Personas" (Empleados, Roles, Vendedores, Aseguradoras), "Sistema" (Seguridad, Backup). Solo un selector encima del scroll.

**Suggested command:** /impeccable shape + /impeccable layout

---

### P2 — Input.tsx default `h-10` (40px) para todos los inputs del sistema

**What:** `Input.tsx` línea 14. El default `sizeVariant = 'md'` mapea a `h-10` (40px). El Button.tsx ya fue corregido a 48px: "NO bajar". El Input no.

**Why:** Los inputs en formularios táctiles de POS (OpenCashModal, CloseCashModal, ClientsView, InventoryView) tienen 40px. Con guantes esto es el mínimo absoluto.

**Fix:** En `Input.tsx` línea 14, `md: 'h-10 text-sm'` → `md: 'h-12 text-sm'`. El `lg` queda en `h-12 → h-14`. Revisar `sm` solo para tablas backoffice donde hay densidad justificada.

**Suggested command:** /impeccable adapt

---

### P2 — Select primitivo tiene `h-10` también, en flujo POS crítico

**What:** `Select.tsx` línea 12. `sizeVariant='md'` mapea a `h-10`. El `<Select>` de cliente, método de pago y descuento en CartPanel (líneas 193-247) son los controles más tocados en el flujo de venta.

**Why:** Misma fricción táctil que el Input. El Select de "Método de pago" en CartPanel es el segundo control más importante después del botón Cobrar, y tiene 40px de alto.

**Fix:** En `Select.tsx` línea 12, `md: 'h-10 text-sm ...'` → `h-12 text-sm ...`. Coherente con la corrección de Input.

**Suggested command:** /impeccable adapt

---

### P3 — El modal "Guardar ticket abierto" usa `<input>` raw en vez del primitivo Input

**What:** `POSView.tsx` línea 837. El campo "Nombre / Referencia" del modal de park usa `<input>` raw en lugar de `<Input>`.

**Why:** Si Input.tsx cambia de altura, este campo no hereda el cambio automáticamente. Rompe la consistencia del sistema.

**Fix:** Reemplazar por `<Input ...>` importado de `@/components/ui`.

**Suggested command:** /impeccable polish

---

## Persona Red Flags

### Operador con manos engrasadas

- **Targets 40px en campos críticos**: `Input.tsx:14` y `Select.tsx:12` — campo de monto en OpenCashModal y select de método de pago en CartPanel son los peores.
- **IconButton `size="sm"` (h-10) en filas de InventoryView**: `InventoryView.tsx:384,392`. Botones de editar/eliminar en tabla tienen 40px.
- **"Vaciar carrito" en CartPanel es un `<button>` raw de texto pequeño** (`CartPanel.tsx:118-127`): `text-xs font-medium px-2 py-1` — target de ~28-30px de alto. Junto al contador de ítems.
- **El EmployeeSelector no tiene un botón de tamaño `lg`** (`EmployeeSelector.tsx:161-170`): "Confirmar" usa `py-2.5` (~40px). Primera acción del operador.
- **Los parkedTickets botones "Reanudar" / "Eliminar" son `size="sm"`** (`POSView.tsx:897-912`): 40px en una lista táctil.

### Octavio (backoffice)

- **SettingsView sin jerarquía navegable**: descrito en P1.
- **AnalyticsView `<Select>` de empleado se deshabilita silenciosamente** para tabs "employees" y "cash" (`AnalyticsView.tsx:297`) sin explicación.
- **CloseCashModal variance invertido** (P0): Octavio es quien cierra la caja.
- **Backup legacy en SettingsView** (`SettingsView.tsx:222-236`): prominente al mismo nivel que BackupSection (Supabase). Para usuario nuevo parece igual de importante. Debería estar colapsado.
- **ClientsView: borrar cliente activa `addToast('Cliente eliminado.', 'warning')`** (línea 125) — `warning` para acción exitosa es incorrecto. Debería ser `success`. Mismo patrón en InventoryView línea 220.

---

## Cognitive Load

| Decisiones simultáneas | Dónde |
|---|---|
| 0-1 (correcto) | OpenCashModal, CloseCashModal, ConfirmDialog, EmployeeSelector (pantalla de PIN) |
| 2-3 (aceptable) | CartPanel footer (cliente + método + descuento + puntos — 4 controles secuenciales) |
| 4+ (fricción) | SettingsView (13 secciones sin pestañas), InventoryView modal de nuevo neumático (8 campos), AnalyticsView filtros (7 presets + 2 fechas + 2 selects + 9 tabs = 20 controles simultáneos) |

---

## Minor Observations

- `POSView.tsx:609`: `<h1 className="text-xl font-semibold mb-4">` — heading "Punto de Venta" consume ~100px verticales antes del primer producto.
- `Layout.tsx:164`: sidebar colapsado (w-16) sin tooltip en hover en touch.
- `Toast.tsx:46`: aparece en `fixed bottom-6 right-6` — puede quedar detrás del teclado virtual.
- `CloseCashModal.tsx:95`: ámbar para sobrante puede confundirse con color de marca primario.
- `ChecksView.tsx` y `SuppliersView.tsx` son read-only sin EmptyState con instrucción de dónde dar de alta.
- `AccountsView.tsx:54-57`: cuando `filter === 'all'` sin término de búsqueda, lista vacía silenciosa sin instrucción.
- `POSView.tsx:650`: grilla `grid-cols-2 xl:grid-cols-3`. En 1080p típica el operador ve solo 2 columnas. Considerar `lg:grid-cols-3`.

---

## Questions to Consider

1. **El flujo express omite el modal de confirmación**, pero después igual abre el modal de éxito (`successOpen=true`). Hay dos feedbacks: toast + modal. ¿Es necesario el modal de éxito en express?
2. **`ClientsView.tsx:19`: `EMPTY_FORM` tiene `pin: '1234'` hardcodeado**. ¿Riesgo de operadores creando clientes con PIN default?
3. **SettingsView muestra SalespeopleSection e InsuranceCompaniesSection sin gate de permiso explícito en SettingsView**. ¿Intencional?
4. **30 min de expiración del operador**: ¿qué pasa con el carrito si caduca en medio de venta?
