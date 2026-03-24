"""
seed_crm.py — Poblar datos iniciales del módulo CRM en la BD.
Ejecutar desde: backend/
  python seed_crm.py

Idempotente: usa ON CONFLICT DO NOTHING en la BD, salvo los tipos
que no tienen UNIQUE constraint — se verifica existencia antes de insertar.
"""

import asyncio
from sqlalchemy import text
from app.core.database import engine

# =============================================================
# SQL de seed (extraído de crm_schema.sql)
# =============================================================
SQL_SEED = """
-- Estados
INSERT INTO crm_estado (nombre, descripcion, es_terminal) VALUES
  ('SIN_ASIGNAR',        'Estado inicial. Sin OT ni intervención activa.',         FALSE),
  ('EN_PROCESO',         'Tiene una OT activa o intervención en curso.',            FALSE),
  ('RESUELTO',           'El problema fue solucionado. Estado terminal.',           TRUE),
  ('CANCELADO',          'Desestimado administrativamente. Estado terminal.',       TRUE),
  ('EN_ESPERA_TERCEROS', 'Frenado por dependencia externa o ticket hijo.',         FALSE)
ON CONFLICT DO NOTHING;

-- Canales de origen
INSERT INTO crm_canal_origen (nombre) VALUES
  ('Call Center'), ('Web'), ('Presencial'), ('WhatsApp'), ('Email')
ON CONFLICT DO NOTHING;

-- Áreas
INSERT INTO crm_area (nombre, descripcion, palabras_clave) VALUES
  ('Alumbrado Público',  'Luminarias, semáforos y señalización lumínica', 'lámpara,farol,luminaria,semáforo,luz,alumbrado'),
  ('Higiene Urbana',     'Recolección de residuos y limpieza de calles',  'basura,residuo,recolección,limpieza,basurero,contenedor'),
  ('Obras Viales',       'Baches, pavimento, cordones y veredas',         'bache,asfalto,pavimento,cordón,vereda,obra,calle rota'),
  ('Espacios Verdes',    'Arbolado urbano, plazas y parques',             'árbol,poda,plaza,parque,verde,rama'),
  ('Tránsito',           'Señalización, regulación y accidentes viales',  'tránsito,señal,accidente,semáforo,velocidad')
ON CONFLICT DO NOTHING;

-- Sub-áreas
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Luminarias'           FROM crm_area WHERE nombre='Alumbrado Público'   ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Semáforos'            FROM crm_area WHERE nombre='Alumbrado Público'   ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Recolección Residuos' FROM crm_area WHERE nombre='Higiene Urbana'      ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Limpieza de Calles'   FROM crm_area WHERE nombre='Higiene Urbana'      ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Baches'               FROM crm_area WHERE nombre='Obras Viales'        ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Cordones y Veredas'   FROM crm_area WHERE nombre='Obras Viales'        ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Poda'                 FROM crm_area WHERE nombre='Espacios Verdes'     ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Plazas y Parques'     FROM crm_area WHERE nombre='Espacios Verdes'     ON CONFLICT DO NOTHING;
INSERT INTO crm_subarea (id_area, nombre)
  SELECT id,'Señalización'         FROM crm_area WHERE nombre='Tránsito'            ON CONFLICT DO NOTHING;

-- Tipos de incidente (RECLAMO con SLA) — sólo inserta si no existen
INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Luminaria sin luz', 'RECLAMO', 48
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Alumbrado Público' AND s.nombre='Luminarias'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Luminaria sin luz');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Semáforo dañado', 'RECLAMO', 24
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Alumbrado Público' AND s.nombre='Semáforos'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Semáforo dañado');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Recolección no realizada', 'RECLAMO', 24
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Higiene Urbana' AND s.nombre='Recolección Residuos'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Recolección no realizada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Calle sin limpiar', 'RECLAMO', 48
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Higiene Urbana' AND s.nombre='Limpieza de Calles'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Calle sin limpiar');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Bache en calzada', 'RECLAMO', 72
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Obras Viales' AND s.nombre='Baches'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Bache en calzada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Vereda dañada', 'RECLAMO', 96
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Obras Viales' AND s.nombre='Cordones y Veredas'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Vereda dañada');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Poda de árbol necesaria', 'RECLAMO', 120
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Espacios Verdes' AND s.nombre='Poda'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Poda de árbol necesaria');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Señal dañada o faltante', 'RECLAMO', 48
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Tránsito' AND s.nombre='Señalización'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Señal dañada o faltante');

-- Tipos CONSULTA
INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Consulta horario de servicio', 'CONSULTA', 0
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Alumbrado Público' AND s.nombre='Luminarias'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Consulta horario de servicio');

INSERT INTO crm_tipo_incidente (id_subarea, nombre, categoria, sla_horas)
SELECT s.id, 'Consulta días de recolección', 'CONSULTA', 0
FROM crm_subarea s JOIN crm_area a ON s.id_area=a.id
WHERE a.nombre='Higiene Urbana' AND s.nombre='Recolección Residuos'
  AND NOT EXISTS (SELECT 1 FROM crm_tipo_incidente WHERE nombre='Consulta días de recolección');
"""


async def seed():
    print("[SEED] Iniciando seed de datos CRM...")
    async with engine.begin() as conn:
        # Ejecutar sentencia por sentencia (asyncpg no admite multi-statement en una sola exec)
        for stmt in SQL_SEED.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                await conn.execute(text(stmt))
    print("[OK] Seed completado exitosamente.")
    print("   - Estados:   5")
    print("   - Canales:   5")
    print("   - Areas:     5")
    print("   - Sub-areas: 9")
    print("   - Tipos:    10 (8 RECLAMO + 2 CONSULTA)")


if __name__ == "__main__":
    asyncio.run(seed())
