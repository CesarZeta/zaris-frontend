"""
ZARIS API — Modelos ORM del módulo Reclamos.
Tablas de referencia: área, subárea y tipo de reclamo.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReclamosArea(Base):
    __tablename__ = "reclamos_area"

    id_area = Column(Integer, primary_key=True)
    nombre  = Column(String(100), nullable=False)
    activo  = Column(Boolean, nullable=False, default=True)

    subareas = relationship("ReclamosSubarea", back_populates="area")


class ReclamosSubarea(Base):
    __tablename__ = "reclamos_subarea"

    id_subarea = Column(Integer, primary_key=True)
    nombre     = Column(String(150), nullable=False)
    id_area    = Column(Integer, ForeignKey("reclamos_area.id_area"), nullable=False)
    activo     = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_reclamos_subarea_area", "id_area"),
    )

    area  = relationship("ReclamosArea", back_populates="subareas")
    tipos = relationship("ReclamosTipo", back_populates="subarea")


class ReclamosTipo(Base):
    __tablename__ = "reclamos_tipo"

    id_tipo    = Column(Integer, primary_key=True)
    nombre     = Column(String(200), nullable=False)
    id_subarea = Column(Integer, ForeignKey("reclamos_subarea.id_subarea"), nullable=False)
    activo     = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_reclamos_tipo_subarea", "id_subarea"),
    )

    subarea = relationship("ReclamosSubarea", back_populates="tipos")
