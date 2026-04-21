# CLAUDE.md — ZARIS Gestión Estatal (ZGE)

> Contexto operativo para Claude Code. La referencia exhaustiva del stack/credenciales
> está en `ZARIS_REFERENCIA_PROYECTO.md` (no commiteado por `.gitignore`).
> Este archivo prioriza lo necesario para trabajar día a día en el módulo **BUC**.

---

## 1. Qué es este proyecto

**ZGE** = suite ZARIS Gestión Estatal. Módulos presentes hoy:

- **BUC** — Base Única de Ciudadanos y Empresas (ABM ciudadanos, empresas, usuarios,
  vínculos ciudadano↔empresa, padrones de referencia). En desarrollo activo.
- **Agenda** — gestión de áreas y eventos. Frontend y schema SQL ya implementados
  (ver sección 7).

A futuro la suite incorporará CRM, Historia Clínica, etc. — bajo SSO único.

---

## 2. Stack

| Capa     | Tecnología |
|----------|------------|
| Frontend | HTML5 + JS (ES6+) + CSS3 vanilla. Sin frameworks. Google Fonts: Inter + JetBrains Mono. |
| Backend  | Python 3.10+, FastAPI 0.111, SQLAlchemy 2.0 async (asyncpg), Pydantic 2.7, JWT (python-jose), bcrypt (passlib). |
| BD       | PostgreSQL en Supabase (`REDACTED.supabase.co`). |
| Deploy   | Frontend → GitHub Pages (`CesarZeta/zaris-frontend`). Backend → Railway (`CesarZeta/zaris-api`, auto-deploy on push). |

URL pública API: `https://zaris-api-production-bf0b.up.railway.app/api`
Health: `/api/health` · Docs: `/docs` · Prefijo BUC: `/api/v1/buc`

---

## 3. Layout del repo

```
ZGE/
├── frontend/          # HTML/JS/CSS — se sirve desde GitHub Pages
│   ├── menu.html              # Hub del módulo BUC
│   ├── ciudadano.html         # ABM + consulta de ciudadanos
│   ├── empresa.html           # ABM + consulta de empresas
│   ├── usuarios.html          # ABM de usuarios del sistema
│   ├── mainconfig.html        # Padrones de referencia (nacionalidades, actividades, etc.)
│   ├── agenda.html            # Pantalla del módulo Agenda
│   ├── agenda.js              # Lógica de Agenda
│   ├── agenda.css             # Estilos de Agenda
│   ├── styles.css             # Tema global ZARIS (variables --z-*)
│   └── js/validaciones.js     # Validaciones compartidas (CUIL/CUIT, email, tel)
│
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI + CORS + lifespan
│   │   ├── core/{config,database}.py  # Settings + Engine async + Base ORM
│   │   ├── api/routes/buc.py          # Todos los endpoints del módulo
│   │   ├── models/buc.py              # ORM: Usuario, Nacionalidad, TipoRepresentacion,
│   │   │                              #      Actividad, Ciudadano, Empresa, CiudadanoEmpresa
│   │   └── schemas/buc.py             # Pydantic in/out
│   ├── requirements.txt
│   ├── Procfile                       # `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
│   └── pyproject.toml
│
├── sql/                       # Excluido del repo (ver .gitignore). Schemas + migraciones.
│   ├── 00_deploy_buc.sql              # Schema completo del módulo BUC
│   ├── 01_migration_observaciones_500.sql
│   ├── 02_migration_usuarios.sql
│   ├── 03_agenda_areas.sql            # Áreas para el módulo Agenda
│   ├── 04_agenda_schema.sql           # Schema principal del módulo Agenda
│   └── deploy_to_supabase.py          # Aplicador de migraciones a Supabase
│
├── .agent/                    # Skills/workflows Antigravity (excluido del repo)
└── .gitignore                 # Excluye: backend/.env, sql/, .agent/, *.docx, REFERENCIA
```

`.gitignore` excluye `backend/.env`, `sql/`, `.agent/`, `*.docx`, `*.log`,
`ZARIS_REFERENCIA_PROYECTO.md` y `deploy_to_supabase.py`.

---

## 4. Reglas mandatorias (de `.agent/skills/reglas_zaris/SKILL.md`)

Estas son inviolables. Cualquier cambio debe respetarlas.

1. **SSO único.** Login solo en `home.html` / servicio central. Cada módulo verifica
   `localStorage.zaris_session` y, si falta, redirige al home. Prohibido modales o
   pantallas de login locales por módulo.
2. **BUC es la fuente única de verdad para personas.** Cualquier módulo que
   referencie ciudadanos lo hace por `id_ciudadano` apuntando a `ciudadanos`. Nunca
   duplicar columnas maestras (DNI, nombre, teléfono) en módulos subsidiarios.
3. **Roles modulares.** Tabla `usuarios` única, con flags por módulo (ej. `buc_acceso`).
   Anticipar que un usuario puede tener acceso a un módulo y no a otro.
4. **Convenciones:** SQL `snake_case`. API con prefijo `/api/v1/<modulo>`. Timestamps
   en UTC. Bajas lógicas con `activo = false` — **nunca DELETE físico**.

---

## 5. Cómo trabajar día a día

### Backend local
```bash
cd backend
pip install -r requirements.txt
# backend/.env debe existir con POSTGRES_* o DATABASE_URL apuntando a Supabase
uvicorn app.main:app --reload
```

### Aplicar migraciones SQL a Supabase
Las migraciones viven en `sql/`. Usar `sql/deploy_to_supabase.py` (no commiteado)
o ejecutarlas manualmente desde el dashboard de Supabase. Cada nueva migración
debe ser idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

### Deploy
Workflow detallado en `.agent/workflows/deploy.md`. Resumen:

```bash
# Frontend → GitHub Pages
git add frontend/ .gitignore
git commit -m "feat(BUC): ..."
git push origin main          # Deploy automático

# Backend → Railway: copiar a clon temporal y push
# (ver .agent/workflows/deploy.md para el script PowerShell completo)
```

> El repo local solo tiene remote `origin` → `zaris-frontend`. El backend se
> sincroniza vía clon temporal en `$env:TEMP\zaris-api-deploy` que pushea a
> `zaris-api`. **No** confirmar deploys ni pushes sin pedir autorización al usuario.

---

## 6. Convenciones específicas que ya están vigentes

Observadas en el código actual — replicar al sumar features:

- **CUIL/CUIT:** se persisten **sin guiones** (ver commit `8889213`). Las validaciones
  en `frontend/js/validaciones.js` aceptan input con o sin guiones y normalizan.
- **Auditoría de cambios:** ciudadanos y empresas tienen `modificado_por` (FK a
  `usuarios`) + `fecha_modif`. Toda mutación debe poblar ambos.
- **Búsqueda dual** (numérica vs texto): los endpoints `/buscar` aceptan `tipo=auto`
  y deciden entre buscar por CUIL/username o por nombre.
- **Estilos:** todas las clases CSS usan prefijo `z-` y las variables `--z-*` definidas
  en `frontend/styles.css`. Mantener consistencia visual con `mainconfig.html` y
  `usuarios.html` (commit `b62ba02` estableció el patrón).
- **Sin commits de credenciales.** `backend/.env` está en `.gitignore`. Las creds
  reales viven en el dashboard de Railway (vars de entorno) y en
  `ZARIS_REFERENCIA_PROYECTO.md` (local, no commiteado).

---

## 7. Estado actual y próximas piezas (al 2026-04-21)

Implementado:
- ABM de ciudadanos (con padrón de nacionalidades).
- ABM de empresas (con padrón de actividades CLAE-AFIP).
- Vínculos ciudadano↔empresa con tipo de representación.
- ABM de usuarios del sistema (con `nivel_acceso` 1–4 y flag `buc_acceso`).
- Pantalla `mainconfig.html` para administrar padrones.
- Auditoría `modificado_por` + paginación + endurecimiento de seguridad.
- Módulo **Agenda** — frontend (`frontend/agenda.html`, `agenda.js`, `agenda.css`)
  y migraciones (`sql/03_agenda_areas.sql`, `sql/04_agenda_schema.sql`).
- Seed de tipos de reclamo: `backend/seed_reclamos.py` existe. **No** existe
  `backend/seed_crm.py` (el módulo CRM todavía no fue iniciado).

Aún faltante / a discutir con el usuario antes de tocar:
- Pantalla `home.html` real con login SSO (hoy `menu.html` es el hub del módulo
  BUC, no el portal SSO de la suite).
- Roles efectivos por módulo más allá del flag `buc_acceso`.
- Otros módulos de la suite (CRM, HC) — todavía no iniciados aquí.

---

## 8. Entorno local (pendiente de configurar)

Este entorno local aún **no está configurado**. Piezas pendientes:

- **PostgreSQL 14 local:** pendiente de instalar manualmente en Windows.
  - Comando sugerido: `winget install PostgreSQL.PostgreSQL.14`
  - Target: base `zaris_dev` · usuario `postgres` · password `postgres` · puerto `5432`
- **`backend/.env.local`:** pendiente de crear. Template:
  ```
  PROJECT_NAME="ZARIS API - LOCAL"
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=REDACTED
  POSTGRES_SERVER=REDACTED
  POSTGRES_PORT=5432
  POSTGRES_DB=zaris_dev
  SECRET_KEY="REDACTED"
  ACCESS_TOKEN_EXPIRE_MINUTES=1440
  ```
- **`backend/run_local.bat`:** pendiente de crear. Debe exportar
  `ENV_FILE=.env.local` y lanzar `uvicorn app.main:app --reload --port 8000`
  (requiere previamente adaptar `backend/app/core/config.py` para leer
  `env_file = os.getenv("ENV_FILE", ".env")`).
