# =============================================================
# ZARIS v2.0 — CRM Schemas (Pydantic v2)
# Cubre todos los recursos expuestos por la API del módulo CRM
# =============================================================

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.models.crm import CategoriaEnum, EstadoIncidenteEnum, EstadoOTEnum


# ─────────────────────────────────────────────────────────────────────────────
# ESTADO DE INCIDENTE
# ─────────────────────────────────────────────────────────────────────────────

class EstadoOut(BaseModel):
    id:          int
    nombre:      EstadoIncidenteEnum
    descripcion: Optional[str] = None
    es_terminal: bool

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# CANAL DE ORIGEN
# ─────────────────────────────────────────────────────────────────────────────

class CanalBase(BaseModel):
    nombre: str = Field(..., max_length=60)
    activo: bool = True

class CanalCreate(CanalBase):
    pass

class CanalUpdate(BaseModel):
    nombre: Optional[str] = Field(None, max_length=60)
    activo: Optional[bool] = None

class CanalOut(CanalBase):
    id: int
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# ÁREA
# ─────────────────────────────────────────────────────────────────────────────

class AreaBase(BaseModel):
    nombre:         str            = Field(..., max_length=100)
    descripcion:    Optional[str]  = Field(None, max_length=250)
    palabras_clave: Optional[str]  = None   # CSV
    activo:         bool           = True

class AreaCreate(AreaBase):
    pass

class AreaUpdate(BaseModel):
    nombre:         Optional[str]  = Field(None, max_length=100)
    descripcion:    Optional[str]  = Field(None, max_length=250)
    palabras_clave: Optional[str]  = None
    activo:         Optional[bool] = None

class AreaOut(AreaBase):
    id: int
    model_config = {"from_attributes": True}

class AreaConSubareas(AreaOut):
    subareas: List["SubareaOut"] = []


# ─────────────────────────────────────────────────────────────────────────────
# SUB-ÁREA
# ─────────────────────────────────────────────────────────────────────────────

class SubareaBase(BaseModel):
    id_area:    int
    nombre:     str           = Field(..., max_length=100)
    descripcion: Optional[str] = Field(None, max_length=250)
    activo:     bool          = True

class SubareaCreate(SubareaBase):
    pass

class SubareaUpdate(BaseModel):
    nombre:      Optional[str]  = Field(None, max_length=100)
    descripcion: Optional[str]  = Field(None, max_length=250)
    activo:      Optional[bool] = None

class SubareaOut(SubareaBase):
    id: int
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# TIPO DE INCIDENTE
# ─────────────────────────────────────────────────────────────────────────────

class TipoBase(BaseModel):
    id_subarea:  int
    nombre:      str             = Field(..., max_length=120)
    categoria:   CategoriaEnum
    sla_horas:   int             = Field(0, ge=0)
    descripcion: Optional[str]   = Field(None, max_length=300)
    activo:      bool            = True

class TipoCreate(TipoBase):
    pass

class TipoUpdate(BaseModel):
    nombre:      Optional[str]           = Field(None, max_length=120)
    id_subarea:  Optional[int]           = None
    categoria:   Optional[CategoriaEnum] = None
    sla_horas:   Optional[int]           = Field(None, ge=0)
    descripcion: Optional[str]           = Field(None, max_length=300)
    activo:      Optional[bool]          = None

class TipoOut(TipoBase):
    id:           int
    area_nombre:  Optional[str] = None
    subarea_nombre: Optional[str] = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# INCIDENTE — Create
# ─────────────────────────────────────────────────────────────────────────────

class IncidenteCreate(BaseModel):
    id_persona:          int   = Field(..., description="FK → persona.id (BUP)")
    id_tipo:             int   = Field(..., description="FK → crm_tipo_incidente.id")
    id_canal_origen:     int   = Field(..., description="FK → crm_canal_origen.id")
    descripcion:         str   = Field(..., min_length=1)
    ubicacion_calle:     Optional[str] = Field(None, max_length=200)
    ubicacion_altura:    Optional[str] = Field(None, max_length=20)
    ubicacion_referencia: Optional[str] = None
    id_incidente_padre:  Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# INCIDENTE — Output (listado ligero)
# ─────────────────────────────────────────────────────────────────────────────

class IncidenteOut(BaseModel):
    """Proyección lista para la Bandeja de Incidentes."""
    id:                  int
    nro_referencia:      Optional[str]
    id_persona:          int
    ciudadano:           Optional[str]  = None   # apellido + nombre
    nro_doc:             Optional[str]  = None

    id_tipo:             int
    tipo_nombre:         Optional[str]  = None
    categoria:           Optional[CategoriaEnum] = None
    sla_horas:           Optional[int]  = None
    subarea_nombre:      Optional[str]  = None
    area_nombre:         Optional[str]  = None

    id_estado:           int
    estado_nombre:       Optional[EstadoIncidenteEnum] = None
    es_terminal:         Optional[bool] = None

    id_canal_origen:     int
    canal_nombre:        Optional[str]  = None

    descripcion:         str
    ubicacion_calle:     Optional[str]  = None
    ubicacion_altura:    Optional[str]  = None
    id_incidente_padre:  Optional[int]  = None

    creador_nombre:      Optional[str]  = None
    asignado_nombre:     Optional[str]  = None

    fecha_limite_sla:    Optional[datetime] = None
    sla_status:          Optional[str]  = None   # EN_TIEMPO | POR_VENCER | VENCIDO | None

    created_at:          datetime
    updated_at:          datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# INCIDENTE — Detalle completo (incluye OTs + historia)
# ─────────────────────────────────────────────────────────────────────────────

class IncidenteDetalle(IncidenteOut):
    observaciones:   List["ObservacionOut"]  = []
    ordenes_trabajo: List["OrdenTrabajoOut"] = []


# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO DE ESTADO
# ─────────────────────────────────────────────────────────────────────────────

class CambioEstadoIn(BaseModel):
    nuevo_estado: EstadoIncidenteEnum
    motivo:       str = Field(..., min_length=5, description="Observación obligatoria")


# ─────────────────────────────────────────────────────────────────────────────
# OBSERVACIÓN (bitácora inmutable)
# ─────────────────────────────────────────────────────────────────────────────

class ObservacionOut(BaseModel):
    id:               int
    id_incidente:     int
    id_usuario:       int
    usuario_nombre:   Optional[str]              = None
    tipo:             str                        # NOTA, CAMBIO_ESTADO, …
    texto:            str
    estado_anterior:  Optional[int]              = None
    estado_nuevo:     Optional[int]              = None
    est_anterior_nombre: Optional[EstadoIncidenteEnum] = None
    est_nuevo_nombre:    Optional[EstadoIncidenteEnum] = None
    created_at:       datetime

    model_config = {"from_attributes": True}


class NotaCreate(BaseModel):
    texto: str = Field(..., min_length=1, description="Nota interna del ticket")


# ─────────────────────────────────────────────────────────────────────────────
# ORDEN DE TRABAJO
# ─────────────────────────────────────────────────────────────────────────────

class OrdenTrabajoCreate(BaseModel):
    id_incidente: int
    id_subarea:   int  = Field(..., description="Sub-área de gestión operativa")
    id_usuario:   int  = Field(..., description="Agente GS asignado (usuario.id)")
    descripcion:  Optional[str] = None


class OrdenTrabajoOut(BaseModel):
    id:               int
    id_incidente:     int
    nro_referencia:   Optional[str]  = None   # del incidente
    id_subarea:       int
    subarea_nombre:   Optional[str]  = None
    area_nombre:      Optional[str]  = None
    id_usuario:       Optional[int]  = None
    agente_nombre:    Optional[str]  = None
    estado:           EstadoOTEnum
    descripcion:      Optional[str]  = None
    fecha_asignacion: Optional[datetime] = None
    fecha_cierre:     Optional[datetime] = None
    created_at:       datetime

    model_config = {"from_attributes": True}


class OrdenTrabajoCompletar(BaseModel):
    """Body para completar una OT (campos opcionales de cierre)."""
    observaciones: Optional[str] = None


class OrdenTrabajoCancelar(BaseModel):
    motivo: str = Field(..., min_length=5, description="Motivo de cancelación obligatorio")


# ─────────────────────────────────────────────────────────────────────────────
# AGENTES (canal y sub-área)
# ─────────────────────────────────────────────────────────────────────────────

class AgenteCanalCreate(BaseModel):
    id_usuario: int
    id_canal:   int
    activo:     bool = True

class AgenteCanalOut(AgenteCanalCreate):
    id:           int
    canal_nombre: Optional[str] = None
    model_config = {"from_attributes": True}


class AgenteSubareaCreate(BaseModel):
    id_usuario: int
    id_subarea: int
    activo:     bool = True

class AgenteSubareaOut(AgenteSubareaCreate):
    id:             int
    subarea_nombre: Optional[str] = None
    area_nombre:    Optional[str] = None
    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# TABLERO / KPIs
# ─────────────────────────────────────────────────────────────────────────────

class KpiRow(BaseModel):
    """Fila de la vista v_crm_tablero (agrupación área/estado/categoría)."""
    area:        str
    estado:      str
    categoria:   CategoriaEnum
    total:       int
    sla_vencidos: int

    model_config = {"from_attributes": True}


class KpiResumen(BaseModel):
    """Tarjetas KPI para la cabecera del tablero."""
    total_abiertos:   int
    sin_asignar:      int
    sla_vencidos:     int
    resueltos_hoy:    int

# ─────────────────────────────────────────────────────────────────────────────
# Actualización de referencias forward
# ─────────────────────────────────────────────────────────────────────────────
AreaConSubareas.model_rebuild()
IncidenteDetalle.model_rebuild()
