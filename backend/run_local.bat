@echo off
REM ─────────────────────────────────────────────────────────────
REM ZARIS API — Lanzador en modo LOCAL
REM Carga backend\.env.local (Postgres local zaris_dev)
REM ─────────────────────────────────────────────────────────────
cd /d "%~dp0"
echo Iniciando ZARIS API en modo LOCAL...
set ENV_FILE=.env.local
uvicorn app.main:app --reload --port 8000
pause
