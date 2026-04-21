"""
ZARIS API — Creación de tablas en startup.
Importa todos los modelos ORM para que SQLAlchemy los registre en Base.metadata
y luego ejecuta create_all (solo crea si no existen — idempotente).
"""
from app.core.database import Base, engine

# noqa: F401 — imports necesarios para registrar tablas en Base.metadata
from app.models import buc       # noqa: F401
from app.models import reclamos  # noqa: F401


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
