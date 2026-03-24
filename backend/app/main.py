from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
import app.models.crm  # noqa: F401 — registra modelos CRM en Base.metadata al inicio

# =============================================================
# Startup: seed de datos iniciales (idempotente — ON CONFLICT DO NOTHING)
# =============================================================
SEED_SQL = """
INSERT INTO crm_estado (nombre, descripcion, es_terminal) VALUES
  ('SIN_ASIGNAR','Estado inicial. Sin OT ni intervención activa.',FALSE),
  ('EN_PROCESO','Tiene una OT activa o intervención en curso.',FALSE),
  ('RESUELTO','El problema fue solucionado. Estado terminal.',TRUE),
  ('CANCELADO','Desestimado administrativamente. Estado terminal.',TRUE),
  ('EN_ESPERA_TERCEROS','Frenado por dependencia externa o ticket hijo.',FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO crm_canal_origen (nombre) VALUES
  ('Call Center'),('Web'),('Presencial'),('WhatsApp'),('Email')
ON CONFLICT DO NOTHING;

INSERT INTO crm_area (nombre, descripcion, palabras_clave) VALUES
  ('Alumbrado Publico','Luminarias, semaforos y senalizacion luminica','lampara,farol,luminaria,semaforo,luz,alumbrado'),
  ('Higiene Urbana','Recoleccion de residuos y limpieza de calles','basura,residuo,recoleccion,limpieza,basurero,contenedor'),
  ('Obras Viales','Baches, pavimento, cordones y veredas','bache,asfalto,pavimento,cordon,vereda,obra,calle rota'),
  ('Espacios Verdes','Arbolado urbano, plazas y parques','arbol,poda,plaza,parque,verde,rama'),
  ('Transito','Senalizacion, regulacion y accidentes viales','transito,senal,accidente,semaforo,velocidad')
ON CONFLICT DO NOTHING;

INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Luminarias' FROM crm_area WHERE nombre='Alumbrado Publico' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Semaforos' FROM crm_area WHERE nombre='Alumbrado Publico' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Recoleccion Residuos' FROM crm_area WHERE nombre='Higiene Urbana' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Limpieza de Calles' FROM crm_area WHERE nombre='Higiene Urbana' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Baches' FROM crm_area WHERE nombre='Obras Viales' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Cordones y Veredas' FROM crm_area WHERE nombre='Obras Viales' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Poda' FROM crm_area WHERE nombre='Espacios Verdes' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Plazas y Parques' FROM crm_area WHERE nombre='Espacios Verdes' ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Senalizacion' FROM crm_area WHERE nombre='Transito' ON CONFLICT DO NOTHING;

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Luminaria sin luz','RECLAMO',48 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Alumbrado Publico' AND s.nombre='Luminarias'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Luminaria sin luz');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Semaforo danado','RECLAMO',24 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Alumbrado Publico' AND s.nombre='Semaforos'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Semaforo danado');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Recoleccion no realizada','RECLAMO',24 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Higiene Urbana' AND s.nombre='Recoleccion Residuos'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Recoleccion no realizada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Bache en calzada','RECLAMO',72 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Obras Viales' AND s.nombre='Baches'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Bache en calzada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Vereda danada','RECLAMO',96 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Obras Viales' AND s.nombre='Cordones y Veredas'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Vereda danada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Poda de arbol necesaria','RECLAMO',120 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Espacios Verdes' AND s.nombre='Poda'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Poda de arbol necesaria');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id,'Senal danada o faltante','RECLAMO',48 FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Transito' AND s.nombre='Senalizacion'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Senal danada o faltante');
"""


async def run_seed():
    """Seed idempotente de tablas maestras CRM."""
    try:
        async with engine.begin() as conn:
            for stmt in SEED_SQL.split(";"):
                stmt = stmt.strip()
                if stmt and not stmt.startswith("--"):
                    await conn.execute(text(stmt))
        print("[STARTUP] Seed CRM completado.")
    except Exception as e:
        print(f"[STARTUP] Seed CRM omitido (puede ser normal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ejecuta seed al arrancar, luego cede control."""
    await run_seed()
    yield
    # (cleanup al apagar — vacío por ahora)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API integration for BUP, CRM, and Agenda modular architecture.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware to allow requests from the vanilla JS frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def root():
    return {"message": "ZARIS API is running."}

from app.api.routes import auth  # noqa: E402
from app.api.routes import crm   # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(crm.router,  prefix="/api/crm",  tags=["CRM"])
