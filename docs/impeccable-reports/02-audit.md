# Audit Técnico — Sistema Octabalina
**Fecha:** 2026-05-27
**Branch:** main
**Agente:** a11y-auditor

---

## Audit Health Score

| # | Dimensión | Score 0-4 | Hallazgo clave |
|---|-----------|-----------|----------------|
| 1 | Accessibility (A11y) | 2.5 | Modal propio sin focus trap + `tablist` sin `role="tab"` en hijos + inputs sueltos en settings |
| 2 | Performance | 3 | Spinner inline en ImportModal bypasea primitiva. Sin issues mayores. |
| 3 | Responsive | 3 | CartPanel `w-80` fijo + `minWidth: 700` en tabla Inventario sin `overflow-x-auto` wrapper |
| 4 | Theming | 2.5 | `#fff` / `text-white` hardcoded en ~20 lugares + `border-t-amber-500` / `border-stone-200` en ImportModal + `hover:bg-stone-50` en EmployeeSelector |
| 5 | Anti-Patterns | 2.5 | Raw `<button>` sin `Button` en 8+ secciones settings + spacing prohibido `p-5` en 3 archivos + `ToggleRight/Left` sin `aria-pressed` |
| **Total** | | **13.5 / 20** | **Bueno-Aceptable; deuda en settings y theming** |

**Rating band:** 10-13 acceptable / 14-17 good. Justo en el borde superior.

---

## Anti-Patterns Verdict

No es slop. El POS central (POSView, CartPanel, cash modals) es cuidadoso: usa primitivas correctas, tokens semánticos, ARIA completo. La deuda se concentra en los módulos de configuración (`EmployeesSection`, `DiscountsSection`, `TaxesSection`, `SalespeopleSection`, `InsuranceCompaniesSection`, `ReceiptConfigSection`) y en dos vistas de lectura (`SuppliersView`, `ChecksView`) donde se usaron `<button>` raw con estilos inline. Tells secundarios: `#fff` / `text-white` como literal en contextos donde debería ser `var(--br-bg)` o `var(--br-sur)`, y el spinner casero en `ImportModal` en lugar del `<Spinner>`.

---

## Executive Summary

- **Score:** 13.5/20
- **Conteo:** P0=3 · P1=7 · P2=11 · P3=6
- **Top 3 P0:**
  1. `EmployeeSelector` — overlay bloqueante sin `role="dialog"` ni `aria-modal="true"`.
  2. `AccountsView` / `SuppliersView` / `ChecksView` — `role="tablist"` con hijos sin `role="tab"`.
  3. `SettingsView` toggle pedidos — `<button>` raw sin `aria-pressed`.
- **Próximos pasos:** P0 → P1 A11y → limpiar `text-white` literal en settings → migrar raw buttons a primitivas.

---

## Detailed Findings by Severity

### P0 Blocking

**[P0-1] EmployeeSelector — overlay sin semántica de diálogo**
- **Location:** `Sistema Gomeria/src/components/employee/EmployeeSelector.tsx:63`
- **Category:** a11y
- **Impact:** Overlay aparece al iniciar turno y bloquea toda la UI. Lector de pantalla no anuncia "diálogo modal". `<div class="fixed inset-0 z-50">` sin `role="dialog"`, `aria-modal="true"`, ni `aria-labelledby`. Foco no atrapado: Tab sale al fondo.
- **WCAG:** 4.1.2 (A), 2.4.3 (A)
- **Recommendation:** Envolver card interior con `role="dialog" aria-modal="true" aria-labelledby="employee-selector-title"`. Agregar `id="employee-selector-title"` al `<h2>`. Implementar focus trap igual a `Modal.tsx:39-43` o reusar `<Modal closeOnOverlay={false}>`.

**[P0-2] AccountsView / SuppliersView / ChecksView — `role="tablist"` sin `role="tab"`**
- **Location:** `AccountsView.tsx:220`, `SuppliersView.tsx:153-165`, `ChecksView.tsx:113-125`
- **Category:** a11y
- **Impact:** `AccountsView` declara `role="tablist"` pero hijos tienen `aria-pressed` en vez de `role="tab"` + `aria-selected`. Semánticamente incorrecto. En `SuppliersView` y `ChecksView` los filtros son toggle sin ningún ARIA de estado.
- **WCAG:** 4.1.2 (A)
- **Recommendation:** Dos opciones — (a) cambiar botones a `role="tab"` + `aria-selected` + flechas, o (b) **más simple:** eliminar `role="tablist"` y usar `aria-pressed` (correcto para filtros toggle).

**[P0-3] SettingsView — toggle pedidos sin `aria-pressed`**
- **Location:** `SettingsView.tsx:274-282`
- **Category:** a11y
- **Impact:** Botón que activa/desactiva pedidos online cambia solo el ícono (ToggleRight/Left). Sin `aria-pressed` ni texto, lector lee solo SVG (sin alt) o nada. Operador con AT no puede activar pedidos.
- **WCAG:** 4.1.2 (A), 1.3.1 (A)
- **Recommendation:** Agregar `aria-pressed={orderConfig.enabled}` + `aria-label={`Pedidos online: ${orderConfig.enabled ? 'habilitados' : 'deshabilitados'}`}`.

### P1 Major

**[P1-1] ImportModal — spinner inline bypasea Spinner primitivo**
- **Location:** `import/ImportModal.tsx:360`
- **Category:** a11y + antipattern
- **Impact:** `<div class="animate-spin ... border-stone-200 border-t-amber-500">` sin `role="status"` ni `aria-label`. Lector no anuncia importación en curso.
- **WCAG:** 4.1.3 (AA)
- **Recommendation:** Reemplazar por `<Spinner size="lg" />`.

**[P1-2] ImportModal — inputs proveedor con `<label>` implícito sin `htmlFor`**
- **Location:** `import/ImportModal.tsx:191-221`
- **Impact:** Patrón implícito funciona pero `<span class="text-xs">` no es el label semántico para NVDA en modo formulario y VoiceOver iOS.
- **Recommendation:** Migrar a `<FormField label="..."><Input/></FormField>` o agregar `id` + `htmlFor`.

**[P1-3] EmployeesSection — raw `<button>` en footer modal**
- **Location:** `settings/EmployeesSection.tsx:424-439` (footer) y `187-191` (header)
- **Impact:** Cancelar/Guardar sin estados disabled/loading/focus ring estandarizados. Touch target sin garantía de 48px.
- **Recommendation:** `<Button variant="secondary">` y `<Button variant="primary" loading={submitting}>`.

**[P1-4] Secciones settings — raw `<button>` en headers**
- **Locations:** `TaxesSection.tsx:112`, `DiscountsSection.tsx:119`, `InsuranceCompaniesSection.tsx:122`, `SalespeopleSection.tsx:123`, `ReceiptConfigSection.tsx:110-118`
- **Impact:** `text-white`, `background: var(--br-amb)`, padding manual `py-1.5` = ~34px (debajo de 48px). Sin disabled/loading estandarizado.
- **Recommendation:** `<Button variant="primary" size="sm">` en headers, `size="md"` en guardado.

**[P1-5] SuppliersView / ChecksView — filtros sin estado ARIA**
- **Location:** `SuppliersView.tsx:153-165`, `ChecksView.tsx:113-125`
- **Impact:** Filtros toggle sin `aria-pressed`. Estado activo solo visual.
- **Recommendation:** `aria-pressed={filter === f}`.

**[P1-6] InventoryView — tabla sin `aria-label` ni `scope="col"`**
- **Location:** `InventoryView.tsx:331-412`
- **Impact:** `minWidth: 700` con `overflow-x-auto` está bien, pero falta semántica de tabla.
- **WCAG:** 1.3.1 (A)
- **Recommendation:** `aria-label="Inventario de neumáticos"` + `scope="col"` en `<th>`.

**[P1-7] AnalyticsView — tabs de report sin ARIA tab navigation**
- **Location:** `AnalyticsView.tsx` (~L248-L270)
- **Recommendation:** `<div role="tablist" aria-label="Secciones del informe">` + `role="tab" aria-selected`.

### P2 Minor

**[P2-1]** `SuppliersView:160`, `ChecksView:120`, `EmployeesSection:338,351`, `SettingsView:296` — `color: '#fff'` literal. Cambiar a `var(--br-sur)`.

**[P2-2]** `text-white` literal en: `TaxesSection:112`, `DiscountsSection:119`, `InsuranceCompaniesSection:122`, `SalespeopleSection:123`, `EmployeesSection:189,435`, `ImportModal:349,395`. Se resuelve con migración a `<Button>`.

**[P2-3]** `ImportModal:360` — `border-stone-200 border-t-amber-500` hardcoded. Fix con Spinner primitivo.

**[P2-4]** `EmployeeSelector:98` — `hover:bg-stone-50` → `hover:bg-[var(--br-sur2)]`.

**[P2-5]** `OfflineBanner.tsx:21,44` — `'#fff'` y `'rgba(0,0,0,0.1)'`. Usar `var(--br-sur)` y `var(--br-dark-bor)`.

**[P2-6]** `POSView.tsx:608` — `p-5` fuera de escala. Cambiar a `p-4` o `p-6`.

**[P2-7]** `LoyaltySection.tsx:52` — `p-5` fuera de escala.

**[P2-8]** `TopBar.tsx:54-65` — `<select>` de tienda sin `aria-label="Tienda activa"`.

**[P2-9]** `InventoryView.tsx:287-295` — Input búsqueda sin `aria-label`.

**[P2-10]** `ClientsView.tsx:152-157` — Input búsqueda sin `aria-label`.

**[P2-11]** `AccountsView.tsx:231-236` — Input búsqueda sin `aria-label`.

### P3 Polish

**[P3-1]** `Modal.tsx:90` — `aria-labelledby="modal-title"` ID estático. Usar `useId()`.

**[P3-2]** `ChecksView` / `SuppliersView` — filas sin `<ul>/<li>` semántica.

**[P3-3]** `Layout.tsx:181-195` — botones sidebar colapsado sin `aria-label`.

**[P3-4]** `AnalyticsView` tabs — `aria-label` en contenedor.

**[P3-5]** `Badge.tsx:16` — `role="status"` causa live-region spam en tablas. Cambiar a `role="img"` o sin role.

**[P3-6]** `FormField.tsx:29` — labels en `text-xs` (10.7px). Pasa AA pero subir a `text-sm` en POS críticos.

---

## Patterns & Systemic Issues

1. **Fragmentación primitivas vs raw buttons en settings.** Los módulos de configuración aplican un patrón consistente pero incorrecto: headers con `<button>` raw styled manualmente. POS central usa `<Button>` correctamente. Sugiere que estos módulos se escribieron antes de que las primitivas estuvieran maduras. **Fix sistémico:** ESLint rule o CI grep que flaggee `className.*text-white.*background.*var(--br`.

2. **Filtros de estado sin ARIA.** `SuppliersView`, `ChecksView`, `InventoryView` ("Solo alertas") usan toggle visual sin semántica. `AccountsView` con `role="tablist"` mal contratado. Patrón correcto: `aria-pressed` para toggle; `role="tab" + aria-selected` para navegación tab.

3. **Microtexto `text-[10px]` / `text-[11px]`** en datos secundarios — 12+ lugares. No hay texto crítico en este tamaño, pero es sistemático.

4. **Spacing fuera de escala** — `p-5` aparece en 3 archivos. Escala explícitamente prohíbe `5`.

---

## Positive Findings

1. **Primitivas UI de alta calidad.** `Modal`, `Button`, `Input`, `FormField`, `IconButton`, `Toast`, `ConfirmDialog`, `Spinner` cubren contratos ARIA críticos correctamente.

2. **POS central (POSView + CartPanel) tiene ARIA ejemplar.** Botones de producto con `aria-label` completo, skeletons con `aria-busy`, qty buttons con `aria-live="polite"`, focus ring consistente.

3. **Tokens semánticos en `index.css` coherentes y completos.** Focus visible global `outline: 2px solid var(--br-amb)`, suprimido solo en mouse via `:focus:not(:focus-visible)`.

4. **Contraste correcto.** `--br-txt` sobre `--br-sur` = ~17:1. `--br-red` = ~5.8:1 (AA). `--br-amb` = 3.2:1 (AA texto grande).

---

## Recommended Actions

**Inmediato (P0):**
1. `EmployeeSelector` → reusar `<Modal closeOnOverlay={false}>` o agregar role+focus trap manualmente.
2. `AccountsView` → eliminar `role="tablist"` y usar `aria-pressed` (más simple).
3. `SuppliersView` / `ChecksView` → `aria-pressed={filter === f}`.
4. `SettingsView` toggle pedidos → `aria-pressed` + `aria-label`.

**Siguiente sprint (P1):**
5. `ImportModal` → reemplazar spinner inline + migrar inputs a `<FormField>`.
6. Settings sections → migrar `<button>` raw a `<Button>`.
7. `TopBar` → `aria-label="Tienda activa"`.
8. Inputs de búsqueda → `aria-label`.
9. `AnalyticsView` tabs → ARIA tablist.
10. `InventoryView` tabla → `aria-label` + `scope="col"`.

**Limpieza theming (P2):**
11. `#fff` literal → `var(--br-sur)`.
12. `OfflineBanner` → tokens.
13. `EmployeeSelector` → `hover:bg-[var(--br-sur2)]`.
14. `p-5` → `p-4`/`p-6`.

**Sidebar colapsado (P3):**
15. `Layout.tsx:181-195` → `aria-label`.
16. `Badge` → `role="img"`.
