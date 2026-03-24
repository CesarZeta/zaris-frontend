# =============================================================
# ZARIS v2.0 — CRM Models (SQLAlchemy ORM)
# Mapea exactamente crm_schema.sql
# Depende de: models/usuarios.py (tabla usuario)
#             bds_schema.sql     (tabla persona)
# =============================================================

import enum
from sqlalchemy import (
    Column, SmallInteger, BigInteger, Integer, String, Boolean,
    Text, DateTime, ForeignKey, CheckConstraint, UniqueConstraint,
    Enum as SAEnum, text
)
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── 1. ENUMs ────────────────────────────────────────────────────────────────

class CategoriaEnum(str, enum.Enum):
    CONSULTA = "CONSULTA"
    RECLAMO  = "RECLAMO"


class EstadoIncidenteEnum(str, enum.Enum):
    SIN_ASIGNAR        = "SIN_ASIGNAR"
    EN_PROCESO         = "EN_PROCESO"
    RESUELTO           = "RESUELTO"
    CANCELADO          = "CANCELADO"
    EN_ESPERA_TERCEROS = "EN_ESPERA_TERCEROS"


class EstadoOTEnum(str, enum.Enum):
    PENDIENTE   = "PENDIENTE"
    EN_PROCESO  = "EN_PROCESO"
    COMPLETADA  = "COMPLETADA"
    CANCELADA   = "CANCELADA"


# ── 2. CATÁLOGO DE ESTADOS DE INCIDENTE ────────────────────────────────────

class CrmEstado(Base):
    """Catálogo de estados de un incidente (FK real en crm_incidente)."""
    __tablename__ = "crm_estado"

    id          = Column(SmallInteger, primary_key=True, autoincrement=True)
    nombre      = Column(SAEnum(EstadoIncidenteEnum, name="crm_est_inc_enum"),
                         nullable=False, unique=True)
    descripcion = Column(String(200))
    es_terminal = Column(Boolean, nullable=False, server_default=text("false"))


# ── 3. CANALES DE ORIGEN ────────────────────────────────────────────────────

class CrmCanalOrigen(Base):
    """Canales por los que se recibe un incidente: Call Center, Web, etc."""
    __tablename__ = "crm_canal_origen"

    id     = Column(SmallInteger, primary_key=True, autoincrement=True)
    nombre = Column(String(60), nullable=False, unique=True)
    activo = Column(Boolean, nullable=False, server_default=text("true"))


# ── 4. ÁREAS, SUB-ÁREAS, TIPOS DE INCIDENTE ────────────────────────────────

class CrmArea(Base):
    """Área de clasificación (Alumbrado Público, Higiene Urbana, …)."""
    __tablename__ = "crm_area"

    id             = Column(SmallInteger, primary_key=True, autoincrement=True)
    nombre         = Column(String(100), nullable=False, unique=True)
    descripcion    = Column(String(250))
    palabras_clave = Column(Text)          # CSV para clasificación automática
    activo         = Column(Boolean, nullable=False, server_default=text("true"))

    subareas = relationship("CrmSubarea", back_populates="area",
                            cascade="all, delete-orphan")


class CrmSubarea(Base):
    """Sub-área dentro de un Área (Luminarias, Baches, …)."""
    __tablename__ = "crm_subarea"
    __table_args__ = (
        UniqueConstraint("id_area", "nombre", name="uq_subarea"),
    )

    id          = Column(SmallInteger, primary_key=True, autoincrement=True)
    id_area     = Column(SmallInteger, ForeignKey("crm_area.id"), nullable=False)
    nombre      = Column(String(100), nullable=False)
    descripcion = Column(String(250))
    activo      = Column(Boolean, nullable=False, server_default=text("true"))

    area  = relationship("CrmArea", back_populates="subareas")
    tipos = relationship("CrmTipoIncidente", back_populates="subarea")


class CrmTipoIncidente(Base):
    """Tipo de incidente (Luminaria sin luz, Bache en calzada, …)."""
    __tablename__ = "crm_tipo_incidente"

    id          = Column(SmallInteger, primary_key=True, autoincrement=True)
    id_subarea  = Column(SmallInteger, ForeignKey("crm_subarea.id"), nullable=False)
    nombre      = Column(String(120), nullable=False)
    categoria   = Column(SAEnum(CategoriaEnum, name="crm_categoria_enum"),
                         nullable=False)
    sla_horas   = Column(SmallInteger, nullable=False, server_default=text("0"))
    descripcion = Column(String(300))
    activo      = Column(Boolean, nullable=False, server_default=text("true"))

    subarea = relationship("CrmSubarea", back_populates="tipos")


# ── 5. INCIDENTE (tabla principal) ─────────────────────────────────────────

class CrmIncidente(Base):
    """Ticket principal de incidente o consulta ciudadana."""
    __tablename__ = "crm_incidente"
    __table_args__ = (
        CheckConstraint("id_incidente_padre <> id", name="ck_padre_no_self"),
    )

    id                  = Column(BigInteger, primary_key=True, autoincrement=True)
    nro_referencia      = Column(String(20), unique=True)   # INC-YYYY-000001

    # Ciudadano — MANDATO CERO ANONIMATO (NOT NULL)
    id_persona          = Column(BigInteger, ForeignKey("persona.id"), nullable=False, index=True)

    # Clasificación
    id_tipo             = Column(SmallInteger, ForeignKey("crm_tipo_incidente.id"),
                                 nullable=False, index=True)
    id_canal_origen     = Column(SmallInteger, ForeignKey("crm_canal_origen.id"),
                                 nullable=False)

    # Estado (FK a catálogo)
    id_estado           = Column(SmallInteger, ForeignKey("crm_estado.id"),
                                 nullable=False, server_default=text("1"), index=True)

    # Contenido
    descripcion         = Column(Text, nullable=False)
    ubicacion_calle     = Column(String(200))
    ubicacion_altura    = Column(String(20))
    ubicacion_referencia = Column(Text)

    # Relación padre/hijo
    id_incidente_padre  = Column(BigInteger, ForeignKey("crm_incidente.id"),
                                 index=True)

    # Agentes
    id_usuario_creador  = Column(BigInteger, ForeignKey("usuario.id"), nullable=False)
    id_usuario_asignado = Column(BigInteger, ForeignKey("usuario.id"))

    # SLA
    fecha_limite_sla    = Column(DateTime(timezone=True))

    # Auditoría
    created_at          = Column(DateTime(timezone=True),
                                 nullable=False, server_default=text("now()"))
    updated_at          = Column(DateTime(timezone=True),
                                 nullable=False, server_default=text("now()"))

    # Relaciones
    estado         = relationship("CrmEstado")
    tipo           = relationship("CrmTipoIncidente")
    canal_origen   = relationship("CrmCanalOrigen")
    creador        = relationship("Usuario", foreign_keys=[id_usuario_creador])
    asignado       = relationship("Usuario", foreign_keys=[id_usuario_asignado])
    hijos          = relationship("CrmIncidente",
                                  primaryjoin="CrmIncidente.id_incidente_padre == CrmIncidente.id",
                                  foreign_keys=[id_incidente_padre])
    observaciones  = relationship("CrmObservacion",
                                  back_populates="incidente",
                                  order_by="CrmObservacion.created_at")
    ordenes_trabajo = relationship("CrmOrdenTrabajo",
                                   back_populates="incidente",
                                   order_by="CrmOrdenTrabajo.created_at")


# ── 7. OBSERVACIONES (log inmutable) ───────────────────────────────────────

class CrmObservacion(Base):
    """
    Bitácora inmutable de eventos del ticket.
    La inmutabilidad se impone en la BD con RULES; el ORM sólo hace INSERT.
    """
    __tablename__ = "crm_observacion"

    id              = Column(BigInteger, primary_key=True, autoincrement=True)
    id_incidente    = Column(BigInteger, ForeignKey("crm_incidente.id"),
                             nullable=False, index=True)
    id_usuario      = Column(BigInteger, ForeignKey("usuario.id"), nullable=False)
    tipo            = Column(String(30), nullable=False, server_default=text("'NOTA'"))
    # Valores posibles: NOTA, CAMBIO_ESTADO, CREACION, OT_CREADA, OT_COMPLETADA
    texto           = Column(Text, nullable=False)
    estado_anterior = Column(SmallInteger, ForeignKey("crm_estado.id"))
    estado_nuevo    = Column(SmallInteger, ForeignKey("crm_estado.id"))
    created_at      = Column(DateTime(timezone=True),
                             nullable=False, server_default=text("now()"))

    incidente        = relationship("CrmIncidente", back_populates="observaciones")
    usuario          = relationship("Usuario")
    est_anterior_rel = relationship("CrmEstado", foreign_keys=[estado_anterior])
    est_nuevo_rel    = relationship("CrmEstado", foreign_keys=[estado_nuevo])


# ── 8. ÓRDENES DE TRABAJO ───────────────────────────────────────────────────

class CrmOrdenTrabajo(Base):
    """Orden de Trabajo asignada a un agente de gestión."""
    __tablename__ = "crm_orden_trabajo"

    id               = Column(BigInteger, primary_key=True, autoincrement=True)
    id_incidente     = Column(BigInteger, ForeignKey("crm_incidente.id"),
                              nullable=False, index=True)
    id_subarea       = Column(SmallInteger, ForeignKey("crm_subarea.id"),
                              nullable=False)
    id_usuario       = Column(BigInteger, ForeignKey("usuario.id"))  # Agente GS
    estado           = Column(SAEnum(EstadoOTEnum, name="crm_est_ot_enum"),
                              nullable=False, server_default=text("'PENDIENTE'"),
                              index=True)
    descripcion      = Column(Text)
    fecha_asignacion = Column(DateTime(timezone=True), server_default=text("now()"))
    fecha_cierre     = Column(DateTime(timezone=True))
    observaciones    = Column(Text)
    created_at       = Column(DateTime(timezone=True),
                              nullable=False, server_default=text("now()"))
    updated_at       = Column(DateTime(timezone=True),
                              nullable=False, server_default=text("now()"))

    incidente = relationship("CrmIncidente", back_populates="ordenes_trabajo")
    subarea   = relationship("CrmSubarea")
    agente_gs = relationship("Usuario")


# ── 13. ASIGNACIÓN DE AGENTES ────────────────────────────────────────────────

class CrmAgenteCanal(Base):
    """Agente de ATENCIÓN — vinculado a un canal de origen."""
    __tablename__ = "crm_agente_canal"
    __table_args__ = (
        UniqueConstraint("id_usuario", "id_canal", name="uq_agente_canal"),
    )

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario = Column(BigInteger, ForeignKey("usuario.id"), nullable=False)
    id_canal   = Column(SmallInteger, ForeignKey("crm_canal_origen.id"), nullable=False)
    activo     = Column(Boolean, nullable=False, server_default=text("true"))

    usuario = relationship("Usuario")
    canal   = relationship("CrmCanalOrigen")


class CrmAgenteSubarea(Base):
    """Agente de GESTIÓN — vinculado a una sub-área operativa."""
    __tablename__ = "crm_agente_subarea"
    __table_args__ = (
        UniqueConstraint("id_usuario", "id_subarea", name="uq_agente_subarea"),
    )

    id         = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario = Column(BigInteger, ForeignKey("usuario.id"), nullable=False)
    id_subarea = Column(SmallInteger, ForeignKey("crm_subarea.id"), nullable=False)
    activo     = Column(Boolean, nullable=False, server_default=text("true"))

    usuario = relationship("Usuario")
    subarea = relationship("CrmSubarea")
