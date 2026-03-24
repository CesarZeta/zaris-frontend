# =============================================================
# ZARIS v2.0 — CRM API Routes
# Prefijo: /api/crm
# =============================================================

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, text, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.usuarios import Usuario
from app.models.crm import (
    CrmEstado, CrmCanalOrigen, CrmArea, CrmSubarea, CrmTipoIncidente,
    CrmIncidente, CrmObservacion, CrmOrdenTrabajo,
    CrmAgenteCanal, CrmAgenteSubarea,
    EstadoIncidenteEnum, EstadoOTEnum,
)
from app.schemas.crm import (
    # Maestros
    EstadoOut,
    CanalCreate, CanalUpdate, CanalOut,
    AreaCreate, AreaUpdate, AreaOut, AreaConSubareas,
    SubareaCreate, SubareaUpdate, SubareaOut,
    TipoCreate, TipoUpdate, TipoOut,
    # Incidente
    IncidenteCreate, IncidenteOut, IncidenteDetalle, CambioEstadoIn,
    # Observaciones / notas
    ObservacionOut, NotaCreate,
    # OT
    OrdenTrabajoCreate, OrdenTrabajoOut,
    OrdenTrabajoCompletar, OrdenTrabajoCancelar,
    # Agentes
    AgenteCanalCreate, AgenteCanalOut,
    AgenteSubareaCreate, AgenteSubareaOut,
    # KPIs
    KpiRow, KpiResumen,
)

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS INTERNOS
# ──────────────────────────────────────────────────────────────────────────────

def _nro_ref(id_: int, year: int | None = None) -> str:
    y = year or datetime.now(timezone.utc).year
    return f"INC-{y}-{str(id_).zfill(6)}"


def _sla_status(inc: CrmIncidente, es_terminal: bool) -> Optional[str]:
    if not inc.fecha_limite_sla:
        return None
    if es_terminal:
        return None
    now = datetime.now(timezone.utc)
    lim = inc.fecha_limite_sla.replace(tzinfo=timezone.utc) if inc.fecha_limite_sla.tzinfo is None else inc.fecha_limite_sla
    if now > lim:
        return "VENCIDO"
    from datetime import timedelta
    if now > lim - timedelta(hours=4):
        return "POR_VENCER"
    return "EN_TIEMPO"


def _map_incidente(inc: CrmIncidente) -> dict:
    """Transforma un ORM object al dict que espera IncidenteOut."""
    est      = inc.estado
    tipo     = inc.tipo
    subarea  = tipo.subarea if tipo else None
    area     = subarea.area if subarea else None
    persona  = getattr(inc, "_persona", None)   # se carga aparte en queries complejas
    creador  = inc.creador
    asignado = inc.asignado

    return dict(
        id                  = inc.id,
        nro_referencia      = inc.nro_referencia or _nro_ref(inc.id),
        id_persona          = inc.id_persona,
        ciudadano           = f"{persona.apellido}, {persona.nombre}" if persona else None,
        nro_doc             = f"{persona.tipo_doc} {persona.nro_doc}" if persona else None,
        id_tipo             = inc.id_tipo,
        tipo_nombre         = tipo.nombre if tipo else None,
        categoria           = tipo.categoria if tipo else None,
        sla_horas           = tipo.sla_horas if tipo else None,
        subarea_nombre      = subarea.nombre if subarea else None,
        area_nombre         = area.nombre if area else None,
        id_estado           = inc.id_estado,
        estado_nombre       = est.nombre if est else None,
        es_terminal         = est.es_terminal if est else False,
        id_canal_origen     = inc.id_canal_origen,
        canal_nombre        = inc.canal_origen.nombre if inc.canal_origen else None,
        descripcion         = inc.descripcion,
        ubicacion_calle     = inc.ubicacion_calle,
        ubicacion_altura    = inc.ubicacion_altura,
        id_incidente_padre  = inc.id_incidente_padre,
        creador_nombre      = f"{creador.apellido}, {creador.nombre}" if creador else None,
        asignado_nombre     = f"{asignado.apellido}, {asignado.nombre}" if asignado else None,
        fecha_limite_sla    = inc.fecha_limite_sla,
        sla_status          = _sla_status(inc, est.es_terminal if est else False),
        created_at          = inc.created_at,
        updated_at          = inc.updated_at,
    )


def _nombre_usuario(u: Optional[Usuario]) -> Optional[str]:
    return f"{u.apellido}, {u.nombre}" if u else None


# ──────────────────────────────────────────────────────────────────────────────
# ESTADOS (sólo lectura — se gestionan por SQL)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/estados", response_model=List[EstadoOut], tags=["CRM – Maestros"])
async def listar_estados(db: AsyncSession = Depends(get_db)):
    """Lista el catálogo de estados de incidente."""
    result = await db.execute(select(CrmEstado).order_by(CrmEstado.id))
    return result.scalars().all()


# ──────────────────────────────────────────────────────────────────────────────
# CANALES DE ORIGEN
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/canales", response_model=List[CanalOut], tags=["CRM – Maestros"])
async def listar_canales(
    solo_activos: bool = True,
    db: AsyncSession = Depends(get_db)
):
    q = select(CrmCanalOrigen)
    if solo_activos:
        q = q.where(CrmCanalOrigen.activo.is_(True))
    result = await db.execute(q.order_by(CrmCanalOrigen.nombre))
    return result.scalars().all()


@router.post("/canales", response_model=CanalOut, status_code=201, tags=["CRM – Maestros"])
async def crear_canal(
    body: CanalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    canal = CrmCanalOrigen(**body.model_dump())
    db.add(canal)
    await db.commit()
    await db.refresh(canal)
    return canal


@router.patch("/canales/{canal_id}", response_model=CanalOut, tags=["CRM – Maestros"])
async def actualizar_canal(
    canal_id: int,
    body: CanalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    canal = await db.get(CrmCanalOrigen, canal_id)
    if not canal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Canal no encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(canal, k, v)
    await db.commit()
    await db.refresh(canal)
    return canal


# ──────────────────────────────────────────────────────────────────────────────
# ÁREAS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/areas", response_model=List[AreaConSubareas], tags=["CRM – Maestros"])
async def listar_areas(
    solo_activas: bool = True,
    db: AsyncSession = Depends(get_db)
):
    q = select(CrmArea).options(selectinload(CrmArea.subareas))
    if solo_activas:
        q = q.where(CrmArea.activo.is_(True))
    result = await db.execute(q.order_by(CrmArea.nombre))
    return result.scalars().all()


@router.post("/areas", response_model=AreaOut, status_code=201, tags=["CRM – Maestros"])
async def crear_area(
    body: AreaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    area = CrmArea(**body.model_dump())
    db.add(area)
    await db.commit()
    await db.refresh(area)
    return area


@router.patch("/areas/{area_id}", response_model=AreaOut, tags=["CRM – Maestros"])
async def actualizar_area(
    area_id: int,
    body: AreaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    area = await db.get(CrmArea, area_id)
    if not area:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Área no encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(area, k, v)
    await db.commit()
    await db.refresh(area)
    return area


# ──────────────────────────────────────────────────────────────────────────────
# SUB-ÁREAS
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/subareas", response_model=List[SubareaOut], tags=["CRM – Maestros"])
async def listar_subareas(
    area_id: Optional[int] = None,
    solo_activas: bool = True,
    db: AsyncSession = Depends(get_db)
):
    q = select(CrmSubarea)
    if area_id:
        q = q.where(CrmSubarea.id_area == area_id)
    if solo_activas:
        q = q.where(CrmSubarea.activo.is_(True))
    result = await db.execute(q.order_by(CrmSubarea.nombre))
    return result.scalars().all()


@router.post("/subareas", response_model=SubareaOut, status_code=201, tags=["CRM – Maestros"])
async def crear_subarea(
    body: SubareaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    subarea = CrmSubarea(**body.model_dump())
    db.add(subarea)
    await db.commit()
    await db.refresh(subarea)
    return subarea


@router.patch("/subareas/{sub_id}", response_model=SubareaOut, tags=["CRM – Maestros"])
async def actualizar_subarea(
    sub_id: int,
    body: SubareaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    sub = await db.get(CrmSubarea, sub_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sub-área no encontrada")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sub, k, v)
    await db.commit()
    await db.refresh(sub)
    return sub


# ──────────────────────────────────────────────────────────────────────────────
# TIPOS DE INCIDENTE
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/tipos", response_model=List[TipoOut], tags=["CRM – Maestros"])
async def listar_tipos(
    subarea_id: Optional[int] = None,
    categoria: Optional[str]  = None,
    solo_activos: bool         = True,
    db: AsyncSession = Depends(get_db)
):
    q = (
        select(CrmTipoIncidente)
        .options(joinedload(CrmTipoIncidente.subarea).joinedload(CrmSubarea.area))
    )
    if subarea_id:
        q = q.where(CrmTipoIncidente.id_subarea == subarea_id)
    if categoria:
        q = q.where(CrmTipoIncidente.categoria == categoria.upper())
    if solo_activos:
        q = q.where(CrmTipoIncidente.activo.is_(True))
    result = await db.execute(q.order_by(CrmTipoIncidente.nombre))
    tipos = result.scalars().all()
    out = []
    for t in tipos:
        d = dict(
            id=t.id, id_subarea=t.id_subarea, nombre=t.nombre,
            categoria=t.categoria, sla_horas=t.sla_horas,
            descripcion=t.descripcion, activo=t.activo,
            subarea_nombre=t.subarea.nombre if t.subarea else None,
            area_nombre=t.subarea.area.nombre if (t.subarea and t.subarea.area) else None,
        )
        out.append(TipoOut(**d))
    return out


@router.post("/tipos", response_model=TipoOut, status_code=201, tags=["CRM – Maestros"])
async def crear_tipo(
    body: TipoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tipo = CrmTipoIncidente(**body.model_dump())
    db.add(tipo)
    await db.commit()
    await db.refresh(tipo)
    return TipoOut(
        id=tipo.id, id_subarea=tipo.id_subarea, nombre=tipo.nombre,
        categoria=tipo.categoria, sla_horas=tipo.sla_horas,
        descripcion=tipo.descripcion, activo=tipo.activo,
    )


@router.patch("/tipos/{tipo_id}", response_model=TipoOut, tags=["CRM – Maestros"])
async def actualizar_tipo(
    tipo_id: int,
    body: TipoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    tipo = await db.get(CrmTipoIncidente, tipo_id)
    if not tipo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tipo no encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(tipo, k, v)
    await db.commit()
    await db.refresh(tipo)
    return TipoOut(
        id=tipo.id, id_subarea=tipo.id_subarea, nombre=tipo.nombre,
        categoria=tipo.categoria, sla_horas=tipo.sla_horas,
        descripcion=tipo.descripcion, activo=tipo.activo,
    )


# ──────────────────────────────────────────────────────────────────────────────
# INCIDENTES — BANDEJA
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/incidentes", response_model=List[IncidenteOut], tags=["CRM – Incidentes"])
async def listar_incidentes(
    estado_id:  Optional[int] = Query(None, description="FK crm_estado.id"),
    categoria:  Optional[str] = Query(None, description="RECLAMO | CONSULTA"),
    area_id:    Optional[int] = Query(None),
    desde:      Optional[str] = Query(None, description="YYYY-MM-DD"),
    hasta:      Optional[str] = Query(None, description="YYYY-MM-DD"),
    buscar:     Optional[str] = Query(None, description="Referencia, DNI o nombre"),
    limit:      int           = Query(200, le=500),
    offset:     int           = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    q = (
        select(CrmIncidente)
        .options(
            joinedload(CrmIncidente.estado),
            joinedload(CrmIncidente.canal_origen),
            joinedload(CrmIncidente.creador),
            joinedload(CrmIncidente.asignado),
            joinedload(CrmIncidente.tipo).joinedload(CrmTipoIncidente.subarea)
                .joinedload(CrmSubarea.area),
        )
        .order_by(CrmIncidente.created_at.desc())
        .limit(limit).offset(offset)
    )
    if estado_id is not None:
        q = q.where(CrmIncidente.id_estado == estado_id)
    if categoria:
        q = q.join(CrmTipoIncidente).where(
            CrmTipoIncidente.categoria == categoria.upper()
        )
    if area_id:
        q = q.join(CrmTipoIncidente).join(CrmSubarea).where(
            CrmSubarea.id_area == area_id
        )
    if desde:
        q = q.where(CrmIncidente.created_at >= desde)
    if hasta:
        q = q.where(CrmIncidente.created_at <= f"{hasta}T23:59:59+00:00")
    if buscar:
        q = q.where(or_(
            CrmIncidente.nro_referencia.ilike(f"%{buscar}%"),
            CrmIncidente.descripcion.ilike(f"%{buscar}%"),
        ))

    result = await db.execute(q)
    incs = result.scalars().all()
    return [IncidenteOut(**_map_incidente(i)) for i in incs]


# ──────────────────────────────────────────────────────────────────────────────
# INCIDENTES — CREAR
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/incidentes", response_model=IncidenteOut, status_code=201, tags=["CRM – Incidentes"])
async def crear_incidente(
    body: IncidenteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    # Validaciones básicas
    tipo = await db.get(CrmTipoIncidente, body.id_tipo)
    if not tipo or not tipo.activo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tipo de incidente inválido o inactivo")

    # Estado inicial = SIN_ASIGNAR (id 1)
    est_result = await db.execute(
        select(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.SIN_ASIGNAR)
    )
    estado_inicial = est_result.scalar_one_or_none()
    if not estado_inicial:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Estado inicial no configurado")

    # Calcular SLA
    from datetime import timedelta
    ahora = datetime.now(timezone.utc)
    sla = ahora + timedelta(hours=tipo.sla_horas) if tipo.sla_horas > 0 else None

    inc = CrmIncidente(
        **body.model_dump(),
        id_estado=estado_inicial.id,
        id_usuario_creador=current_user.id,
        fecha_limite_sla=sla,
    )
    db.add(inc)
    await db.flush()   # obtener ID para el trigger nro_referencia

    # El trigger BD genera nro_referencia; si no existe, lo generamos aquí como fallback
    if not inc.nro_referencia:
        inc.nro_referencia = _nro_ref(inc.id)

    # Observación de creación (inmutable)
    obs = CrmObservacion(
        id_incidente=inc.id,
        id_usuario=current_user.id,
        tipo="CREACION",
        texto=f"Incidente creado. Canal ID: {body.id_canal_origen}.",
        estado_nuevo=estado_inicial.id,
    )
    db.add(obs)

    # Si es hijo → bloquear padre (lo hace el trigger SQL también, pero cubrimos el frontend)
    if body.id_incidente_padre:
        padre = await db.get(CrmIncidente, body.id_incidente_padre)
        if padre:
            est_espera = await db.execute(
                select(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.EN_ESPERA_TERCEROS)
            )
            estado_espera = est_espera.scalar_one_or_none()
            if estado_espera:
                obs_padre = CrmObservacion(
                    id_incidente=padre.id,
                    id_usuario=current_user.id,
                    tipo="CAMBIO_ESTADO",
                    texto=f"Bloqueado: hijo {inc.nro_referencia} pendiente.",
                    estado_anterior=padre.id_estado,
                    estado_nuevo=estado_espera.id,
                )
                padre.id_estado = estado_espera.id
                db.add(obs_padre)

    await db.commit()
    await db.refresh(inc, ["estado", "tipo", "canal_origen", "creador", "asignado"])
    if inc.tipo:
        await db.refresh(inc.tipo, ["subarea"])
        if inc.tipo.subarea:
            await db.refresh(inc.tipo.subarea, ["area"])

    return IncidenteOut(**_map_incidente(inc))


# ──────────────────────────────────────────────────────────────────────────────
# INCIDENTE — DETALLE
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/incidentes/{inc_id}", response_model=IncidenteDetalle, tags=["CRM – Incidentes"])
async def detalle_incidente(
    inc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    result = await db.execute(
        select(CrmIncidente)
        .options(
            joinedload(CrmIncidente.estado),
            joinedload(CrmIncidente.canal_origen),
            joinedload(CrmIncidente.creador),
            joinedload(CrmIncidente.asignado),
            joinedload(CrmIncidente.tipo)
                .joinedload(CrmTipoIncidente.subarea)
                .joinedload(CrmSubarea.area),
            selectinload(CrmIncidente.observaciones)
                .joinedload(CrmObservacion.usuario),
            selectinload(CrmIncidente.ordenes_trabajo)
                .joinedload(CrmOrdenTrabajo.subarea),
            selectinload(CrmIncidente.ordenes_trabajo)
                .joinedload(CrmOrdenTrabajo.agente_gs),
        )
        .where(CrmIncidente.id == inc_id)
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incidente no encontrado")

    base    = _map_incidente(inc)
    obs_out = [
        ObservacionOut(
            id=o.id, id_incidente=o.id_incidente, id_usuario=o.id_usuario,
            usuario_nombre=_nombre_usuario(o.usuario),
            tipo=o.tipo, texto=o.texto,
            estado_anterior=o.estado_anterior, estado_nuevo=o.estado_nuevo,
            est_anterior_nombre=o.est_anterior_rel.nombre if o.est_anterior_rel else None,
            est_nuevo_nombre=o.est_nuevo_rel.nombre if o.est_nuevo_rel else None,
            created_at=o.created_at,
        )
        for o in inc.observaciones
    ]
    ots_out = [
        OrdenTrabajoOut(
            id=ot.id, id_incidente=ot.id_incidente,
            nro_referencia=inc.nro_referencia,
            id_subarea=ot.id_subarea,
            subarea_nombre=ot.subarea.nombre if ot.subarea else None,
            area_nombre=ot.subarea.area.nombre if (ot.subarea and ot.subarea.area) else None,
            id_usuario=ot.id_usuario,
            agente_nombre=_nombre_usuario(ot.agente_gs),
            estado=ot.estado,
            descripcion=ot.descripcion,
            fecha_asignacion=ot.fecha_asignacion,
            fecha_cierre=ot.fecha_cierre,
            created_at=ot.created_at,
        )
        for ot in inc.ordenes_trabajo
    ]
    return IncidenteDetalle(**base, observaciones=obs_out, ordenes_trabajo=ots_out)


# ──────────────────────────────────────────────────────────────────────────────
# INCIDENTE — CAMBIAR ESTADO
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/incidentes/{inc_id}/cambiar-estado",
    response_model=IncidenteOut,
    tags=["CRM – Incidentes"],
)
async def cambiar_estado(
    inc_id: int,
    body: CambioEstadoIn,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    inc = await db.get(
        CrmIncidente, inc_id,
        options=[joinedload(CrmIncidente.estado)]
    )
    if not inc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incidente no encontrado")

    if inc.estado and inc.estado.es_terminal:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"El incidente está en estado terminal ({inc.estado.nombre}) y no puede modificarse."
        )

    # Si cierra → verificar hijos pendientes
    terminales_cierre = {EstadoIncidenteEnum.RESUELTO, EstadoIncidenteEnum.CANCELADO}
    if body.nuevo_estado in terminales_cierre:
        hijos_q = await db.execute(
            select(CrmIncidente).join(CrmEstado).where(
                and_(
                    CrmIncidente.id_incidente_padre == inc_id,
                    CrmEstado.nombre != EstadoIncidenteEnum.RESUELTO,
                )
            )
        )
        hijos_pendientes = hijos_q.scalars().all()
        if hijos_pendientes:
            refs = ", ".join(h.nro_referencia or str(h.id) for h in hijos_pendientes)
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Tiene incidentes hijo sin resolver: {refs}. Resuélvalos primero."
            )

    # Obtener nuevo estado
    nuevo_est_q = await db.execute(
        select(CrmEstado).where(CrmEstado.nombre == body.nuevo_estado)
    )
    nuevo_est = nuevo_est_q.scalar_one_or_none()
    if not nuevo_est:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Estado inválido")

    estado_anterior = inc.id_estado
    inc.id_estado   = nuevo_est.id
    inc.updated_at  = datetime.now(timezone.utc)

    obs = CrmObservacion(
        id_incidente=inc.id,
        id_usuario=current_user.id,
        tipo="CAMBIO_ESTADO",
        texto=body.motivo,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_est.id,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(inc, ["estado", "tipo", "canal_origen", "creador", "asignado"])
    return IncidenteOut(**_map_incidente(inc))


# ──────────────────────────────────────────────────────────────────────────────
# INCIDENTE — AGREGAR NOTA
# ──────────────────────────────────────────────────────────────────────────────

@router.post(
    "/incidentes/{inc_id}/notas",
    response_model=ObservacionOut,
    status_code=201,
    tags=["CRM – Incidentes"],
)
async def agregar_nota(
    inc_id: int,
    body: NotaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    inc = await db.get(CrmIncidente, inc_id)
    if not inc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incidente no encontrado")
    obs = CrmObservacion(
        id_incidente=inc_id,
        id_usuario=current_user.id,
        tipo="NOTA",
        texto=body.texto,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs, ["usuario"])
    return ObservacionOut(
        id=obs.id, id_incidente=obs.id_incidente, id_usuario=obs.id_usuario,
        usuario_nombre=_nombre_usuario(obs.usuario),
        tipo=obs.tipo, texto=obs.texto,
        estado_anterior=None, estado_nuevo=None,
        created_at=obs.created_at,
    )


# ──────────────────────────────────────────────────────────────────────────────
# ÓRDENES DE TRABAJO
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/ordenes-trabajo", response_model=List[OrdenTrabajoOut], tags=["CRM – OT"])
async def listar_ots(
    estado: Optional[EstadoOTEnum] = None,
    subarea_id: Optional[int]      = None,
    agente_id:  Optional[int]      = None,
    desde:      Optional[str]      = None,
    hasta:      Optional[str]      = None,
    limit:      int                = Query(200, le=500),
    offset:     int                = 0,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    q = (
        select(CrmOrdenTrabajo)
        .options(
            joinedload(CrmOrdenTrabajo.incidente),
            joinedload(CrmOrdenTrabajo.subarea).joinedload(CrmSubarea.area),
            joinedload(CrmOrdenTrabajo.agente_gs),
        )
        .order_by(CrmOrdenTrabajo.created_at.desc())
        .limit(limit).offset(offset)
    )
    if estado:
        q = q.where(CrmOrdenTrabajo.estado == estado)
    if subarea_id:
        q = q.where(CrmOrdenTrabajo.id_subarea == subarea_id)
    if agente_id:
        q = q.where(CrmOrdenTrabajo.id_usuario == agente_id)
    if desde:
        q = q.where(CrmOrdenTrabajo.created_at >= desde)
    if hasta:
        q = q.where(CrmOrdenTrabajo.created_at <= f"{hasta}T23:59:59+00:00")

    result = await db.execute(q)
    ots    = result.scalars().all()
    return [
        OrdenTrabajoOut(
            id=ot.id, id_incidente=ot.id_incidente,
            nro_referencia=ot.incidente.nro_referencia if ot.incidente else None,
            id_subarea=ot.id_subarea,
            subarea_nombre=ot.subarea.nombre if ot.subarea else None,
            area_nombre=ot.subarea.area.nombre if (ot.subarea and ot.subarea.area) else None,
            id_usuario=ot.id_usuario,
            agente_nombre=_nombre_usuario(ot.agente_gs),
            estado=ot.estado,
            descripcion=ot.descripcion,
            fecha_asignacion=ot.fecha_asignacion,
            fecha_cierre=ot.fecha_cierre,
            created_at=ot.created_at,
        )
        for ot in ots
    ]


@router.post("/ordenes-trabajo", response_model=OrdenTrabajoOut, status_code=201, tags=["CRM – OT"])
async def crear_ot(
    body: OrdenTrabajoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    inc = await db.get(CrmIncidente, body.id_incidente,
                       options=[joinedload(CrmIncidente.estado),
                                joinedload(CrmIncidente.tipo)])
    if not inc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incidente no encontrado")
    if inc.estado and inc.estado.es_terminal:
        raise HTTPException(status.HTTP_409_CONFLICT, "El incidente está en estado terminal.")
    if inc.tipo and inc.tipo.categoria.value == "CONSULTA":
        raise HTTPException(status.HTTP_409_CONFLICT, "Las CONSULTAS no generan OT.")

    # Verificar OT activa
    ot_activa_q = await db.execute(
        select(CrmOrdenTrabajo).where(
            and_(CrmOrdenTrabajo.id_incidente == body.id_incidente,
                 CrmOrdenTrabajo.estado == EstadoOTEnum.EN_PROCESO)
        )
    )
    if ot_activa_q.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una OT activa para este incidente.")

    # Obtener estado EN_PROCESO
    en_proc_q = await db.execute(
        select(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.EN_PROCESO)
    )
    estado_en_proc = en_proc_q.scalar_one_or_none()

    ot = CrmOrdenTrabajo(
        id_incidente=body.id_incidente,
        id_subarea=body.id_subarea,
        id_usuario=body.id_usuario,
        descripcion=body.descripcion,
        estado=EstadoOTEnum.EN_PROCESO,
    )
    db.add(ot)
    await db.flush()

    # Avanzar incidente a EN_PROCESO
    estado_anterior = inc.id_estado
    if estado_en_proc:
        inc.id_estado  = estado_en_proc.id
        inc.updated_at = datetime.now(timezone.utc)
        obs = CrmObservacion(
            id_incidente=inc.id,
            id_usuario=current_user.id,
            tipo="OT_CREADA",
            texto=f"OT #{ot.id} creada. Técnico ID {body.id_usuario}. Estado → EN_PROCESO.",
            estado_anterior=estado_anterior,
            estado_nuevo=estado_en_proc.id,
        )
        db.add(obs)

    await db.commit()
    await db.refresh(ot, ["subarea", "agente_gs"])
    if ot.subarea:
        await db.refresh(ot.subarea, ["area"])

    return OrdenTrabajoOut(
        id=ot.id, id_incidente=ot.id_incidente,
        nro_referencia=inc.nro_referencia,
        id_subarea=ot.id_subarea,
        subarea_nombre=ot.subarea.nombre if ot.subarea else None,
        area_nombre=ot.subarea.area.nombre if (ot.subarea and ot.subarea.area) else None,
        id_usuario=ot.id_usuario,
        agente_nombre=_nombre_usuario(ot.agente_gs),
        estado=ot.estado,
        descripcion=ot.descripcion,
        fecha_asignacion=ot.fecha_asignacion,
        fecha_cierre=None,
        created_at=ot.created_at,
    )


@router.post("/ordenes-trabajo/{ot_id}/completar", response_model=OrdenTrabajoOut, tags=["CRM – OT"])
async def completar_ot(
    ot_id: int,
    body: OrdenTrabajoCompletar,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    ot = await db.get(CrmOrdenTrabajo, ot_id,
                      options=[joinedload(CrmOrdenTrabajo.incidente)
                                   .joinedload(CrmIncidente.estado)])
    if not ot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OT no encontrada")

    ahora = datetime.now(timezone.utc)
    ot.estado       = EstadoOTEnum.COMPLETADA
    ot.fecha_cierre = ahora
    ot.observaciones = body.observaciones
    ot.updated_at   = ahora

    inc = ot.incidente
    if inc and inc.estado and not inc.estado.es_terminal:
        res_q = await db.execute(
            select(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.RESUELTO)
        )
        estado_resuelto = res_q.scalar_one_or_none()
        if estado_resuelto:
            est_ant = inc.id_estado
            inc.id_estado  = estado_resuelto.id
            inc.updated_at = ahora
            obs = CrmObservacion(
                id_incidente=inc.id,
                id_usuario=current_user.id,
                tipo="OT_COMPLETADA",
                texto=f"OT #{ot_id} completada. Incidente → RESUELTO.",
                estado_anterior=est_ant,
                estado_nuevo=estado_resuelto.id,
            )
            db.add(obs)

    await db.commit()
    await db.refresh(ot, ["subarea", "agente_gs"])
    return OrdenTrabajoOut(
        id=ot.id, id_incidente=ot.id_incidente,
        id_subarea=ot.id_subarea,
        id_usuario=ot.id_usuario,
        agente_nombre=_nombre_usuario(ot.agente_gs),
        estado=ot.estado,
        descripcion=ot.descripcion,
        fecha_asignacion=ot.fecha_asignacion,
        fecha_cierre=ot.fecha_cierre,
        created_at=ot.created_at,
    )


@router.post("/ordenes-trabajo/{ot_id}/cancelar", response_model=OrdenTrabajoOut, tags=["CRM – OT"])
async def cancelar_ot(
    ot_id: int,
    body: OrdenTrabajoCancelar,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    ot = await db.get(CrmOrdenTrabajo, ot_id,
                      options=[joinedload(CrmOrdenTrabajo.incidente)
                                   .joinedload(CrmIncidente.estado)])
    if not ot:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OT no encontrada")

    ahora = datetime.now(timezone.utc)
    ot.estado       = EstadoOTEnum.CANCELADA
    ot.observaciones = body.motivo
    ot.fecha_cierre = ahora
    ot.updated_at   = ahora

    inc = ot.incidente
    if inc and inc.estado and not inc.estado.es_terminal:
        sin_asig_q = await db.execute(
            select(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.SIN_ASIGNAR)
        )
        estado_sin = sin_asig_q.scalar_one_or_none()
        if estado_sin:
            est_ant       = inc.id_estado
            inc.id_estado = estado_sin.id
            inc.updated_at = ahora
            obs = CrmObservacion(
                id_incidente=inc.id,
                id_usuario=current_user.id,
                tipo="OT_CANCELADA",
                texto=f"OT #{ot_id} cancelada: {body.motivo}. Incidente → SIN_ASIGNAR.",
                estado_anterior=est_ant,
                estado_nuevo=estado_sin.id,
            )
            db.add(obs)

    await db.commit()
    await db.refresh(ot, ["subarea", "agente_gs"])
    return OrdenTrabajoOut(
        id=ot.id, id_incidente=ot.id_incidente,
        id_subarea=ot.id_subarea,
        id_usuario=ot.id_usuario,
        agente_nombre=_nombre_usuario(ot.agente_gs),
        estado=ot.estado, descripcion=ot.descripcion,
        fecha_asignacion=ot.fecha_asignacion,
        fecha_cierre=ot.fecha_cierre,
        created_at=ot.created_at,
    )


# ──────────────────────────────────────────────────────────────────────────────
# AGENTES
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/agentes/canales", response_model=List[AgenteCanalOut], tags=["CRM – Agentes"])
async def listar_agentes_canal(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CrmAgenteCanal)
        .options(joinedload(CrmAgenteCanal.canal))
        .where(CrmAgenteCanal.activo.is_(True))
    )
    return result.scalars().all()


@router.post("/agentes/canales", response_model=AgenteCanalOut, status_code=201, tags=["CRM – Agentes"])
async def crear_agente_canal(
    body: AgenteCanalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    ag = CrmAgenteCanal(**body.model_dump())
    db.add(ag)
    await db.commit()
    await db.refresh(ag, ["canal"])
    return AgenteCanalOut(
        id=ag.id, id_usuario=ag.id_usuario, id_canal=ag.id_canal, activo=ag.activo,
        canal_nombre=ag.canal.nombre if ag.canal else None,
    )


@router.get("/agentes/subareas", response_model=List[AgenteSubareaOut], tags=["CRM – Agentes"])
async def listar_agentes_subarea(
    subarea_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(CrmAgenteSubarea)
        .options(joinedload(CrmAgenteSubarea.subarea).joinedload(CrmSubarea.area))
        .where(CrmAgenteSubarea.activo.is_(True))
    )
    if subarea_id:
        q = q.where(CrmAgenteSubarea.id_subarea == subarea_id)
    result = await db.execute(q)
    ags = result.scalars().all()
    return [
        AgenteSubareaOut(
            id=a.id, id_usuario=a.id_usuario, id_subarea=a.id_subarea, activo=a.activo,
            subarea_nombre=a.subarea.nombre if a.subarea else None,
            area_nombre=a.subarea.area.nombre if (a.subarea and a.subarea.area) else None,
        )
        for a in ags
    ]


@router.post("/agentes/subareas", response_model=AgenteSubareaOut, status_code=201, tags=["CRM – Agentes"])
async def crear_agente_subarea(
    body: AgenteSubareaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    ag = CrmAgenteSubarea(**body.model_dump())
    db.add(ag)
    await db.commit()
    await db.refresh(ag, ["subarea"])
    if ag.subarea:
        await db.refresh(ag.subarea, ["area"])
    return AgenteSubareaOut(
        id=ag.id, id_usuario=ag.id_usuario, id_subarea=ag.id_subarea, activo=ag.activo,
        subarea_nombre=ag.subarea.nombre if ag.subarea else None,
        area_nombre=ag.subarea.area.nombre if (ag.subarea and ag.subarea.area) else None,
    )


# ──────────────────────────────────────────────────────────────────────────────
# TABLERO / KPIs
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/tablero", response_model=List[KpiRow], tags=["CRM – Tablero"])
async def tablero_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Equivale a la vista v_crm_tablero del schema SQL."""
    result = await db.execute(text("SELECT * FROM v_crm_tablero ORDER BY area, estado"))
    rows = result.mappings().all()
    return [KpiRow(**r) for r in rows]


@router.get("/tablero/resumen", response_model=KpiResumen, tags=["CRM – Tablero"])
async def tablero_resumen(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Tarjetas KPI: abiertos, sin asignar, SLA vencidos, resueltos hoy."""
    now     = datetime.now(timezone.utc)
    hoy_str = now.date().isoformat()

    total_q = await db.execute(
        select(func.count()).select_from(CrmIncidente)
        .join(CrmEstado).where(CrmEstado.es_terminal.is_(False))
    )
    sin_asig_q = await db.execute(
        select(func.count()).select_from(CrmIncidente)
        .join(CrmEstado).where(CrmEstado.nombre == EstadoIncidenteEnum.SIN_ASIGNAR)
    )
    vencidos_q = await db.execute(
        select(func.count()).select_from(CrmIncidente)
        .join(CrmEstado).where(
            and_(CrmEstado.es_terminal.is_(False),
                 CrmIncidente.fecha_limite_sla < now)
        )
    )
    resueltos_q = await db.execute(
        select(func.count()).select_from(CrmIncidente)
        .join(CrmEstado).where(
            and_(CrmEstado.nombre == EstadoIncidenteEnum.RESUELTO,
                 CrmIncidente.updated_at >= hoy_str)
        )
    )
    return KpiResumen(
        total_abiertos=total_q.scalar() or 0,
        sin_asignar=sin_asig_q.scalar() or 0,
        sla_vencidos=vencidos_q.scalar() or 0,
        resueltos_hoy=resueltos_q.scalar() or 0,
    )
