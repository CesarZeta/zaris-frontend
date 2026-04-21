"""
ZARIS — Setup del entorno LOCAL.

Inicializa la base de datos local (zaris_dev en Postgres local) y carga seeds.

Pasos:
    1. Crea las tablas (importa app.init_db.create_tables y lo ejecuta).
    2. Corre seed_reclamos.py (subprocess).

Uso:
    cd backend
    python setup_local.py

Pre-requisitos:
    - Postgres local corriendo en localhost:5432.
    - Base zaris_dev creada (CREATE DATABASE zaris_dev;).
    - backend/.env.local existente.

Nota: fuerza ENV_FILE=.env.local antes de cualquier import de app.* para que
Pydantic Settings tome la configuración local y no la de produccion (.env).
"""
import asyncio
import os
import subprocess
import sys

# IMPORTANTE: setear ENV_FILE ANTES de importar app.* (settings se cachea al importar)
os.environ["ENV_FILE"] = ".env.local"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _print_step(num: int, total: int, title: str) -> None:
    print(f"\n[{num}/{total}] {title}")
    print("-" * 60)


def step_init_db() -> bool:
    """Crea todas las tablas en la base local (idempotente)."""
    try:
        # Import perezoso para que ENV_FILE ya esté seteado
        sys.path.insert(0, BASE_DIR)
        from app.init_db import create_tables
        from app.core.config import settings

        print(f"Target DB: {settings.POSTGRES_DB} @ {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}")
        asyncio.run(create_tables())
        print("OK — tablas creadas/verificadas.")
        return True
    except Exception as exc:
        print(f"FAILED — init_db: {exc}")
        return False


def step_seed_reclamos() -> bool:
    """Ejecuta seed_reclamos.py como subprocess heredando ENV_FILE."""
    seed_path = os.path.join(BASE_DIR, "seed_reclamos.py")
    if not os.path.exists(seed_path):
        print(f"FAILED — no se encontró {seed_path}")
        return False
    try:
        result = subprocess.run(
            [sys.executable, seed_path],
            cwd=BASE_DIR,
            env={**os.environ, "ENV_FILE": ".env.local"},
            check=True,
        )
        if result.returncode == 0:
            print("OK — seed_reclamos completado.")
            return True
        print(f"FAILED — seed_reclamos retornó {result.returncode}")
        return False
    except subprocess.CalledProcessError as exc:
        print(f"FAILED — seed_reclamos: returncode {exc.returncode}")
        return False
    except Exception as exc:
        print(f"FAILED — seed_reclamos: {exc}")
        return False


def main() -> int:
    print("=" * 60)
    print("ZARIS — Setup del entorno LOCAL (zaris_dev)")
    print("=" * 60)

    steps = [
        ("Crear tablas (init_db)", step_init_db),
        ("Cargar seed de reclamos (seed_reclamos.py)", step_seed_reclamos),
    ]
    total = len(steps)

    for i, (title, func) in enumerate(steps, start=1):
        _print_step(i, total, title)
        if not func():
            print("\n" + "=" * 60)
            print(f"ABORTADO en paso {i}/{total}: {title}")
            print("=" * 60)
            return 1

    print("\n" + "=" * 60)
    print("Setup local completado correctamente.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
