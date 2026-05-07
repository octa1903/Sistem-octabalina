# DESIGN.md — Sistema Octabalina

## Tokens de color (CSS custom properties en `src/index.css`)

### Superficies
| Token | Valor | Uso |
|---|---|---|
| `--br-bg` | `#f7f5f0` | Fondo de página |
| `--br-sur` | `#ffffff` | Superficie de cards, modals, inputs |
| `--br-sur2` | `#f0ede6` | Superficie secundaria, hover states |
| `--br-dark` | `#1a1814` | Sidebar oscuro |

### Bordes
| Token | Valor | Uso |
|---|---|---|
| `--br-bor` | `#e2ddd4` | Bordes en superficies claras |
| `--br-dark-bor` | `#2a2520` | Divisores dentro del sidebar oscuro |

### Tipografía
| Token | Valor | Uso |
|---|---|---|
| `--br-txt` | `#1a1814` | Texto principal |
| `--br-txt2` | `#7a7569` | Texto secundario / muted (superficies claras) |
| `--br-dark-txt2` | `#9a9590` | Texto muted sobre fondo oscuro |

### Color de acción (ámbar)
| Token | Valor | Uso |
|---|---|---|
| `--br-amb` | `#c47b12` | Primario, nav activo, brand |
| `--br-amb-bg` | `#fdf3e0` | Fondo de ámbar suave |
| `--br-amb-bor` | `#f0c060` | Borde de ámbar |
| `--br-dark-amb-bg` | `rgba(196,123,18,0.12)` | Nav item activo en sidebar oscuro |

### Estados semánticos
| Token | Valor | Uso |
|---|---|---|
| `--br-red` | `#c0362a` | Peligro, eliminar, caja cerrada |
| `--br-red-bg` | `#fdecea` | Fondo de alerta roja |
| `--br-red-bor` | `#f0a099` | Borde de alerta roja |
| `--br-grn` | `#2e7d4f` | Éxito, caja abierta, pago |
| `--br-grn-bg` | `#e8f5ee` | Fondo de alerta verde |
| `--br-grn-bor` | `#90d4a8` | Borde de alerta verde |
| `--br-info` | `#2563eb` | Información |
| `--br-info-bg` | `#e6efff` | Fondo de info |
| `--br-info-bor` | `#a8c4f5` | Borde de info |
| `--br-warn` | `#b45309` | Advertencia |
| `--br-warn-bg` | `#fef3c7` | Fondo de warn |
| `--br-warn-bor` | `#fbbf24` | Borde de warn |

### Sombras y radios
| Token | Valor |
|---|---|
| `--br-shadow-sm` | `0 1px 2px rgba(26,24,20,0.05)` |
| `--br-shadow-md` | `0 4px 12px rgba(26,24,20,0.08)` |
| `--br-shadow-lg` | `0 10px 30px rgba(26,24,20,0.12)` |
| `--br-radius-sm` | `0.5rem` |
| `--br-radius-md` | `0.75rem` |
| `--br-radius-lg` | `1rem` |

## Tipografía

- **Font:** DM Sans (Google Fonts, preconnect en `index.html`)
- **Font base:** 19px (`html { font-size: 19px }`) — escalado para uso táctil en taller.
- **Jerarquía:**
  - Headings: `font-semibold` o `font-bold`, escala mínima 1.25× entre pasos
  - Body: `text-sm` (0.789rem → ~15px base) / `text-base` (1rem → 19px)
  - Microtexto: `text-xs` — solo en labels y badges; nunca en acciones críticas

## Escala de spacing (Tailwind)

Valores permitidos: `1, 2, 3, 4, 6, 8, 12` (= 4/8/12/16/24/32/48px a base 16px, proporcional).  
Evitar: `5, 7, 10, 11, 13+` — rompen el ritmo visual.

## Componentes del design system (`src/components/ui/`)

| Componente | Import | Variantes / Props |
|---|---|---|
| `Button` | `@/components/ui` | `variant: primary│secondary│danger│success│ghost`; `size: sm│md│lg`; `loading`; `iconLeft/Right`; `fullWidth` |
| `Input` | `@/components/ui` | Wrapper de `<input>` con estilos de token |
| `Select` | `@/components/ui` | Wrapper de `<select>` |
| `FormField` | `@/components/ui` | Label + Input + error message |
| `Modal` | `@/components/ui` | `open`, `onClose`, `title`, `size: sm│md│lg│xl` |
| `ConfirmDialog` | `@/components/ui` | Modal de confirmación con acción destructiva |
| `IconButton` | `@/components/ui` | Botón solo con ícono (Lucide), accesible |
| `EmptyState` | `@/components/ui` | Estado vacío estandarizado |
| `Badge` | `@/components/ui` | Etiqueta de estado/categoría |
| `Spinner` | `@/components/ui` | Loading spinner |
| `Toast` + `useToast` | `@/components/ui` | Notificaciones temporales |

## Reglas de diseño específicas del producto

1. **Target mínimo táctil:** 48×48px en cualquier acción del POS (checkout, caja, clientes).
2. **Separación de acciones destructivas:** `gap-2` mínimo entre "Cancelar" y "Eliminar"; nunca adyacentes sin separador visual.
3. **Botones de modal:** siempre `Button` primitivo — nunca `<button>` raw con estilos inline.
4. **Sidebar oscuro:** usa tokens `--br-dark-*`, no literales hex. Fondo `--br-dark`, texto activo blanco, texto muted `--br-dark-txt2`.
5. **Badges de estado (caja, pedidos):** usar `--br-grn-bg/bor/grn` y `--br-red-bg/bor/red` — nunca `rgba()` inline.
6. **Cero gradientes decorativos.** Si hay gradiente, tiene que cumplir una función concreta.
7. **No `border-left` como acento** en cards o list items. Usar full border, fondo tintado, o nada.
