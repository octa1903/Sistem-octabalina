# Operación diaria — Sistema Octabalina

Manual paso a paso para operar el POS en una jornada típica de gomería. Pensado para que alguien que no programó nunca pueda usar el sistema sin tu ayuda.

## Inicio de jornada

1. **Abrir la app**.
   - Si es la primera vez en este equipo, ver [Primera ejecución](#primera-ejecución) abajo.
2. **Identificarte como operador**.
   - El sistema muestra el selector "¿Quién va a operar el TPV?".
   - Tocá tu nombre, ingresá tu PIN (4–8 dígitos), confirmá.
   - Si te equivocás, te pide PIN otra vez sin bloquear.
3. **Abrir la caja del día**.
   - Botón verde "Abrir caja" arriba.
   - Ingresá el monto inicial en efectivo (lo que tenés en la gaveta al empezar).
   - Confirmá. El sistema registra la apertura y queda lista para vender.

## Vender un neumático (flujo típico)

1. **Buscar el producto**.
   - Buscador arriba del listado: tipeá la medida (`205/55 R16`), marca (`FATE`), modelo (`FASTWAY`), o SKU.
   - Filtro por categoría a la izquierda (Auto / Camioneta / Camión / Agrícola / Industrial / SUV).
2. **Sumar al carrito**.
   - Click en el neumático → suma 1 unidad.
   - Modificá cantidad con `+`/`-` o tipeando.
3. **Aplicar descuento** (si corresponde).
   - Botón "Descuento" en el carrito.
   - Si tu rol no permite el descuento que querés aplicar, el sistema te lo dice.
4. **Seleccionar cliente** (opcional, requerido si paga en cuenta corriente).
   - Botón "Cliente" → buscar por nombre/DNI/teléfono.
   - Si es nuevo, "Crear cliente" desde el mismo modal.
5. **Cobrar**.
   - Botón verde grande "Cobrar".
   - Elegí método de pago (efectivo, transferencia, débito, crédito, cuenta corriente).
   - Si es mixto, sumá varios métodos hasta cubrir el total.
6. **Imprimir ticket**.
   - El sistema abre una ventana con el ticket en formato 80mm.
   - Apretás "Imprimir" o el atajo del navegador.
   - Si la impresora está configurada como default en Windows, sale directo.

### Modo offline (sin internet)

Si el banner naranja dice "Sin conexión":

- Podés seguir vendiendo: las ventas se guardan en la PC local.
- Cuando vuelve internet, el sistema las sincroniza solo (banner verde "Sincronizando...").
- **NO** podés:
  - Imprimir reporte X / Z (necesitan datos del server).
  - Hacer backup completo.
  - Cargar nuevos productos.
- **SÍ** podés:
  - Vender (efectivo, transferencia, cuenta corriente).
  - Buscar productos en el catálogo cacheado.
  - Cobrar cuenta corriente (se encola y aplica al volver).

## Manejo de cuenta corriente

### Cobrar a un cliente

1. Tab **Cuentas** → buscar cliente.
2. Verás su saldo: rojo = nos debe, verde = tiene a favor.
3. Botón "Registrar pago" → ingresá monto y método.
4. Quedó registrado y descontado del saldo.

### Cargar un cargo manual (sin venta)

1. Tab **Cuentas** → cliente.
2. Botón "Registrar cargo" → monto + concepto.
3. Suma al saldo del cliente.

## Cierre de caja

1. Antes del cierre, opcionalmente imprimí el **Reporte X** desde el TopBar (preview de la jornada sin cerrar).
2. Contá el efectivo físico de la gaveta.
3. Botón rojo "Cerrar caja" arriba.
4. Ingresá el monto contado.
5. El sistema calcula:
   - **Esperado**: lo que debería haber según ventas + apertura.
   - **Contado**: lo que pusiste.
   - **Descuadre**: la diferencia. Verde = 0, naranja = faltante, rojo = sobrante.
6. Confirmá. Aparece la pantalla "Caja cerrada".
7. **Apretá "Imprimir Z"** → ticket con el cierre completo. Guardalo en una carpeta física.

## Backup semanal

Cada lunes (o cuando aparezca el banner naranja en Configuración):

1. Configuración → **Respaldo completo (Supabase)**.
2. Apretá "Descargar backup completo".
3. Esperá la barra de progreso (puede tardar 30–60 seg con muchos datos).
4. El archivo `octabalina-backup-2026-XX-XX.json` se descarga.
5. Copialo a:
   - Pendrive físico que rotás (lunes A, miércoles B, viernes C).
   - O carpeta sincronizada de Google Drive / OneDrive.

Ver [BACKUP.md](BACKUP.md) para más detalles sobre rotación y restore.

## Primera ejecución (instalación nueva)

Si abrís el sistema por primera vez en una PC nueva o después de un reset:

1. **Login web**: ingresá email + contraseña del dueño (cuenta Supabase Auth).
2. **First-run wizard**:
   - **Paso 1**: datos fiscales (razón social, CUIT obligatorios; resto opcional).
   - **Paso 2**: si no hay ningún empleado admin, el sistema te pide crear uno con PIN.
3. Listo: ya podés abrir caja y operar.

## Atajos útiles

| Acción | Atajo |
|---|---|
| Cerrar modal | `Esc` |
| Confirmar diálogo | `Enter` |
| Buscar producto | foco en barra superior |

## Problemas frecuentes

### "No hay empleados activos en esta tienda"

El sistema bloquea con el wizard de bootstrap admin. Creá un admin con PIN y volvés a poder operar.

### El ticket sale en blanco / no imprime

1. Verificá que la impresora esté encendida y conectada.
2. En Windows → Configuración → Impresoras: la térmica debe estar como **default**.
3. En el navegador, al abrir la ventana del ticket, el diálogo "Imprimir" debe mostrar la impresora correcta.

### El sistema dice "Sin conexión" pero sí tengo wifi

1. Probá abrir cualquier web (Google) — confirmá que el wifi anda.
2. Si la web funciona pero el POS sigue offline: el servidor de Supabase puede estar caído (raro). Esperá 5 min y refrescá.
3. Mientras tanto, podés vender en modo offline (las ventas se sincronizan al volver).

### Olvidé mi PIN

1. Otro operador con permisos de admin debe entrar a Configuración → Empleados → Editar tu fila → cambiar PIN.
2. Si no hay otro admin, tenés que entrar a Supabase dashboard y actualizar el `pin_hash` a mano (con script `scripts/setEmployeePin.ts` — pendiente de crear si es necesario).

## Contacto de soporte

Si pasa algo que no está acá, ver [CONTINGENCIA.md](CONTINGENCIA.md) o contactar al desarrollador.
