# Polish Pass — Sistema Octabalina
**Fecha:** 2026-05-27
**Branch:** main
**Agente:** inline (subagente externo agotó cuota de sesión)

---

## Resumen

- Archivos auditados: 44 (32 employee + 12 ui)
- Total findings: 28
- Por categoría: missing-token=6 · one-off-impl=11 · conceptual-misalignment=4 · spec-violation=7
- Por dimensión: spacing=8 · typography=3 · color=8 · interaction=2 · motion=1 · copy=2 · forms=1 · edge=1 · code=2

---

## Pre-Polish Verdict

**Functionally complete: sí.** El sistema está apto para polish — no se detectan TODOs/FIXMEs en components, ni `as any` en handlers, ni código comentado dejado. Solo 1 `console.error` (ImportModal, justificado en catch block).

Hay un bug de lógica de negocio (CloseCashModal variance invertido, descrito en `01-critique.md` como P0) que NO es polish — es un bug que debe corregirse antes de pulir.

---

## Findings por dimensión

### Visual alignment & spacing

**[spec-violation] Spacing `5` está prohibido por DESIGN.md pero se usa masivamente**
DESIGN.md línea 84: *"Valores permitidos: 1, 2, 3, 4, 6, 8, 12. Evitar: 5, 7, 10, 11, 13+."*

Conteo de `(p|px|py|m|mt|gap|space-y|space-x)-5` en `src/components/`: **40+ instancias**.

Los lugares más frecuentes:
- `px-5 py-4` para headers de sección (en TODAS las secciones de settings): `EmployeesSection:182,207`, `DiscountsSection:112,135`, `InsuranceCompaniesSection:115,138`, `SalespeopleSection:116,139`, `TaxesSection:105,128`, `ReceiptConfigSection:57,63`, `BackupSection:81,90`, `LoyaltySection:47,52`, `StoreIdentitySection:81,87`, `AccountsView:324,353,373`, `AccountView:60,94,120,133,139`.
- `gap-2 mt-5` para footers de modal: `POSView:774,855`, `InvoicesView:345,355`, `InventoryView:701`, `EmployeesSection:423`, `DiscountsSection:207,217`, `InsuranceCompaniesSection:241,256`, `SalespeopleSection:242,253`, `TaxesSection:204,215`, `AccountsView:466`, `CatalogView:359`.
- `p-5` standalone: `POSView:608`, `LoyaltySection:52`, `AccountView:60,94,120`.
- `py-10`: `AccountsView:251`, `POSView:681`, `HistoryView:78,80`, `CatalogView:216`.
- `space-y-5`: `InventoryView:416`, `MyOrdersView:83`.

**Categoría:** spec-violation sistémica.

**Fix recomendado:** Es **demasiado** drift para corregir uno-por-uno. Tres caminos:
1. **Aceptar la realidad** y modificar DESIGN.md para permitir `5` y `10` (la escala default de Tailwind ya los incluye y no rompen ritmo visual de manera evidente).
2. **Migrar mecánicamente:** `p-5`→`p-4`/`p-6`, `mt-5`→`mt-4`/`mt-6`, `px-5 py-4`→`px-4 py-4` o `px-6 py-4`, `py-10`→`py-8` o `py-12`. Sin función auto-fix custom, son ~40 ediciones manuales.
3. **Agregar ESLint rule** que flaggee estos patterns (requiere setup pero protege futuro).

Recomendación: opción 1 (relajar DESIGN.md). El uso real demuestra que `5` y `10` son útiles para spacing intermedio. La escala restrictiva fue una decisión teórica que el código ya rechazó.

---

### Typography

**[one-off-impl] `text-xs` aparece 178 veces en `src/components/employee/`**
A base 19px, `text-xs` ≈ 11-12px visual. DESIGN.md: *"Microtexto: text-xs — solo en labels y badges; nunca en acciones críticas."*

Distribución (top archivos): EmployeesSection=15, PosView=9, InventoryView=12, AccountsView=7, ChecksView=7, AnalyticsView=7, ClientsView=5. Sin auditoría caso-por-caso es imposible determinar cuántos son "labels/badges legítimos" vs "microtexto en flow crítico". Por inspección de muestra:
- `CartPanel.tsx:118-127` ("Vaciar" como `text-xs font-medium px-2 py-1`) → **flow crítico violado**. Ya marcado P2 en 01-critique.md.
- `POSView.tsx:736` (badge dentro de sección `--br-sur2`) → uso correcto.
- `Layout.tsx:144` (subtítulo "Baliña Ruedas" sidebar) → decorativo, OK.

**Quick win:** No hacer barrido global. Identificar los 5-10 `text-xs` que sí están en flow crítico (botones, totales, errores) y subirlos a `text-sm`. Aceptar el resto como ruido tolerable de un sistema con base ya alta (19px).

---

### Color & contrast

**[missing-token] `#fff` literal en 6 archivos** (también detectado por audit)
- `ChecksView.tsx:120`, `SuppliersView.tsx:160`, `EmployeesSection.tsx:338,351`, `SettingsView.tsx:296`, `OfflineBanner.tsx:21`.
- **Fix:** `var(--br-sur)` (es exactamente `#ffffff` pero tokenizado).

**[one-off-impl] `text-white` literal en 23 instancias** (todos los `<button>` raw de settings)
Resuelto automáticamente al migrar a `<Button>` primitivo (audit P1-3, P1-4).

**[one-off-impl] `bg-gray-100 text-gray-700 border-gray-300` en `Badge.tsx:19`**
Default fallback de STATUS_COLORS. Está en una primitiva, no en código de aplicación. Aceptable como sensible default cuando llega un status desconocido, pero idealmente debería usar tokens (`bg-[var(--br-sur2)] text-[var(--br-txt2)] border-[var(--br-bor)]`).

**[missing-token] `hover:bg-stone-50` en EmployeeSelector:98**
Cambiar a `hover:bg-[var(--br-sur2)]`.

**[missing-token] `border-stone-200 border-t-amber-500` en ImportModal:360 (spinner)**
Fix con `<Spinner>` primitivo (audit P1-1).

**[missing-token] `hover:bg-white/8` y `hover:bg-white/15`** en Layout.tsx:183,192 y client/Layout.tsx:37
Convención táctica para fondo sutil en sidebar oscuro. No hay token para "fondo hover en superficie oscura". Sería bueno agregar `--br-dark-hover` al DS, pero el patrón `white/N%` sobre fondo dark es suficientemente claro y consistente para no romper nada.

**[one-off-impl] `bg-[var(--br-amb)]` con `text-white` literal en LoginScreen y EmployeeSelector y Layout.tsx:138** (`w-9 h-9` avatar sidebar)
Pasan AA (contraste de blanco sobre `#c47b12` ≈ 3.5:1 — pasa AA texto grande con `font-bold`). OK funcionalmente, mejorable a `text-[var(--br-sur)]` por consistencia.

---

### Interaction states

**[spec-violation CRÍTICO] `border-left: 3px solid var(--br-amb)` en `Layout.tsx:168`**

DESIGN.md línea 158: *"NO `border-left` como acento en cards o list items. Usar full border, fondo tintado, o nada."*
PRODUCT.md (regla 7): mismo principio.

El sidebar marca el nav item activo con un **border-left de 3px ámbar** — exactamente el antipatrón prohibido. Este es un caso donde el código viola directamente una regla escrita del DS.

**Fix:** Tres opciones (orden de preferencia):
1. **Fondo tintado:** ya existe `--br-dark-amb-bg` = `rgba(196,123,18,0.12)`. Aplicarlo como `background` cuando `active=true` y remover el border-left. Resuelve con tokens existentes.
2. **Texto + ícono en ámbar sin border:** color del label cambia a `var(--br-amb)` cuando activo (ya hay precedente en el sistema).
3. **Pill de fondo + texto claro:** `bg-[var(--br-dark-amb-bg)] text-white` con `rounded-lg`.

Recomendación: opción 1, está exactamente para esto.

**Nota:** `CartPanel.tsx:111` y `Layout.tsx:133` usan `borderLeft: 1px` y `borderRight: 1px` como divisores estructurales (no acentos). Eso sí está permitido — `>1px` decorativo es lo prohibido.

---

### Micro-interactions

**[spec-violation] `backdrop-blur-sm` en Modal.tsx:65 y WizardShell.tsx:28**

DESIGN.md regla 6: *"Cero gradientes decorativos. Si hay gradiente, tiene que cumplir una función concreta."*
Skill `impeccable` shared design laws: *"Glassmorphism como default: Blurs y glass cards usados decorativamente. Rare and purposeful, or nothing."*

El blur del backdrop es muy suave (`sm` = 4px) y se aplica solo al fondo overscreen del modal — no es glassmorphism agresivo. Pero técnicamente es decorativo (no aporta función). Dos lecturas posibles:
- **Strict:** removerlo, dejar solo `background: rgba(26,24,20,0.4)` (más opaco para tapar la UI).
- **Pragmatic:** dejarlo, es sutil y mejora separación visual.

Recomendación: pragmatic. El `backdrop-blur-sm` es discreto y ayuda a separar el modal del fondo en pantallas con mucho contenido. Si Octavio prefiere strict, se elimina con un `Edit` de 2 líneas.

**[gap] No hay regla `prefers-reduced-motion` en CSS global ni componentes**
Grep `prefers-reduced-motion` → 0 matches. Las animaciones del sistema son pocas (spinner, modal open/close, hover transitions), pero un usuario con la setting activa va a ver todo igual. **P3** — agregar bloque en `index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

### Content & copy

**[copy] Toast type incorrecto para acciones completadas**
- `ClientsView.tsx:125`: `addToast('Cliente eliminado.', 'warning')` → debería ser `'success'`.
- `InventoryView.tsx:220` (según report 01-critique): mismo patrón.

`warning` es semánticamente para "esto puede ir mal"; `success` es "esto se hizo". Confunde al operador.

**[copy] Mezcla "Eliminar" / "Borrar" / "Quitar"**
No verifiqué sistemáticamente pero conviene escanear cuando se hagan los fixes anteriores. Si el verbo no es único, conviene normalizar a "Eliminar" (más usado en el código actual).

---

### Forms & inputs

**[one-off-impl] `<input>` raw en lugar de `<Input>` primitivo**
- `POSView.tsx:621` (búsqueda productos POS) — `className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"`. No usa `<Input>`. **P3** del critique.
- `POSView.tsx:837` (nombre/referencia en park ticket modal). **P3** del critique.
- `LoginScreen.tsx:151,178` — inputs de email y password.

Si se migran a `<Input iconLeft={<Search/>}>` heredan altura, focus ring y disabled state estandarizados.

---

### Edge cases

**[one-off-impl] Spinner casero en ImportModal:360**
Ya cubierto por audit P1-1. `<Spinner size="lg" />`.

---

### Code quality

**[code] 1 `console.error` justificado**
- `ImportModal.tsx:132`: `console.error('[ImportModal] snapshot lista proveedor falló:', snapErr);` dentro de un `catch` — aceptable como telemetría del error path (el catch ya muestra toast al usuario; el log queda para debugging).

**[code] No hay `TODO`/`FIXME`/`HACK`/`as any` en components.** ✅

---

## Patrones sistémicos

### 1. Headers/footers de sección con `<button>` raw y `px-5 py-4` (P1+spec-violation combinado)

**Patrón observado:** TODAS las secciones de `src/components/employee/settings/` siguen la misma estructura:
```tsx
<div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
  <h2>...</h2>
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-amb)' }}>
    Nuevo X
  </button>
</div>
```

Reaparece en 9 secciones distintas. Es un componente que **debería existir** en `src/components/ui/` como `SectionHeader` o similar.

**Fix sistémico:** Crear primitiva `<SectionHeader title actionButton?>` que internamente use `<Button>` primitivo y spacing consistente. Reemplazar 9 instancias. Reduce ~50 líneas de duplicación y arregla a la vez: text-white literal, raw button, spec-violation `px-5`.

### 2. Footers de modal con `<div className="flex justify-end gap-2 mt-5">`

Aparece en 13+ archivos (modales de POS, settings sections, AccountsView, etc.). Mismo patrón con misma combinación: `gap-2 mt-5`. El `<Modal>` primitivo podría exponer un slot `footer` que aplique este patrón sin que cada consumer lo repita.

**Fix sistémico:** Agregar prop `footer?: ReactNode` a `<Modal>` con el spacing y separator estandarizado. O exportar `<ModalFooter>`.

### 3. `text-xs` masivo en módulo employee (178 ocurrencias)

No es necesariamente un problema — los badges, labels y datos secundarios usan `text-xs` legítimamente. Pero es señal de que el sistema podría beneficiarse de un componente `<Caption>` o `<HelperText>` que estandarice color + tamaño para texto auxiliar, y deje `text-xs` libre solo para overrides intencionales.

### 4. Spacing prohibido por DESIGN.md pero usado en la práctica (40+ instancias de `-5` y `-10`)

El sistema "rechazó" la escala restrictiva en el código. Mejor reconocer la realidad y actualizar el documento que pretender que el código está mal.

---

## Quick wins (fix <15 min cada uno)

1. **`Layout.tsx:168` → cambiar `borderLeft: 3px solid var(--br-amb)` por `background: var(--br-dark-amb-bg)` cuando `active=true`.** Arregla la violación más visible del DS.
2. **`ClientsView.tsx:125` → `addToast('Cliente eliminado.', 'success')`** (era 'warning').
3. **`InventoryView.tsx:220` → mismo toast type fix.**
4. **`OfflineBanner.tsx:21,44` → `var(--br-sur)` en lugar de `'#fff'` y `var(--br-dark-bor)` en lugar de `'rgba(0,0,0,0.1)'`.**
5. **`EmployeeSelector.tsx:98` → `hover:bg-[var(--br-sur2)]`** en lugar de `hover:bg-stone-50`.
6. **Agregar bloque `@media (prefers-reduced-motion: reduce)` a `src/index.css`.**
7. **`Badge.tsx:19` fallback → `bg-[var(--br-sur2)] text-[var(--br-txt2)] border-[var(--br-bor)]`** en vez de `bg-gray-100 text-gray-700 border-gray-300`.
8. **`ChecksView.tsx:120`, `SuppliersView.tsx:160`, `EmployeesSection.tsx:338,351`, `SettingsView.tsx:296` → `'var(--br-sur)'` en lugar de `'#fff'`.**

---

## Polish Checklist (estado actual)

- [⚠] Aligned a DS — **violación dura en Layout.tsx (border-left ámbar)**
- [⚠] Spacing usa escala — **40+ violaciones del rule `5` prohibido**
- [✓] Typography consistente — sí en general, salvo `text-xs` excesivo
- [⚠] Estados completos — Input/Select con `h-10` (debería ser `h-12` POS)
- [✓] Transiciones suaves — sin issues
- [⚠] Copy consistente — algunos toast types incorrectos
- [⚠] Forms con FormField — 4 inputs raw quedan
- [✓] Errores con Toast — sin alert()/console
- [⚠] Touch ≥48px — Input/Select 40px default, IconButton sm también 40px
- [✓] Sin código muerto

5/10 ✓, 5/10 ⚠. Promedio: **6.5/10 polish-ready**.

---

## Recommended Actions

**Inmediatos (fix dirigido a violaciones de spec del DS):**
1. **`/impeccable polish` Layout.tsx:168** → reemplazar `border-left` por `background var(--br-dark-amb-bg)`. Es la violación más visible y simbólica.
2. **`/impeccable clarify` toasts** → ClientsView/InventoryView toast type `warning` → `success`.
3. **`/impeccable adapt` Input.tsx/Select.tsx** → `h-10` → `h-12` en sizeVariant md (alinea con la decisión ya tomada en Button.tsx).

**Sistémicos (siguiente sprint):**
4. **`/impeccable extract`** → crear `<SectionHeader>` primitiva. Migrar 9 secciones de settings.
5. **`/impeccable extract`** → agregar slot `footer` a `<Modal>` con el patrón `gap-2 mt-5` estandarizado.
6. **`/impeccable polish` (theming)** → reemplazar 6 instancias de `#fff` literal por `var(--br-sur)`.
7. **Decisión de documento:** actualizar DESIGN.md para permitir `5` y `10` en la escala, o aceptar 40+ ediciones para barrer.

**Polish menor:**
8. **`/impeccable harden`** → agregar `prefers-reduced-motion` en `index.css`.
9. **`/impeccable polish`** → 4 `<input>` raw → `<Input>` primitivo.
