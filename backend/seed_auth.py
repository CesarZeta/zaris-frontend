"""
Seed de autenticación — ZARIS ZGE.

1. Aplica la migración 11 (email + columnas de auditoría).
2. Actualiza todos los usuarios con:
   - email = username@municipio.gob.ar (si no tienen)
   - password_hash = bcrypt('123456')

Uso:
    cd backend/
    ENV_FILE=.env.local python seed_auth.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
import bcrypt as _bcrypt
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

HASH_123456 = _bcrypt.hashpw(b"123456", _bcrypt.gensalt()).decode()


async def main():
    sql_migration = Path(__file__).parent.parent / "sql" / "11_auth_auditoria.sql"
    migration_sql = sql_migration.read_text(encoding="utf-8")

    async with AsyncSessionLocal() as db:
        print("&gt; Aplicando migración 11...")
        # Ejecutar sentencia por sentencia (psql no soporta multi-statement en asyncpg)
        for stmt in [s.strip() for s in migration_sql.split(";") if s.strip()]:
            try:
                await db.execute(text(stmt))
            except Exception as e:
                # Las columnas que ya existen lanzan duplicate_column — ignorar
                if "already exists" in str(e) or "ya existe" in str(e):
                    pass
                else:
                    print(f"  WARN: {e}")
        await db.commit()
        print("  OK Migración aplicada")

        print("&gt; Actualizando passwords a bcrypt('123456')...")
        result = await db.execute(text("SELECT id_usuario, username, email FROM usuarios"))
        usuarios = result.fetchall()
        for u in usuarios:
            email = u.email or f"{u.username}@municipio.gob.ar"
            await db.execute(
                text("""
                    UPDATE usuarios
                    SET password_hash = :ph,
                        email = :email
                    WHERE id_usuario = :id
                """),
                {"ph": HASH_123456, "email": email, "id": u.id_usuario},
            )
            print(f"  OK {u.username} -> {email}")
        await db.commit()

    print("\nSeed completado.")


if __name__ == "__main__":
    asyncio.run(main())
