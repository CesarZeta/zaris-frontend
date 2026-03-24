import asyncio
from app.core.database import engine, Base
# Importar los modelos para que Base los registre
from app.models.usuarios import Usuario, Rol, Sesion
from app.models.crm import (        # noqa: F401 — registra tablas CRM en Base.metadata
    CrmEstado, CrmCanalOrigen, CrmArea, CrmSubarea, CrmTipoIncidente,
    CrmIncidente, CrmObservacion, CrmOrdenTrabajo,
    CrmAgenteCanal, CrmAgenteSubarea,
)

async def init_db():
    async with engine.begin() as conn:
        print("Creando tablas si no existen...")
        # En postgres con el script SQL previo ya existen, pero esto valida la conexión
        # y previene errores si la DB estuviera vacía.
        await conn.run_sync(Base.metadata.create_all)
    print("Base de datos inicializada/verificada exitosamente.")

if __name__ == "__main__":
    asyncio.run(init_db())
