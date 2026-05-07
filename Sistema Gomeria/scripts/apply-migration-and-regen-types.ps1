# ================================================================
# apply-migration-and-regen-types.ps1
#
# Ejecutar UNA vez desde PowerShell en la carpeta Sistema Gomeria:
#   cd "Sistema Gomeria"
#   .\scripts\apply-migration-and-regen-types.ps1
#
# Lo que hace:
#   1. supabase login  → abre el navegador para autorizar
#   2. supabase link   → vincula al proyecto aaplvlvewjeovitpyscg
#   3. supabase db push → aplica 0010_security_hardening.sql en prod
#   4. supabase gen types → regenera src/types/database.ts
# ================================================================

$ErrorActionPreference = "Stop"
$ProjectRef = "aaplvlvewjeovitpyscg"

Write-Host "`n=== Paso 1: Login ===" -ForegroundColor Cyan
npx supabase login

Write-Host "`n=== Paso 2: Vincular proyecto ===" -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef

Write-Host "`n=== Paso 3: Aplicar migraciones pendientes en prod ===" -ForegroundColor Cyan
npx supabase db push

Write-Host "`n=== Paso 4: Regenerar src/types/database.ts ===" -ForegroundColor Cyan
npx supabase gen types typescript --project-id $ProjectRef `
  | Out-File -FilePath "src/types/database.ts" -Encoding utf8

Write-Host "`n=== Paso 5: Verificar tipos ===" -ForegroundColor Cyan
npx tsc --noEmit

Write-Host "`nListo! Acordate de hacer git add src/types/database.ts && git commit -m 'chore: regenerar database.ts'" -ForegroundColor Green
