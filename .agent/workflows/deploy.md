---
description: Deploy frontend a GitHub Pages y backend a Railway
---

# Deploy ZARIS — Frontend + Backend

## Arquitectura de repos
| Repositorio | Contenido | Deploy destino |
|---|---|---|
| `CesarZeta/zaris-frontend` | HTML, JS, CSS del frontend | GitHub Pages |
| `CesarZeta/zaris-api` | Backend FastAPI (Python) | Railway (auto-deploy) |

El directorio `backend/` del proyecto local se commitea en **ambos** repos.

---

## Deploy completo paso a paso

### 1. Commit de cambios

```powershell
# Frontend
git add crm.html crm.js crm_api.js  # (o los archivos que hayas cambiado)
git commit -m "feat: descripcion"

# Backend (usando -f para ignorar el .gitignore del root)
git add -f backend/app/ backend/init_db.py backend/requirements.txt
git commit -m "feat(backend): descripcion"
```

### 2. Push frontend a GitHub Pages
// turbo
```powershell
git push origin main
```

### 3. Push backend a Railway (dispara auto-deploy)
// turbo
```powershell
# Copiar archivos al clon local del repo backend
Copy-Item -Path "backend\app\*" -Destination "$env:TEMP\zaris-api-deploy\app\" -Recurse -Force
Copy-Item "backend\init_db.py", "backend\seed_crm.py", "backend\requirements.txt" "$env:TEMP\zaris-api-deploy\" -Force

# Commit y push en el clon
Set-Location "$env:TEMP\zaris-api-deploy"
git add -A
git commit -m "deploy: sync backend desde zaris-frontend"
git push origin main
Set-Location "c:\Users\Cesar\Documents\ANTIGRAVITY\Base_Unica_Personas"
```

> **Nota:** `$env:TEMP\zaris-api-deploy` es el directorio donde está clonado `CesarZeta/zaris-api`.
> Si no existe, clonarlo primero con:
> `git clone https://github.com/CesarZeta/zaris-api.git "$env:TEMP\zaris-api-deploy"`

---

## Activar auto-deploy en Railway (sólo una vez)

1. Ir a https://railway.com → proyecto `inspiring-empathy` → servicio `zaris-api`
2. Click en pestaña **Settings**
3. Sección **Source** → verificar que esté conectado a `CesarZeta/zaris-api` rama `main`
4. Activar toggle **"Deploy on push"** si está apagado

Una vez activado, **cada `git push` al repo `zaris-api` dispara un nuevo deploy automáticamente.**

---

## Ejecutar seed en producción (primera vez o nuevas tablas)

```bash
# Desde Railway CLI (instalar con: npm install -g @railway/cli)
railway login
railway run python seed_crm.py
```
