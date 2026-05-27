# Backup y restore — Sistema Octabalina

Este documento describe cómo se genera, almacena y restaura el backup completo del POS.

## Backup automático del proveedor (Supabase)

Supabase Cloud hace backups automáticos diarios en el plan Free/Pro. Estos backups son **server-side** y no requieren ninguna acción tuya. Para restaurarlos, hay que entrar al dashboard de Supabase → Database → Backups.

**Limitación**: en plan Free los backups solo se conservan 7 días. Para producción real conviene plan Pro (30 días) o exportar manualmente como se describe abajo.

## Backup manual desde la UI (recomendado semanal)

El POS tiene un módulo de backup en `Configuración → Respaldo completo`. Hace lo siguiente:

1. Lee todas las tablas críticas desde Supabase (33 tablas, ver `TABLES_TO_BACKUP` en `src/services/supabaseBackupServiceV2.ts`).
2. Las pagina en batches de 1000 filas (evita el límite default de PostgREST).
3. Empaqueta todo en un JSON con metadata (versión del formato, fecha, host, conteos).
4. Descarga el archivo `octabalina-backup-YYYY-MM-DDTHH-MM-SS.json` en tu carpeta de Descargas.

### Formato del archivo

```json
{
  "metadata": {
    "format_version": 1,
    "generated_at": "2026-05-27T14:30:00.000Z",
    "generator": "Sistema Octabalina",
    "supabase_url": "https://aaplvlvewjeovitpyscg.supabase.co",
    "table_counts": {
      "stores": 1,
      "tires": 1045,
      "customers": 897,
      ...
    }
  },
  "data": {
    "stores": [...],
    "tires": [...],
    ...
  }
}
```

### Cuándo se considera "desactualizado"

El sistema marca el backup como `stale` después de **7 días**. Cuando entrás a Configuración y ya pasó ese tiempo, aparece un banner naranja recordando que hagas uno.

### Rotación recomendada

1. **Cierre Z diario** → imprimí el reporte Z (botón "Imprimir Z" en el modal de cierre de caja).
2. **Backup semanal** → descargá el JSON. Guardalo en:
   - Pendrive físico que rotás (lunes, miércoles, viernes, por ejemplo).
   - O carpeta sincronizada con Google Drive / OneDrive.
3. **Backup mensual** → al fin de mes guardá una copia en una ubicación distinta (otro pendrive, otra cuenta).

Esto te da resistencia a: corrupción del archivo, robo del pendrive, falla de la nube, error humano.

## Restore manual (proceso para emergencia)

**El POS NO restaura desde la UI por seguridad.** El restore requiere intervención técnica en Supabase para evitar sobreescribir datos buenos por accidente.

### Pasos para restaurar

1. **Bajar la app del POS** (no operar mientras se restaura).
2. Abrir el dashboard de Supabase → SQL Editor.
3. Identificar qué tablas restaurar (no tiene por qué ser todo — quizás solo perdiste `customers` por un error).
4. **Truncar** las tablas afectadas (cuidado con FKs — ver orden inverso de `TABLES_TO_BACKUP`).
5. Convertir el JSON del backup a SQL `INSERT` (script futuro `scripts/restoreBackup.ts`, hoy hay que hacerlo a mano con jq o un editor).
6. Ejecutar los INSERTs en el SQL Editor.
7. Subir la app y verificar que el catálogo y los movimientos cuadran.

### Plan de contingencia

Si la base completa se corrompe (improbable pero posible):

1. Crear un proyecto Supabase nuevo.
2. Aplicar todas las migraciones en orden (`supabase/migrations/0001*.sql` → `0035*.sql`).
3. Cargar las seeds básicas (roles, payment_methods, taxes).
4. Restaurar las tablas operativas desde el último backup JSON.
5. Apuntar el frontend al nuevo `VITE_SUPABASE_URL` (en `.env`) y redesplegar.

Tiempo estimado: 2–4 horas si tenés el backup a mano.

## Qué NO está en el backup

- **Storage** (imágenes de tires, logos): si subiste archivos a Supabase Storage, hay que respaldarlos aparte (no están en este backup).
- **Auth users**: usuarios de Supabase Auth (login del dueño) no están en `data` — el restore requiere recrearlos manualmente o usar Auth API.
- **Migraciones aplicadas**: el schema vive en `supabase/migrations/` (versionado en git). El backup solo trae datos.

## Verificación rápida del backup

Después de descargar, abrí el JSON con un editor (o pasalo por `jq`) y revisá:

```bash
# Conteo de filas por tabla (con jq)
jq '.metadata.table_counts' octabalina-backup-2026-05-27.json

# Tamaño del archivo (esperado: 5–50 MB para una gomería en producción)
ls -lh octabalina-backup-*.json

# Validar que es JSON válido (silent = OK)
jq empty octabalina-backup-*.json
```

Si alguna tabla muestra `-1`, esa tabla no se pudo leer (probablemente por RLS). El backup sigue siendo válido para el resto pero conviene investigar por qué falló.
