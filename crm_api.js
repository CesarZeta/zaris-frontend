'use strict';
// ============================================================
// crm_api.js — Capa de comunicación con el backend ZARIS
// Reemplaza Store/MaquinaEstados por fetch() reales
// ============================================================

const API_BASE = 'https://zaris-api-production-bf0b.up.railway.app/api';

// ── Token ────────────────────────────────────────────────────
function apiToken() {
  try {
    const s = JSON.parse(localStorage.getItem('zaris_session'));
    return s?.access_token || null;
  } catch { return null; }
}

// ── Helpers fetch ────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(API_BASE + path, {
    headers: { Authorization: 'Bearer ' + apiToken() }
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiToken() },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  return r.json();
}

async function apiPatch(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiToken() },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText);
  return r.json();
}

// ── Cache de maestros (cargado una vez al inicio) ─────────────
const _cache = { areas: [], subareas: [], tipos: [], canales: [], estados: [], agentesSubarea: [] };

async function cargarMaestros() {
  const [areas, canales, estados, agSub] = await Promise.all([
    apiGet('/crm/areas'),
    apiGet('/crm/canales'),
    apiGet('/crm/estados'),
    apiGet('/crm/agentes/subareas'),
  ]);
  _cache.areas      = areas;
  _cache.subareas   = areas.flatMap(a => (a.subareas || []).map(s => ({ ...s, area_nombre: a.nombre })));
  _cache.tipos      = [];  // se cargan por sub-área bajo demanda
  _cache.canales    = canales;
  _cache.estados    = estados;
  _cache.agentesSubarea = agSub;
}

// ── Incidentes ────────────────────────────────────────────────
const ApiInc = {
  lista: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    return apiGet('/crm/incidentes' + (q.toString() ? '?' + q : ''));
  },
  detalle:      id       => apiGet(`/crm/incidentes/${id}`),
  crear:        body     => apiPost('/crm/incidentes', body),
  cambiarEstado:(id, b)  => apiPost(`/crm/incidentes/${id}/cambiar-estado`, b),
  nota:         (id, t)  => apiPost(`/crm/incidentes/${id}/notas`, { texto: t }),
};

// ── Órdenes de Trabajo ────────────────────────────────────────
const ApiOT = {
  lista:     (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    return apiGet('/crm/ordenes-trabajo' + (q.toString() ? '?' + q : ''));
  },
  crear:     body  => apiPost('/crm/ordenes-trabajo', body),
  completar: (id, obs) => apiPost(`/crm/ordenes-trabajo/${id}/completar`, { observaciones: obs }),
  cancelar:  (id, m)   => apiPost(`/crm/ordenes-trabajo/${id}/cancelar`, { motivo: m }),
};

// ── Tablero ───────────────────────────────────────────────────
const ApiTablero = {
  resumen: () => apiGet('/crm/tablero/resumen'),
  filas:   () => apiGet('/crm/tablero'),
};

// ── Maestros ABM ──────────────────────────────────────────────
const ApiMaestros = {
  crearArea:    b     => apiPost('/crm/areas', b),
  editarArea:   (id,b)=> apiPatch(`/crm/areas/${id}`, b),
  crearSubarea: b     => apiPost('/crm/subareas', b),
  crearTipo:    b     => apiPost('/crm/tipos', b),
  editarTipo:   (id,b)=> apiPatch(`/crm/tipos/${id}`, b),
  crearCanal:   b     => apiPost('/crm/canales', b),
  editarCanal:  (id,b)=> apiPatch(`/crm/canales/${id}`, b),
  tiposPorSubarea: sid => apiGet(`/crm/tipos?subarea_id=${sid}`),
};

// ── BUP Personas (reutiliza el endpoint existente) ──────────────
const ApiBup = {
  buscarDoc:      (tipo, nro, sexo) => apiGet(`/personas/buscar?tipo_doc=${tipo}&nro_doc=${nro}&sexo=${sexo}`).catch(() => null),
  buscarApellido: ap                => apiGet(`/personas/buscar?apellido=${encodeURIComponent(ap)}`).catch(() => []),
  crear:          body              => apiPost('/personas', body),
};
