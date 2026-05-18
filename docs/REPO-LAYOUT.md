# Estructura del repo

```
Sistem-octabalina/
├── CLAUDE.md                  Instrucciones para Claude Code (51 líneas, lean)
├── docs/
│   ├── DESIGN.md              Tokens de color, tipografía, primitivas UI
│   ├── PRODUCT.md             Propósito, usuarios, métricas, restricciones del POS
│   └── REPO-LAYOUT.md         Este archivo
├── Sistema Gomeria/           La app — Vite/React/TS. Todos los comandos npm corren acá.
│   ├── src/
│   ├── supabase/migrations/   Migraciones SQL versionadas
│   ├── .claude/               Config Claude Code del proyecto (gitignored)
│   └── package.json
└── tools/firebird/            Residuo bloqueado por proceso fbserver — gitignored
```

## Material fuera del repo

Vive en `~/octab-tools/`. **No subir al repo.** Reglas en `.gitignore`.

| Carpeta | Tamaño | Propósito |
|---|---|---|
| `gdb-analysis/` | 709 MB | Reportes y muestras del parser .gdb legacy (fase 2 import) |
| `tools/firebird*/` | ~200 MB | Binarios Firebird 1.5/2.0 para leer la DB legacy |
| `tools/node-fb/`, `gdb-parser/`, `work/` | varios | Scripts y artefactos del import desde Firebird |
| `legacy-backups/` | 800 KB | `index.html` single-file viejo + `balina-backup-2026-04-25.json` + `sf_listing.md` |
| `codex-capabilities/` | 1.2 MB | Pack de skills/agents/hooks para Codex AI (referencia) |
| `diseno-empresa/` | 8 KB | Identidad visual de la gomería (logo, IG, web) — NO del POS |

## Cómo sigue siendo accesible

- Para reanalizar la DB legacy: `cd ~/octab-tools && ls gdb-parser/`
- Para inspeccionar el .gdb: corré los binarios desde `~/octab-tools/fb15/` o `firebird15/`
- Para diseño visual de la empresa: `~/octab-tools/diseno-empresa/`

## Convención

Si una herramienta no produce código que viva en `Sistema Gomeria/src/` o `supabase/migrations/`,
**no va en el repo**. Va en `~/octab-tools/`.
