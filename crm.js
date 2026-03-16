'use strict';
// ============================================================
// crm.js — ZARIS Módulo CRM  (Parte 1/4: Auth, Store, Demo)
// ============================================================

// ── Auth ─────────────────────────────────────────────────────
const Auth = (() => {
  const KEY = 'bds_usuario';
  const g = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const s = u => localStorage.setItem(KEY, JSON.stringify(u));
  const clr = () => { localStorage.removeItem(KEY); localStorage.removeItem('zaris_session'); };
  const ini = n => n.trim().split(/\s+/).map(p => p[0].toUpperCase()).slice(0, 2).join('');
  // Login delegado a home.html (que usa fetch a FastAPI)
  const login = () => { console.warn("Usar home.html para login."); return null; };
  return {
    get: g, set: s, clear: clr, ini, login,
    esAdmin: () => g()?.rol === 'ADMINISTRADOR',
    esColab: () => ['ADMINISTRADOR', 'COLABORADOR'].includes(g()?.rol),
  };
})();

// ── Store ─────────────────────────────────────────────────────
const Store = (() => {
  const K = {
    areas: 'crm_areas', subareas: 'crm_subareas', tipos: 'crm_tipos',
    canales: 'crm_canales', incidentes: 'crm_incidentes', ots: 'crm_ots',
    observaciones: 'crm_observaciones', personas: 'bds_personas',
    areasG: 'crm_areas_gestion', subareasG: 'crm_subareas_gestion',
    tecnicos: 'crm_usuarios_gestion', estadosInc: 'crm_estados_incidente',
  };
  const g = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const nid = k => { const ids = g(k).map(x => x.id || 0); return ids.length ? Math.max(...ids) + 1 : 1; };
  const upsert = (k, item) => {
    const lista = g(k);
    const idx = lista.findIndex(x => x.id === item.id);
    if (idx >= 0) lista[idx] = item; else lista.push(item);
    sv(k, lista); return item;
  };
  return {
    areas: () => g(K.areas), subareas: () => g(K.subareas),
    tipos: () => g(K.tipos), canales: () => g(K.canales),
    incidentes: () => g(K.incidentes), ots: () => g(K.ots),
    obs: () => g(K.observaciones), personas: () => g(K.personas),
    areasG: () => g(K.areasG), subareasG: () => g(K.subareasG),
    tecnicos: () => g(K.tecnicos), estadosInc: () => g(K.estadosInc),
    saveArea: a => upsert(K.areas, { ...a, id: a.id || nid(K.areas) }),
    saveSubarea: s => upsert(K.subareas, { ...s, id: s.id || nid(K.subareas) }),
    saveTipo: t => upsert(K.tipos, { ...t, id: t.id || nid(K.tipos) }),
    saveCanal: c => upsert(K.canales, { ...c, id: c.id || nid(K.canales) }),
    saveInc: i => upsert(K.incidentes, { ...i, id: i.id || nid(K.incidentes) }),
    saveOT: o => upsert(K.ots, { ...o, id: o.id || nid(K.ots) }),
    addObs: o => upsert(K.observaciones, { ...o, id: nid(K.observaciones) }),
    savePersona: p => upsert(K.personas, { ...p, id: p.id || nid(K.personas) }),
    saveAreaG: a => upsert(K.areasG, { ...a, id: a.id || nid(K.areasG) }),
    saveSubareaG: s => upsert(K.subareasG, { ...s, id: s.id || nid(K.subareasG) }),
    saveTecnico: t => upsert(K.tecnicos, { ...t, id: t.id || nid(K.tecnicos) }),
    saveEstadoInc: e => upsert(K.estadosInc, { ...e, id: e.id }),
    findPersona: (tipo, nro, sexo) => g(K.personas).find(p => p.tipo_doc === tipo && String(p.nro_doc) === String(nro) && p.sexo === sexo) || null,
    findPersonasByApellido: (ap) => g(K.personas).filter(p => p.activo && (p.apellido || '').toLowerCase().includes(ap.toLowerCase())),
  };
})();

// ── Datos demo ────────────────────────────────────────────────
function cargarDemoData() {
  if (Store.areas().length) return;
  const now = new Date().toISOString();

  // Áreas
  const areas = [
    { nombre: 'Alumbrado Público', descripcion: 'Luminarias y semáforos', palabras_clave: 'lámpara,farol,luminaria,semáforo,luz,alumbrado', activo: true },
    { nombre: 'Higiene Urbana', descripcion: 'Residuos y limpieza', palabras_clave: 'basura,residuo,recolección,limpieza,basurero', activo: true },
    { nombre: 'Obras Viales', descripcion: 'Baches y pavimento', palabras_clave: 'bache,asfalto,pavimento,cordón,vereda,obra', activo: true },
    { nombre: 'Espacios Verdes', descripcion: 'Arbolado y parques', palabras_clave: 'árbol,poda,plaza,parque,verde,rama', activo: true },
    { nombre: 'Tránsito', descripcion: 'Señalización y accidentes', palabras_clave: 'tránsito,señal,accidente,velocidad', activo: true },
  ];
  const areaIds = {};
  areas.forEach(a => { const x = Store.saveArea({ ...a, created_at: now }); areaIds[a.nombre] = x.id; });

  // Sub-áreas
  const subs = [
    { area: 'Alumbrado Público', nombre: 'Luminarias' }, { area: 'Alumbrado Público', nombre: 'Semáforos' },
    { area: 'Higiene Urbana', nombre: 'Recolección Residuos' }, { area: 'Higiene Urbana', nombre: 'Limpieza de Calles' },
    { area: 'Obras Viales', nombre: 'Baches' }, { area: 'Obras Viales', nombre: 'Cordones y Veredas' },
    { area: 'Espacios Verdes', nombre: 'Poda' }, { area: 'Espacios Verdes', nombre: 'Plazas y Parques' },
    { area: 'Tránsito', nombre: 'Señalización' },
  ];
  const subIds = {};
  subs.forEach(s => { const x = Store.saveSubarea({ id_area: areaIds[s.area], nombre: s.nombre, activo: true, created_at: now }); subIds[s.area + '/' + s.nombre] = x.id; });

  // Tipos
  const tipos = [
    { sub: 'Alumbrado Público/Luminarias', nombre: 'Luminaria sin luz', categoria: 'RECLAMO', sla_horas: 48 },
    { sub: 'Alumbrado Público/Semáforos', nombre: 'Semáforo dañado', categoria: 'RECLAMO', sla_horas: 24 },
    { sub: 'Higiene Urbana/Recolección Residuos', nombre: 'Recolección no realizada', categoria: 'RECLAMO', sla_horas: 24 },
    { sub: 'Higiene Urbana/Limpieza de Calles', nombre: 'Calle sin limpiar', categoria: 'RECLAMO', sla_horas: 48 },
    { sub: 'Obras Viales/Baches', nombre: 'Bache en calzada', categoria: 'RECLAMO', sla_horas: 72 },
    { sub: 'Obras Viales/Cordones y Veredas', nombre: 'Vereda dañada', categoria: 'RECLAMO', sla_horas: 96 },
    { sub: 'Espacios Verdes/Poda', nombre: 'Poda de árbol necesaria', categoria: 'RECLAMO', sla_horas: 120 },
    { sub: 'Tránsito/Señalización', nombre: 'Señal dañada o faltante', categoria: 'RECLAMO', sla_horas: 48 },
    { sub: 'Alumbrado Público/Luminarias', nombre: 'Consulta horario servicio', categoria: 'CONSULTA', sla_horas: 0 },
    { sub: 'Higiene Urbana/Recolección Residuos', nombre: 'Consulta días recolección', categoria: 'CONSULTA', sla_horas: 0 },
  ];
  tipos.forEach(t => Store.saveTipo({ id_subarea: subIds[t.sub], nombre: t.nombre, categoria: t.categoria, sla_horas: t.sla_horas, activo: true, created_at: now }));

  // Canales
  ['Call Center', 'Web', 'Presencial', 'WhatsApp', 'Email'].forEach(n => Store.saveCanal({ nombre: n, activo: true, created_at: now }));

  // Demo: áreas de gestión
  if (!Store.areasG().length) {
    const aGItems = [
      { nombre: 'Alumbrado y Energía', descripcion: 'Luminarias, semáforos', activo: true, created_at: now },
      { nombre: 'Higiene Urbana', descripcion: 'Residuos, limpieza', activo: true, created_at: now },
      { nombre: 'Obras y Vialidad', descripcion: 'Baches, veredas, cordones', activo: true, created_at: now },
      { nombre: 'Espacios Verdes', descripcion: 'Poda, plazas', activo: true, created_at: now },
    ];
    aGItems.forEach(a => Store.saveAreaG(a));
    // Sub-áreas de gestión
    const agIds = Store.areasG();
    const sgItems = [
      { id_area_gestion: agIds[0].id, nombre: 'Cuadrilla Luminarias', activo: true, created_at: now },
      { id_area_gestion: agIds[0].id, nombre: 'Cuadrilla Semáforos', activo: true, created_at: now },
      { id_area_gestion: agIds[1].id, nombre: 'Recolección Norte', activo: true, created_at: now },
      { id_area_gestion: agIds[1].id, nombre: 'Limpieza Sur', activo: true, created_at: now },
      { id_area_gestion: agIds[2].id, nombre: 'Bacheo', activo: true, created_at: now },
      { id_area_gestion: agIds[3].id, nombre: 'Poda Arbolado', activo: true, created_at: now },
    ];
    sgItems.forEach(s => Store.saveSubareaG(s));
    // Técnicos de gestión
    const sgIds = Store.subareasG();
    [
      { nombre: 'Juan', apellido: 'García', email: 'jgarcia@muni.gob.ar', perfil: 'GESTION', id_subarea_gestion: sgIds[0].id, activo: true, created_at: now },
      { nombre: 'Ana', apellido: 'Rodríguez', email: 'arodriguez@muni.gob.ar', perfil: 'GESTION', id_subarea_gestion: sgIds[4].id, activo: true, created_at: now },
      { nombre: 'Pedro', apellido: 'López', email: 'plopez@muni.gob.ar', perfil: 'ADMINISTRACION', id_subarea_gestion: null, activo: true, created_at: now },
    ].forEach(t => Store.saveTecnico(t));
  }
  // Demo: estados de incidente
  if (!Store.estadosInc().length) {
    [
      { id: 'PENDIENTE', label: 'Pendiente', es_terminal: false, orden: 1 },
      { id: 'ASIGNADO', label: 'Asignado', es_terminal: false, orden: 2 },
      { id: 'CUMPLIDO', label: 'Cumplido', es_terminal: true, orden: 3 },
      { id: 'CANCELADO', label: 'Cancelado', es_terminal: true, orden: 4 },
      { id: 'EN_ESPERA_TERCEROS', label: 'En Espera de Terceros', es_terminal: false, orden: 5 },
    ].forEach(e => Store.saveEstadoInc(e));
  }

  // Incidentes demo
  const personas = Store.personas();
  if (!personas.length) return;
  const p0 = personas[0], p1 = personas[1] || personas[0];
  const u = Auth.get(); if (!u) return;
  const canal1 = Store.canales()[0]?.id || 1;
  const tipo1 = Store.tipos().find(t => t.categoria === 'RECLAMO')?.id;
  const tipo2 = Store.tipos().find(t => t.categoria === 'CONSULTA')?.id;
  if (!tipo1 || !tipo2) return;

  const hace48 = new Date(Date.now() - 48 * 3600000).toISOString();
  const hace2 = new Date(Date.now() - 2 * 3600000).toISOString();
  const sla48 = new Date(Date.now() + 0).toISOString();

  const inc1 = Store.saveInc({
    persona_id: p0.id, id_tipo: tipo1, id_canal: canal1, id_estado: 'PENDIENTE',
    descripcion: 'Hay una luminaria apagada en la esquina de Mitre y San Martín hace 3 días.',
    ubicacion_calle: 'Mitre', ubicacion_altura: '100',
    id_usuario_creador: u.email, fecha_limite_sla: sla48, created_at: hace48, updated_at: hace48
  });
  Store.addObs({
    id_incidente: inc1.id, usuario: u.email, tipo: 'CREACION',
    texto: 'Incidente creado. Ciudadano: ' + p0.apellido + ', ' + p0.nombre,
    estado_nuevo: 'PENDIENTE', created_at: hace48
  });
  if (tipo2) {
    const inc2 = Store.saveInc({
      persona_id: p1.id, id_tipo: tipo2, id_canal: canal1, id_estado: 'CUMPLIDO',
      descripcion: 'Consulta sobre horarios de recolección de residuos en zona norte.',
      id_usuario_creador: u.email, fecha_limite_sla: null, created_at: hace2, updated_at: hace2
    });
    Store.addObs({ id_incidente: inc2.id, usuario: u.email, tipo: 'CREACION', texto: 'Consulta registrada.', estado_nuevo: 'PENDIENTE', created_at: hace2 });
    Store.addObs({ id_incidente: inc2.id, usuario: u.email, tipo: 'CAMBIO_ESTADO', texto: 'Consulta respondida: horario Lun-Vie 6-12hs.', estado_anterior: 'PENDIENTE', estado_nuevo: 'CUMPLIDO', created_at: now });
  }
}

// ============================================================
// crm.js — Parte 2/4: Utils, Clasificador, MaquinaEstados, Login, Nav
// ============================================================

// ── Utilidades ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function nroRef(id) {
  return 'INC-' + new Date().getFullYear() + '-' + String(id).padStart(6, '0');
}
function showToast(msg, tipo = 'ok', dur = 4500) {
  const c = $('toastContainer'), t = document.createElement('div');
  t.className = `toast toast--${tipo}`; t.textContent = msg; c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 300); }, dur);
}

// ── Clasificador automático por palabras clave ───────────────
const Clasificador = {
  inferir(texto) {
    if (!texto) return null;
    const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const area of Store.areas().filter(a => a.activo && a.palabras_clave)) {
      const claves = area.palabras_clave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(',');
      if (claves.some(c => lower.includes(c.trim()))) return area;
    }
    return null;
  }
};

// ── Máquina de Estados ───────────────────────────────────────
const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', cls: 'est--sin-asignar', terminal: false, n: 1 },
  ASIGNADO: { label: 'Asignado', cls: 'est--en-proceso', terminal: false, n: 2 },
  CUMPLIDO: { label: 'Cumplido', cls: 'est--resuelto', terminal: true, n: 3 },
  CANCELADO: { label: 'Cancelado', cls: 'est--cancelado', terminal: true, n: 4 },
  EN_ESPERA_TERCEROS: { label: 'En Espera Terceros', cls: 'est--en-espera-terceros', terminal: false, n: 5 },
};
const ICONOS_TL = { CREACION: '🟢', CAMBIO_ESTADO: '🔵', OT_CREADA: '🟠', OT_COMPLETADA: '✅', OT_CANCELADA: '❌', NOTA: '⚫' };
const ICONOS_TL_CLS = { CREACION: 'tl-creacion', CAMBIO_ESTADO: 'tl-cambio-estado', OT_CREADA: 'tl-ot-creada', OT_COMPLETADA: 'tl-ot-completada', OT_CANCELADA: 'tl-ot-cancelada', NOTA: 'tl-nota' };

const MaquinaEstados = {
  esTerminal(estado) { return ESTADOS[estado]?.terminal || false; },
  puedeTransicionar(inc, nuevoEstado) {
    if (this.esTerminal(inc.id_estado)) return { ok: false, motivo: 'Estado terminal: el incidente no puede modificarse.' };
    if (nuevoEstado === 'CUMPLIDO' || nuevoEstado === 'CANCELADO') {
      const hijos = Store.incidentes().filter(i => i.id_incidente_padre === inc.id);
      const hijoPend = hijos.find(h => h.id_estado !== 'CUMPLIDO');
      if (hijoPend) return { ok: false, motivo: 'Tiene un incidente hijo (#' + nroRef(hijoPend.id) + ') sin resolver. Debe resolverlo primero.' };
    }
    return { ok: true };
  },
  cambiarEstado(incId, nuevoEstado, motivo, usuarioEmail) {
    const inc = Store.incidentes().find(i => i.id === incId);
    if (!inc) return { ok: false, motivo: 'Incidente no encontrado.' };
    const check = this.puedeTransicionar(inc, nuevoEstado);
    if (!check.ok) return check;
    const estadoAnterior = inc.id_estado;
    Store.saveInc({ ...inc, id_estado: nuevoEstado, updated_at: new Date().toISOString() });
    Store.addObs({ id_incidente: incId, usuario: usuarioEmail, tipo: 'CAMBIO_ESTADO', texto: motivo, estado_anterior: estadoAnterior, estado_nuevo: nuevoEstado, created_at: new Date().toISOString() });
    return { ok: true };
  },
  crearOT(incId, subAreaGestionId, tecnicoId, descripcion, usuarioEmail) {
    const inc = Store.incidentes().find(i => i.id === incId);
    if (!inc) return { ok: false, motivo: 'Incidente no encontrado.' };
    if (this.esTerminal(inc.id_estado)) return { ok: false, motivo: 'El incidente está en estado terminal (CUMPLIDO o CANCELADO).' };
    const tipo = Store.tipos().find(t => t.id === inc.id_tipo);
    if (tipo?.categoria === 'CONSULTA') return { ok: false, motivo: 'Las CONSULTAS no generan Órdenes de Trabajo.' };
    const otActiva = Store.ots().find(o => o.id_incidente === incId && o.estado === 'EN_PROCESO');
    if (otActiva) return { ok: false, motivo: 'Ya existe una OT activa (OT-' + String(otActiva.id).padStart(4, '0') + ') para este incidente.' };
    if (!tecnicoId) return { ok: false, motivo: 'Debe asignar un técnico de gestión.' };
    const now = new Date().toISOString();
    const ot = Store.saveOT({ id_incidente: incId, id_subarea_gestion: subAreaGestionId, id_tecnico: tecnicoId, descripcion, estado: 'EN_PROCESO', created_at: now, updated_at: now });
    const estAnt = inc.id_estado;
    Store.saveInc({ ...inc, id_estado: 'ASIGNADO', updated_at: now });
    Store.addObs({ id_incidente: incId, usuario: usuarioEmail, tipo: 'OT_CREADA', texto: 'OT-' + String(ot.id).padStart(4, '0') + ' creada. Técnico asignado. Estado → ASIGNADO.', estado_anterior: estAnt, estado_nuevo: 'ASIGNADO', created_at: now });
    return { ok: true, ot };
  },
  completarOT(otId, usuarioEmail) {
    const ot = Store.ots().find(o => o.id === otId);
    if (!ot) return { ok: false, motivo: 'OT no encontrada.' };
    const now = new Date().toISOString();
    Store.saveOT({ ...ot, estado: 'COMPLETADA', fecha_cierre: now, updated_at: now });
    const inc = Store.incidentes().find(i => i.id === ot.id_incidente);
    if (inc && !this.esTerminal(inc.id_estado)) {
      Store.saveInc({ ...inc, id_estado: 'CUMPLIDO', updated_at: now });
      Store.addObs({ id_incidente: inc.id, usuario: usuarioEmail, tipo: 'OT_COMPLETADA', texto: 'OT-' + String(otId).padStart(4, '0') + ' completada. Incidente → CUMPLIDO.', estado_anterior: inc.id_estado, estado_nuevo: 'CUMPLIDO', created_at: now });
    }
    return { ok: true };
  },
  cancelarOT(otId, motivo, usuarioEmail) {
    const ot = Store.ots().find(o => o.id === otId);
    if (!ot) return { ok: false, motivo: 'OT no encontrada.' };
    if (!motivo?.trim()) return { ok: false, motivo: 'El motivo de cancelación es obligatorio.' };
    const now = new Date().toISOString();
    Store.saveOT({ ...ot, estado: 'CANCELADA', motivo_cancelacion: motivo, fecha_cierre: now, updated_at: now });
    const inc = Store.incidentes().find(i => i.id === ot.id_incidente);
    if (inc && !this.esTerminal(inc.id_estado)) {
      Store.saveInc({ ...inc, id_estado: 'PENDIENTE', updated_at: now });
      Store.addObs({ id_incidente: inc.id, usuario: usuarioEmail, tipo: 'OT_CANCELADA', texto: 'OT-' + String(otId).padStart(4, '0') + ' cancelada: ' + motivo + '. Incidente → PENDIENTE.', estado_anterior: inc.id_estado, estado_nuevo: 'PENDIENTE', created_at: now });
    }
    return { ok: true };
  },
  crearHijo(incPadreId, dataHijo, usuarioEmail) {
    const hijo = Store.saveInc({ ...dataHijo, id_incidente_padre: incPadreId, id_estado: 'PENDIENTE', id_usuario_creador: usuarioEmail, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    hijo.nro_referencia = nroRef(hijo.id);
    Store.saveInc(hijo);
    Store.addObs({ id_incidente: hijo.id, usuario: usuarioEmail, tipo: 'CREACION', texto: 'Incidente hijo creado desde #' + nroRef(incPadreId), estado_nuevo: 'PENDIENTE', created_at: new Date().toISOString() });
    const padre = Store.incidentes().find(i => i.id === incPadreId);
    if (padre && !ESTADOS[padre.id_estado]?.terminal) {
      const estadoAnt = padre.id_estado;
      Store.saveInc({ ...padre, id_estado: 'EN_ESPERA_TERCEROS', updated_at: new Date().toISOString() });
      Store.addObs({ id_incidente: incPadreId, usuario: usuarioEmail, tipo: 'CAMBIO_ESTADO', texto: 'Bloqueado: hijo #' + nroRef(hijo.id) + ' pendiente.', estado_anterior: estadoAnt, estado_nuevo: 'EN_ESPERA_TERCEROS', created_at: new Date().toISOString() });
    }
    return { ok: true, hijo };
  },
};

// ── Login ────────────────────────────────────────────────────
// El login único es home.html. Si no hay sesión → redirige allí.
function initLogin() {
  const u = Auth.get();
  if (!u) {
    // Sin sesión: ocultar módulo y redirigir al portal de inicio
    document.body.style.visibility = 'hidden';
    location.replace('home.html');
    return;
  }
  // Sesión activa: ocultar overlay (por si el HTML lo muestra) y cargar módulo
  const overlay = $('loginOverlay');
  if (overlay) overlay.hidden = true;
  onLoggedIn();
}

function onLoggedIn() {
  renderHeader(); applyRoleUI(); cargarDemoData(); popularFiltros(); renderBandeja();
}

function renderHeader() {
  const u = Auth.get(); if (!u) return;
  $('userAvatar').textContent = u.iniciales;
  $('userNombre').textContent = u.nombre;
  const r = $('userRol'); r.textContent = u.rol;
  r.className = 'user-rol rol--' + u.rol.toLowerCase();
}

function applyRoleUI() {
  const admin = Auth.esAdmin(), colab = Auth.esColab();
  $('navNuevo').hidden = !colab;
  $('navOrdenes').hidden = !colab;
  $('navTablero').hidden = !admin;
  $('navAdmin').hidden = !admin;
  $('btnAbrirNuevo').hidden = !colab;
}

// ── Navegación ───────────────────────────────────────────────
let _viewActiva = 'bandeja';

function showView(v) {
  document.querySelectorAll('.view').forEach(el => el.hidden = true);
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => {
    b.classList.toggle('nav-btn--active', b.dataset.view === v);
  });
  const el = $('view' + v.charAt(0).toUpperCase() + v.slice(1));
  if (el) el.hidden = false;
  _viewActiva = v;
}

function initNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      showView(v);
      if (v === 'bandeja') renderBandeja();
      if (v === 'ordenes') renderOrdenes();
      if (v === 'tablero') renderTablero();
      if (v === 'admin') renderAdminAreas();
      if (v === 'nuevo') renderNuevoIncidente();
    });
  });
  $('btnAbrirNuevo').addEventListener('click', () => { showView('nuevo'); renderNuevoIncidente(); });
  $('btnLogout').addEventListener('click', () => { Auth.clear(); location.reload(); });
}

// ============================================================
// crm.js — Parte 3/4: Filtros, Bandeja, Nuevo Incidente, Detalle
// ============================================================

// ── Filtros ──────────────────────────────────────────────────
function popularFiltros() {
  ['filtroArea', 'tipoArea'].forEach(id => {
    const sel = $(id); if (!sel) return;
    const primero = sel.options[0];
    sel.innerHTML = ''; sel.appendChild(primero);
    Store.areas().filter(a => a.activo).forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.nombre; sel.appendChild(o); });
  });
  // Filtros OT: áreas de gestión
  const otAG = $('otFiltroAreaGestion'); if (otAG) {
    const p = otAG.options[0]; otAG.innerHTML = ''; otAG.appendChild(p);
    Store.areasG().filter(a => a.activo).forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.nombre; otAG.appendChild(o); });
  }
  // Filtros OT: técnicos
  const otT = $('otFiltroTecnico'); if (otT) {
    const p = otT.options[0]; otT.innerHTML = ''; otT.appendChild(p);
    Store.tecnicos().filter(t => t.activo).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.apellido + ', ' + t.nombre; otT.appendChild(o); });
  }
}
function popularSubareas(areaId, selId) {
  const sel = $(selId); if (!sel) return;
  sel.innerHTML = '<option value="">— Sub-área —</option>';
  Store.subareas().filter(s => s.id_area === +areaId && s.activo).forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.nombre; sel.appendChild(o); });
}
function popularSubareasGestionOT(areaGId) {
  const sel = $('otSubAreaGestion'); if (!sel) return;
  sel.innerHTML = '<option value="">— Sub-área de Gestión —</option>';
  Store.subareasG().filter(s => (!areaGId || s.id_area_gestion === +areaGId) && s.activo).forEach(s => {
    const o = document.createElement('option'); o.value = s.id; o.textContent = s.nombre; sel.appendChild(o);
  });
}
function popularTecnicosOT(subAreaGId) {
  const sel = $('otTecnico'); if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccione técnico —</option>';
  Store.tecnicos().filter(t => t.activo && t.perfil === 'GESTION' && (!subAreaGId || t.id_subarea_gestion === +subAreaGId)).forEach(t => {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.apellido + ', ' + t.nombre; sel.appendChild(o);
  });
}

// ── BANDEJA ──────────────────────────────────────────────────
function slaChip(inc) {
  const tipo = Store.tipos().find(t => t.id === inc.id_tipo);
  if (!tipo || tipo.sla_horas === 0 || tipo.categoria === 'CONSULTA') return '<span class="sla-chip sla--consulta">Sin SLA</span>';
  if (!inc.fecha_limite_sla) return '<span class="sla-chip sla--consulta">—</span>';
  const now = Date.now(), lim = new Date(inc.fecha_limite_sla).getTime();
  if (ESTADOS[inc.id_estado]?.terminal) return '<span class="sla-chip sla--ok">Cerrado</span>';
  if (now > lim) return '<span class="sla-chip sla--vencido">⚠ Vencido</span>';
  if (now > lim - 4 * 3600000) return '<span class="sla-chip sla--warn">⏳ Por vencer</span>';
  const hs = Math.round((lim - now) / 3600000);
  return `<span class="sla-chip sla--ok">${hs}h restantes</span>`;
}

function exportarXLS(datos, nombre) {
  if (typeof XLSX === 'undefined') { showToast('Librería XLS no disponible', 'err'); return; }
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, nombre + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
}

function renderBandeja() {
  const estado = $('filtroEstado')?.value || '';
  const categ = $('filtroCategoria')?.value || '';
  const area = +($('filtroArea')?.value || 0);
  const desde = $('filtroDesde')?.value || '';
  const hasta = $('filtroHasta')?.value || '';
  const buscar = ($('filtroBuscar')?.value || '').toLowerCase();
  let data = Store.incidentes();
  if (estado) data = data.filter(i => i.id_estado === estado);
  if (categ) data = data.filter(i => { const t = Store.tipos().find(x => x.id === i.id_tipo); return t?.categoria === categ; });
  if (area) data = data.filter(i => { const t = Store.tipos().find(x => x.id === i.id_tipo); const s = Store.subareas().find(x => x.id === t?.id_subarea); return s?.id_area === area; });
  if (desde) data = data.filter(i => i.created_at >= desde);
  if (hasta) data = data.filter(i => i.created_at <= hasta + 'T23:59:59');
  if (buscar) data = data.filter(i => {
    const ref = (i.nro_referencia || nroRef(i.id)).toLowerCase();
    const p = Store.personas().find(x => x.id === i.persona_id);
    const nombre = (p ? p.apellido + ' ' + p.nombre : '').toLowerCase();
    return ref.includes(buscar) || nombre.includes(buscar) || i.descripcion?.toLowerCase().includes(buscar);
  });
  data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const tbody = $('tablaBandejaBody'); tbody.innerHTML = '';
  const vacio = $('bandejaVacio');
  if (!data.length) { vacio.hidden = false; return; }
  vacio.hidden = true;
  data.forEach(inc => {
    const p = Store.personas().find(x => x.id === inc.persona_id);
    const tipo = Store.tipos().find(x => x.id === inc.id_tipo);
    const sub = Store.subareas().find(x => x.id === tipo?.id_subarea);
    const ar = Store.areas().find(x => x.id === sub?.id_area);
    const canal = Store.canales().find(x => x.id === inc.id_canal);
    const est = ESTADOS[inc.id_estado] || ESTADOS.PENDIENTE;
    const vencido = inc.fecha_limite_sla && new Date(inc.fecha_limite_sla) < new Date() && !est.terminal;
    const tr = document.createElement('tr');
    if (vencido) tr.className = 'row--vencido';
    if (est.terminal) tr.className = 'row--terminal';
    tr.innerHTML = `
      <td style="font-family:var(--mono);font-size:.76rem">${inc.nro_referencia || nroRef(inc.id)}</td>
      <td>${p ? p.apellido + ', ' + p.nombre : '—'}</td>
      <td>${tipo?.nombre || '—'}<br><small style="color:var(--text3)">${ar?.nombre || '—'}</small></td>
      <td><span class="cat-badge cat--${(tipo?.categoria || 'consulta').toLowerCase()}">${tipo?.categoria || '—'}</span></td>
      <td><span class="est-chip ${est.cls}">${est.label}</span>${inc.id_incidente_padre ? '<br><small style="color:var(--text3)">🔗 hijo</small>' : ''}</td>
      <td>${slaChip(inc)}</td>
      <td>${canal?.nombre || '—'}</td>
      <td style="font-size:.78rem">${fmtFecha(inc.created_at)}</td>
      <td><button class="btn btn--outline btn--sm" data-det="${inc.id}">👁 Ver</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-det]').forEach(b => b.addEventListener('click', () => abrirDetalle(+b.dataset.det)));
  ['filtroEstado', 'filtroCategoria', 'filtroArea', 'filtroDesde', 'filtroHasta'].forEach(id => { if ($(id)) $(id).onchange = renderBandeja; });
  if ($('filtroBuscar')) $('filtroBuscar').oninput = renderBandeja;
  if ($('btnLimpiarFiltros')) $('btnLimpiarFiltros').onclick = () => {
    ['filtroEstado', 'filtroCategoria', 'filtroArea', 'filtroDesde', 'filtroHasta', 'filtroBuscar'].forEach(id => { if ($(id)) $(id).value = ''; });
    renderBandeja();
  };
  if ($('btnExportarBandeja')) $('btnExportarBandeja').onclick = () => {
    const rows = data.map(inc => {
      const p = Store.personas().find(x => x.id === inc.persona_id);
      const tipo = Store.tipos().find(x => x.id === inc.id_tipo);
      return { Referencia: inc.nro_referencia || nroRef(inc.id), Ciudadano: p ? p.apellido + ' ' + p.nombre : '—', Tipo: tipo?.nombre || '—', Categoria: tipo?.categoria || '—', Estado: ESTADOS[inc.id_estado]?.label || inc.id_estado, Fecha: fmtFecha(inc.created_at) };
    });
    exportarXLS(rows, 'Incidentes');
  };
}

// ── NUEVO INCIDENTE (formulario inline) ──────────────────────
let _incPadreId = null;
let _nuevaPersonaId = null;

function renderNuevoIncidente(padreId = null) {
  _incPadreId = padreId; _nuevaPersonaId = null;
  const cont = $('nuevoContainer');
  const es = ESTADOS;
  cont.innerHTML = `
    ${padreId ? `<div class="alert alert--info" style="margin-bottom:1rem">🔗 Creando incidente HIJO del ${nroRef(padreId)}</div>` : ''}
    <h3 class="card-title" style="margin-bottom:1rem">1. Identificar ciudadano (BUP)</h3>
    <div class="bup-search-box">
      <div class="bup-search-label">Buscar en Base Única de Personas</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        <select id="ni_tipo_doc" class="form-control form-control--sm" style="width:120px">
          <option value="DNI">DNI</option><option value="LC">LC</option><option value="LE">LE</option><option value="PAS">Pasaporte</option>
        </select>
        <input type="text" id="ni_nro_doc" class="form-control form-control--sm" placeholder="Nro. documento" style="width:160px" />
        <select id="ni_sexo" class="form-control form-control--sm" style="width:110px">
          <option value="M">Masculino</option><option value="F">Femenino</option><option value="X">No binario</option>
        </select>
        <button type="button" class="btn btn--outline btn--sm" id="btnBuscarPersonaNI">🔍 Buscar</button>
      </div>
      <div id="bupResultNI"></div>
    </div>
    <div id="altaInlineBox" hidden>
      <div class="alta-inline-box">
        <div class="alta-inline-title">⚠ Ciudadano no encontrado — Completar Alta en BUP</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.65rem">
          <div class="form-group"><label class="form-label">Nombre *</label><input id="ai_nombre" class="form-control" required /></div>
          <div class="form-group"><label class="form-label">Apellido *</label><input id="ai_apellido" class="form-control" required /></div>
          <div class="form-group"><label class="form-label">Tipo doc *</label>
            <select id="ai_tipo" class="form-control"><option value="DNI">DNI</option><option value="LC">LC</option><option value="LE">LE</option><option value="PAS">Pasaporte</option></select></div>
          <div class="form-group"><label class="form-label">Nro. doc *</label><input id="ai_nro" class="form-control" required /></div>
          <div class="form-group"><label class="form-label">Sexo *</label>
            <select id="ai_sexo" class="form-control"><option value="M">Masculino</option><option value="F">Femenino</option><option value="X">No binario</option></select></div>
          <div class="form-group"><label class="form-label">Teléfono (10 dígitos) *</label><input id="ai_tel" class="form-control" pattern="\\d{10}" placeholder="1155667788" /></div>
          <div class="form-group"><label class="form-label">Email</label><input type="email" id="ai_email" class="form-control" /></div>
          <div class="form-group"><label class="form-label">Calle *</label><input id="ai_calle" class="form-control" /></div>
          <div class="form-group"><label class="form-label">Altura *</label><input id="ai_altura" class="form-control" /></div>
        </div>
        <button type="button" class="btn btn--primary btn--sm" id="btnRegistrarPersona" style="margin-top:.75rem">💾 Registrar ciudadano</button>
        <div id="altaPersonaError" class="alert alert--error" hidden style="margin-top:.5rem"></div>
      </div>
    </div>

    <div id="formIncidenteBox" hidden>
      <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)"/>
      <h3 class="card-title" style="margin-bottom:.75rem">2. Datos del incidente</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.65rem">
        <div class="form-group"><label class="form-label">Canal de origen *</label>
          <select id="ni_canal" class="form-control"></select></div>
        <div class="form-group"><label class="form-label">Área *</label>
          <select id="ni_area" class="form-control"><option value="">— Seleccione área —</option></select></div>
        <div class="form-group"><label class="form-label">Sub-área *</label>
          <select id="ni_subarea" class="form-control"><option value="">— Seleccione sub-área —</option></select></div>
        <div class="form-group"><label class="form-label">Tipo de incidente *</label>
          <select id="ni_tipo" class="form-control"><option value="">— Seleccione tipo —</option></select></div>
      </div>
      <div id="inferidoBadgeBox" hidden style="margin-bottom:.65rem"></div>
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <textarea id="ni_descripcion" class="form-control" rows="4" placeholder="Describa el reclamo o consulta con el máximo detalle posible…"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">
        <div class="form-group"><label class="form-label">Calle (ubicación)</label><input id="ni_calle" class="form-control" /></div>
        <div class="form-group"><label class="form-label">Altura</label><input id="ni_altura" class="form-control" /></div>
      </div>
      <div id="niError" class="alert alert--error" hidden></div>
      <div style="display:flex;gap:.65rem;margin-top:.75rem">
        <button type="button" class="btn btn--primary" id="btnGuardarIncidente">💾 Registrar incidente</button>
        <button type="button" class="btn btn--outline" id="btnCancelarNI" onclick="showView('bandeja');renderBandeja();">Cancelar</button>
      </div>
    </div>`;

  // Eventos del formulario
  $('btnBuscarPersonaNI').addEventListener('click', buscarPersonaNI);
  $('ni_descripcion')?.addEventListener('input', inferirAreaDesc);
  $('ni_area')?.addEventListener('change', () => {
    popularSubareas($('ni_area').value, 'ni_subarea');
    popularTiposNI();
  });
  $('ni_subarea')?.addEventListener('change', popularTiposNI);
  $('btnGuardarIncidente')?.addEventListener('click', guardarNuevoIncidente);

  Store.areas().filter(a => a.activo).forEach(a => {
    const o = document.createElement('option'); o.value = a.id; o.textContent = a.nombre; $('ni_area').appendChild(o);
  });
  Store.canales().filter(c => c.activo).forEach(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; $('ni_canal').appendChild(o);
  });
}

function buscarPersonaNI() {
  const tipo = $('ni_tipo_doc').value;
  const nro = $('ni_nro_doc').value.trim();
  const sexo = $('ni_sexo').value;
  const res = $('bupResultNI');
  // Si el campo parece un apellido (no numérico), buscar por apellido
  if (nro && isNaN(nro.replace(/\s/g, ''))) {
    const lista = Store.findPersonasByApellido(nro);
    if (lista.length) {
      res.innerHTML = `<div class="bup-notfound" style="color:var(--text1)">Se encontraron ${lista.length} persona(s). Seleccione:</div>` +
        lista.map(p => `<div class="bup-found" style="cursor:pointer;margin:.25rem 0" data-pid="${p.id}">✅ ${p.apellido}, ${p.nombre} — ${p.tipo_doc} ${p.nro_doc}</div>`).join('');
      res.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
        const p = Store.personas().find(x => x.id === +el.dataset.pid);
        _nuevaPersonaId = p.id;
        res.innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} — ${p.tipo_doc} ${p.nro_doc}</div>`;
        $('altaInlineBox').hidden = true; $('formIncidenteBox').hidden = false;
      }));
      return;
    } else {
      res.innerHTML = `<div class="bup-notfound">❌ Sin resultados para apellido "${nro}". Puede registrar el ciudadano o cancelar.</div>`;
      $('altaInlineBox').hidden = false; $('formIncidenteBox').hidden = true; _nuevaPersonaId = null;
      $('btnRegistrarPersona').onclick = registrarPersonaInline; return;
    }
  }
  const p = Store.findPersona(tipo, nro, sexo);
  if (p && p.activo) {
    _nuevaPersonaId = p.id;
    res.innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} — ${tipo} ${nro}</div>`;
    $('altaInlineBox').hidden = true; $('formIncidenteBox').hidden = false;
  } else {
    _nuevaPersonaId = null;
    res.innerHTML = `<div class="bup-notfound">❌ No encontrado. Puede registrarlo o cancelar la carga.</div>`;
    $('altaInlineBox').hidden = false; $('formIncidenteBox').hidden = true;
    $('btnRegistrarPersona').onclick = registrarPersonaInline;
  }
}

function registrarPersonaInline() {
  const nombre = $('ai_nombre').value.trim(), apellido = $('ai_apellido').value.trim();
  const tipo = $('ai_tipo').value, nro = $('ai_nro').value.trim(), sexo = $('ai_sexo').value;
  const tel = $('ai_tel').value.trim(), email = $('ai_email').value.trim();
  const calle = $('ai_calle').value.trim(), altura = $('ai_altura').value.trim();
  const err = $('altaPersonaError');
  if (!nombre || !apellido || !tipo || !nro) { err.textContent = 'Nombre, apellido, tipo y nro. de documento son obligatorios.'; err.hidden = false; return; }
  if (tel && !/^\d{10}$/.test(tel)) { err.textContent = 'El teléfono debe tener exactamente 10 dígitos numéricos.'; err.hidden = false; return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Email con formato inválido.'; err.hidden = false; return; }
  const p = Store.savePersona({
    nombre, apellido, tipo_doc: tipo, nro_doc: nro, sexo, telefono: tel, email,
    calle, altura, activo: true, created_at: new Date().toISOString()
  });
  _nuevaPersonaId = p.id;
  err.hidden = true;
  $('altaInlineBox').hidden = true;
  $('bupResultNI').innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} registrado en BUP.</div>`;
  showToast('✅ Ciudadano registrado en BUP', 'ok');
}

function popularTiposNI() {
  const subId = +($('ni_subarea')?.value || 0); const sel = $('ni_tipo'); if (!sel) return;
  sel.innerHTML = '<option value="">— Tipo de incidente —</option>';
  Store.tipos().filter(t => t.id_subarea === subId && t.activo).forEach(t => {
    const o = document.createElement('option'); o.value = t.id;
    o.textContent = t.nombre + (t.sla_horas ? ` (SLA ${t.sla_horas}h)` : ' (Sin SLA)');
    sel.appendChild(o);
  });
}

function inferirAreaDesc() {
  const texto = $('ni_descripcion')?.value || '';
  const area = Clasificador.inferir(texto);
  const box = $('inferidoBadgeBox'); if (!box) return;
  if (area) {
    box.innerHTML = `<span class="inferido-badge">🤖 Área sugerida: <strong>${area.nombre}</strong></span>`;
    box.hidden = false;
    if ($('ni_area').value !== String(area.id)) {
      $('ni_area').value = area.id;
      popularSubareas(area.id, 'ni_subarea');
      popularTiposNI();
    }
  } else { box.hidden = true; }
}

function guardarNuevoIncidente() {
  if (!_nuevaPersonaId) { showToast('Debe identificar un ciudadano', 'warn'); return; }
  const canalId = +$('ni_canal').value, tipoId = +$('ni_tipo').value, desc = $('ni_descripcion').value.trim();
  const calle = $('ni_calle').value.trim(), altura = $('ni_altura').value.trim();
  const err = $('niError');
  if (!canalId || !tipoId || !desc) { err.textContent = 'Canal, tipo de incidente y descripción son obligatorios.'; err.hidden = false; return; }
  const tipo = Store.tipos().find(t => t.id === tipoId);
  const u = Auth.get();
  const ahora = new Date().toISOString();
  const sla = tipo?.sla_horas ? new Date(Date.now() + tipo.sla_horas * 3600000).toISOString() : null;
  const inc = Store.saveInc({
    persona_id: _nuevaPersonaId, id_tipo: tipoId, id_canal: canalId,
    id_estado: 'PENDIENTE', descripcion: desc, ubicacion_calle: calle, ubicacion_altura: altura,
    id_incidente_padre: _incPadreId || null, id_usuario_creador: u.email,
    fecha_limite_sla: sla, created_at: ahora, updated_at: ahora
  });
  inc.nro_referencia = nroRef(inc.id);
  Store.saveInc(inc);
  Store.addObs({
    id_incidente: inc.id, usuario: u.email, tipo: 'CREACION',
    texto: 'Incidente creado. Canal: ' + (Store.canales().find(c => c.id === canalId)?.nombre || '—'),
    estado_nuevo: 'PENDIENTE', created_at: ahora
  });
  if (_incPadreId) {
    MaquinaEstados.crearHijo(_incPadreId, { persona_id: inc.persona_id, id_tipo: inc.id_tipo, id_canal: inc.id_canal, descripcion: inc.descripcion, ubicacion_calle: inc.ubicacion_calle, ubicacion_altura: inc.ubicacion_altura, id_usuario_creador: u.email, fecha_limite_sla: sla }, u.email);
  }
  showToast('✅ Incidente ' + inc.nro_referencia + ' registrado', 'ok');
  showView('bandeja'); renderBandeja();
}

// ============================================================
// crm.js — Parte 4/4: Detalle, Modales, OT, Tablero, Admin, Bootstrap
// ============================================================

// ── DETALLE ──────────────────────────────────────────────────
let _detalleId = null;

function abrirDetalle(id) {
  _detalleId = id;
  const inc = Store.incidentes().find(i => i.id === id); if (!inc) return;
  const tipo = Store.tipos().find(t => t.id === inc.id_tipo);
  const sub = Store.subareas().find(s => s.id === tipo?.id_subarea);
  const area = Store.areas().find(a => a.id === sub?.id_area);
  const p = Store.personas().find(x => x.id === inc.persona_id);
  const canal = Store.canales().find(c => c.id === inc.id_canal);
  const est = ESTADOS[inc.id_estado] || ESTADOS.SIN_ASIGNAR;

  $('detalleRef').textContent = inc.nro_referencia || nroRef(inc.id);
  $('detalleTipo').textContent = (tipo?.nombre || '—') + ' · ' + (area?.nombre || '—');
  $('detalleEstadoChip').className = 'est-chip ' + est.cls;
  $('detalleEstadoChip').textContent = est.label;
  $('detalleSlaChip').innerHTML = slaChip(inc);
  $('detalleCategBadge').className = 'cat-badge cat--' + (tipo?.categoria || 'consulta').toLowerCase();
  $('detalleCategBadge').textContent = tipo?.categoria || '—';

  // Botones según rol y estado
  const colab = Auth.esColab(), admin = Auth.esAdmin(), terminal = est.terminal;
  $('btnCambiarEstado').hidden = !colab || terminal;
  $('btnCrearOT').hidden = !colab || terminal || tipo?.categoria === 'CONSULTA';
  $('btnCrearHijo').hidden = !colab || terminal;
  $('btnAgregarNota').hidden = !colab;

  // Grid datos
  $('detalleGrid').innerHTML = `
    <div class="detail-item"><div class="detail-label">Ciudadano</div><div class="detail-value">${p ? p.apellido + ', ' + p.nombre : '—'}</div></div>
    <div class="detail-item"><div class="detail-label">DNI</div><div class="detail-value">${p ? p.tipo_doc + ' ' + p.nro_doc : '—'}</div></div>
    <div class="detail-item"><div class="detail-label">Canal</div><div class="detail-value">${canal?.nombre || '—'}</div></div>
    <div class="detail-item"><div class="detail-label">Sub-área</div><div class="detail-value">${sub?.nombre || '—'}</div></div>
    <div class="detail-item"><div class="detail-label">Creado por</div><div class="detail-value">${inc.id_usuario_creador || '—'}</div></div>
    <div class="detail-item"><div class="detail-label">Fecha apertura</div><div class="detail-value">${fmt(inc.created_at)}</div></div>
    ${inc.fecha_limite_sla ? `<div class="detail-item"><div class="detail-label">Límite SLA</div><div class="detail-value">${fmt(inc.fecha_limite_sla)}</div></div>` : ''}
    ${inc.ubicacion_calle ? `<div class="detail-item"><div class="detail-label">Ubicación</div><div class="detail-value">${inc.ubicacion_calle}${inc.ubicacion_altura ? ' ' + inc.ubicacion_altura : ''}</div></div>` : ''}`;

  $('detalleDesc').textContent = inc.descripcion || '—';

  // Padre / hijo
  const phEl = $('detallePadreHijo');
  if (inc.id_incidente_padre) {
    phEl.innerHTML = `<div class="alert alert--warning">🔗 Incidente hijo de <strong>${nroRef(inc.id_incidente_padre)}</strong>. <button class="btn btn--outline btn--sm" onclick="abrirDetalle(${inc.id_incidente_padre})">Ver padre</button></div>`;
    phEl.hidden = false;
  } else {
    const hijos = Store.incidentes().filter(i => i.id_incidente_padre === id);
    if (hijos.length) {
      phEl.innerHTML = `<div class="alert alert--info">🔗 Incidentes hijos: ${hijos.map(h => `<button class="btn btn--outline btn--sm" onclick="abrirDetalle(${h.id})">${nroRef(h.id)}</button>`).join(' ')}</div>`;
      phEl.hidden = false;
    } else { phEl.hidden = true; }
  }

  // OTs
  const otsInc = Store.ots().filter(o => o.id_incidente === id);
  const otBody = $('tablaDetalleOTsBody'); otBody.innerHTML = '';
  if (!otsInc.length) {
    otBody.innerHTML = '<tr><td colspan="5" class="empty-td">Sin órdenes de trabajo.</td></tr>';
  } else {
    otsInc.forEach(ot => {
      const sa = Store.subareas().find(s => s.id === ot.id_subarea);
      const stCls = { PENDIENTE: 'ot-pend', EN_PROCESO: 'ot-proc', COMPLETADA: 'ot-comp', CANCELADA: 'ot-canc' }[ot.estado] || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="font-family:var(--mono)">OT-${String(ot.id).padStart(4, '0')}</td>
        <td>${sa?.nombre || '—'}</td><td>${ot.id_usuario || '—'}</td>
        <td><span class="${stCls}">${ot.estado}</span></td>
        <td>${ot.estado === 'PENDIENTE' || ot.estado === 'EN_PROCESO' ? `<button class="btn btn--outline btn--sm" data-completar-ot="${ot.id}">✓ Completar</button>` : '—'}</td>`;
      otBody.appendChild(tr);
    });
    otBody.querySelectorAll('[data-completar-ot]').forEach(b => b.addEventListener('click', () => completarOT(+b.dataset.completarOt)));
  }

  // Timeline
  const obs = Store.obs().filter(o => o.id_incidente === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  $('timelineContainer').innerHTML = obs.map(o => {
    const dotCls = ICONOS_TL_CLS[o.tipo] || 'tl-nota';
    const icono = ICONOS_TL[o.tipo] || '●';
    const cambio = (o.estado_anterior && o.estado_nuevo) ? `<br><small>${ESTADOS[o.estado_anterior]?.label || o.estado_anterior} → ${ESTADOS[o.estado_nuevo]?.label || o.estado_nuevo}</small>` : '';
    return `<div class="timeline-item">
      <div class="timeline-dot ${dotCls}">${icono}</div>
      <div class="timeline-content">
        <div class="timeline-meta">${fmt(o.created_at)} · ${o.usuario || 'sistema'}</div>
        <div class="timeline-texto">${o.texto || '—'}${cambio}</div>
      </div></div>`;
  }).join('');

  $('modalDetalle').hidden = false;
}

function initDetalle() {
  $('btnCerrarDetalle').addEventListener('click', () => $('modalDetalle').hidden = true);
  $('btnCambiarEstado').addEventListener('click', () => abrirCambiarEstado());
  $('btnCrearOT').addEventListener('click', () => abrirNuevaOT());
  $('btnAgregarNota').addEventListener('click', () => { $('textoNota').value = ''; $('notaError').hidden = true; $('modalNota').hidden = false; });
  $('btnGuardarNota').addEventListener('click', guardarNota);
  $('btnCerrarNotaX').addEventListener('click', () => $('modalNota').hidden = true);
  $('btnCancelarNota').addEventListener('click', () => $('modalNota').hidden = true);
  $('btnCrearHijo').addEventListener('click', () => {
    $('modalDetalle').hidden = true;
    showView('nuevo'); renderNuevoIncidente(_detalleId);
  });
  $('btnCrearCita')?.addEventListener('click', abrirNuevaCita);
}

function guardarNota() {
  const texto = $('textoNota').value.trim(); const err = $('notaError');
  if (!texto) { err.textContent = 'La nota no puede estar vacía.'; err.hidden = false; return; }
  Store.addObs({ id_incidente: _detalleId, usuario: Auth.get().email, tipo: 'NOTA', texto, created_at: new Date().toISOString() });
  $('modalNota').hidden = true;
  abrirDetalle(_detalleId);
  showToast('Nota agregada', 'ok');
}

// ── CAMBIAR ESTADO ────────────────────────────────────────────
function abrirCambiarEstado() {
  $('motivoCambioEstado').value = ''; $('alertaTerminal').hidden = true; $('alertaHijoPendiente').hidden = true; $('cambioEstadoError').hidden = true;
  const inc = Store.incidentes().find(i => i.id === _detalleId); if (!inc) return;
  $('nuevoEstadoSel').value = inc.id_estado;
  $('nuevoEstadoSel').addEventListener('change', () => {
    const sel = $('nuevoEstadoSel').value;
    $('alertaTerminal').hidden = !ESTADOS[sel]?.terminal;
    if ((sel === 'RESUELTO' || sel === 'CANCELADO')) {
      const hijos = Store.incidentes().filter(i => i.id_incidente_padre === _detalleId && i.id_estado !== 'RESUELTO');
      $('alertaHijoPendiente').hidden = !hijos.length;
    }
  });
  $('modalCambiarEstado').hidden = false;
}

function initCambiarEstado() {
  $('btnCerrarCambioEstadoX').addEventListener('click', () => $('modalCambiarEstado').hidden = true);
  $('btnCancelarCambioEstado').addEventListener('click', () => $('modalCambiarEstado').hidden = true);
  $('btnConfirmarCambioEstado').addEventListener('click', () => {
    const nuevoEstado = $('nuevoEstadoSel').value;
    const motivo = $('motivoCambioEstado').value.trim();
    const err = $('cambioEstadoError');
    if (!motivo) { err.textContent = 'El motivo es obligatorio.'; err.hidden = false; return; }
    const result = MaquinaEstados.cambiarEstado(_detalleId, nuevoEstado, motivo, Auth.get().email);
    if (!result.ok) { err.textContent = result.motivo; err.hidden = false; return; }
    $('modalCambiarEstado').hidden = true;
    abrirDetalle(_detalleId); renderBandeja();
    showToast('Estado actualizado a: ' + ESTADOS[nuevoEstado]?.label, 'ok');
  });
}

// ── NUEVA OT ───────────────────────────────────────────────────
let _cancelOTId = null;
function abrirNuevaOT() {
  const inc = Store.incidentes().find(i => i.id === _detalleId); if (!inc) return;
  if (MaquinaEstados.esTerminal(inc.id_estado)) { showToast('Incidente en estado terminal, no se puede crear OT.', 'err'); return; }
  $('otIncidenteInfo').textContent = 'Incidente: ' + (inc.nro_referencia || nroRef(inc.id)) + ' — ' + (ESTADOS[inc.id_estado]?.label || inc.id_estado);
  // Poblar combos de gestión
  const otAG = $('otAreaGestion'); otAG.innerHTML = '<option value="">— Área de Gestión —</option>';
  Store.areasG().filter(a => a.activo).forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.nombre; otAG.appendChild(o); });
  $('otSubAreaGestion').innerHTML = '<option value="">— Sub-área de Gestión —</option>';
  $('otTecnico').innerHTML = '<option value="">— Seleccione técnico —</option>';
  $('otDescripcion').value = ''; $('otError').hidden = true;
  $('modalNuevaOT').hidden = false;
}
function initNuevaOT() {
  $('btnCerrarNuevaOTX').addEventListener('click', () => $('modalNuevaOT').hidden = true);
  $('btnCancelarNuevaOT').addEventListener('click', () => $('modalNuevaOT').hidden = true);
  // Cascada área → sub-área → técnico
  $('otAreaGestion').addEventListener('change', () => popularSubareasGestionOT($('otAreaGestion').value));
  $('otSubAreaGestion').addEventListener('change', () => popularTecnicosOT($('otSubAreaGestion').value));
  $('btnConfirmarNuevaOT').addEventListener('click', () => {
    const subId = +$('otSubAreaGestion').value;
    const tecId = +$('otTecnico').value;
    const desc = $('otDescripcion').value.trim();
    const err = $('otError');
    if (!subId) { err.textContent = 'Seleccione sub-área de gestión.'; err.hidden = false; return; }
    if (!tecId) { err.textContent = 'Debe asignar un técnico.'; err.hidden = false; return; }
    const result = MaquinaEstados.crearOT(_detalleId, subId, tecId, desc, Auth.get().email);
    if (!result.ok) { err.textContent = result.motivo; err.hidden = false; return; }
    $('modalNuevaOT').hidden = true;
    abrirDetalle(_detalleId); renderBandeja();
    showToast('🔧 OT creada. Incidente pasó a ASIGNADO.', 'ok');
  });
  // Modal cancelar OT
  $('btnCerrarCancelarOTX').addEventListener('click', () => $('modalCancelarOT').hidden = true);
  $('btnCerrarCancelarOT').addEventListener('click', () => $('modalCancelarOT').hidden = true);
  $('btnConfirmarCancelarOT').addEventListener('click', () => {
    const motivo = $('motivoCancelarOT').value.trim();
    const err = $('cancelarOTError');
    if (!motivo) { err.textContent = 'El motivo es obligatorio.'; err.hidden = false; return; }
    const result = MaquinaEstados.cancelarOT(_cancelOTId, motivo, Auth.get().email);
    if (!result.ok) { err.textContent = result.motivo; err.hidden = false; return; }
    $('modalCancelarOT').hidden = true;
    if (_detalleId) abrirDetalle(_detalleId);
    renderBandeja(); renderOrdenes();
    showToast('❌ OT cancelada. Incidente vuelve a PENDIENTE.', 'warn');
  });
}
function completarOT(otId) {
  if (!confirm('¿Marcar esta OT como COMPLETADA? El incidente pasará a CUMPLIDO.')) return;
  const result = MaquinaEstados.completarOT(otId, Auth.get().email);
  if (!result.ok) { showToast(result.motivo, 'err'); return; }
  if (_detalleId) abrirDetalle(_detalleId);
  renderBandeja(); renderOrdenes();
  showToast('✅ OT completada. Incidente → CUMPLIDO.', 'ok');
}
function abrirCancelarOT(otId) {
  _cancelOTId = otId;
  const ot = Store.ots().find(o => o.id === otId); if (!ot) return;
  const inc = Store.incidentes().find(i => i.id === ot.id_incidente);
  $('cancelarOTInfo').textContent = 'OT-' + String(otId).padStart(4, '0') + ' del incidente ' + (inc?.nro_referencia || nroRef(ot.id_incidente));
  $('motivoCancelarOT').value = ''; $('cancelarOTError').hidden = true;
  $('modalCancelarOT').hidden = false;
}

// ── ÓRDENES DE TRABAJO ──────────────────────────────────────────
function renderOrdenes() {
  const estado = $('otFiltroEstado')?.value || '';
  const areaG = +($('otFiltroAreaGestion')?.value || 0);
  const subareaG = +($('otFiltroSubarea')?.value || 0);
  const tec = +($('otFiltroTecnico')?.value || 0);
  const desde = $('otFiltroDesde')?.value || '';
  const hasta = $('otFiltroHasta')?.value || '';
  const buscar = ($('otFiltroBuscar')?.value || '').toLowerCase();
  let data = Store.ots();
  if (estado) data = data.filter(o => o.estado === estado);
  if (areaG) data = data.filter(o => { const s = Store.subareasG().find(x => x.id === o.id_subarea_gestion); return s?.id_area_gestion === areaG; });
  if (subareaG) data = data.filter(o => o.id_subarea_gestion === subareaG);
  if (tec) data = data.filter(o => o.id_tecnico === tec);
  if (desde) data = data.filter(o => o.created_at >= desde);
  if (hasta) data = data.filter(o => o.created_at <= hasta + 'T23:59:59');
  if (buscar) data = data.filter(o => {
    const otRef = 'OT-' + String(o.id).padStart(4, '0');
    const inc = Store.incidentes().find(i => i.id === o.id_incidente);
    return otRef.toLowerCase().includes(buscar) || (inc?.nro_referencia || '').toLowerCase().includes(buscar);
  });
  const tbody = $('tablaOrdenesBody'); tbody.innerHTML = '';
  $('ordenesVacio').hidden = data.length > 0;
  data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(ot => {
    const inc = Store.incidentes().find(i => i.id === ot.id_incidente);
    const p = Store.personas().find(x => x.id === inc?.persona_id);
    const sg = Store.subareasG().find(s => s.id === ot.id_subarea_gestion);
    const ag = Store.areasG().find(a => a.id === sg?.id_area_gestion);
    const tec = Store.tecnicos().find(t => t.id === ot.id_tecnico);
    const stCls = { EN_PROCESO: 'ot-proc', COMPLETADA: 'ot-comp', CANCELADA: 'ot-canc' }[ot.estado] || '';
    const activa = ot.estado === 'EN_PROCESO';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-family:var(--mono)">OT-${String(ot.id).padStart(4, '0')}</td>
      <td><button class="btn btn--outline btn--sm" onclick="abrirDetalle(${ot.id_incidente})">${inc?.nro_referencia || nroRef(ot.id_incidente)}</button></td>
      <td>${p ? p.apellido + ', ' + p.nombre : '—'}</td>
      <td>${ag?.nombre || '—'}<br><small style="color:var(--text3)">${sg?.nombre || '—'}</small></td>
      <td>${tec ? tec.apellido + ' ' + tec.nombre : '—'}</td>
      <td style="font-size:.77rem">${ot.descripcion ? ot.descripcion.slice(0, 40) + '...' : '—'}</td>
      <td><span class="${stCls}">${ot.estado.replace('_', ' ')}</span></td>
      <td style="font-size:.78rem">${fmtFecha(ot.created_at)}</td>
      <td style="display:flex;gap:.3rem;flex-wrap:wrap">
        <button class="btn btn--outline btn--sm" onclick="abrirDetalle(${ot.id_incidente})">Ver Inc.</button>
        ${activa ? `<button class="btn btn--primary btn--sm" data-comp-ot="${ot.id}">✓ Completar</button>` : ''}
        ${activa ? `<button class="btn btn--danger btn--sm" data-canc-ot="${ot.id}">✕ Cancelar</button>` : ''}
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-comp-ot]').forEach(b => b.addEventListener('click', () => { completarOT(+b.dataset.compOt); renderOrdenes(); }));
  tbody.querySelectorAll('[data-canc-ot]').forEach(b => b.addEventListener('click', () => abrirCancelarOT(+b.dataset.cancOt)));
  // Filtros
  ['otFiltroEstado', 'otFiltroAreaGestion', 'otFiltroSubarea', 'otFiltroTecnico', 'otFiltroDesde', 'otFiltroHasta'].forEach(id => { if ($(id)) $(id).onchange = renderOrdenes; });
  if ($('otFiltroBuscar')) $('otFiltroBuscar').oninput = renderOrdenes;
  if ($('btnLimpiarFiltrosOT')) $('btnLimpiarFiltrosOT').onclick = () => {
    ['otFiltroEstado', 'otFiltroAreaGestion', 'otFiltroSubarea', 'otFiltroTecnico', 'otFiltroDesde', 'otFiltroHasta', 'otFiltroBuscar'].forEach(id => { if ($(id)) $(id).value = ''; });
    renderOrdenes();
  };
  // Cascada área → sub-área en filtro OT
  if ($('otFiltroAreaGestion')) $('otFiltroAreaGestion').onchange = () => {
    const ag = $('otFiltroAreaGestion').value;
    const sel = $('otFiltroSubarea'); if (!sel) return;
    const p0 = sel.options[0]; sel.innerHTML = ''; sel.appendChild(p0);
    Store.subareasG().filter(s => (!ag || s.id_area_gestion === +ag) && s.activo).forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.nombre; sel.appendChild(o); });
    renderOrdenes();
  };
  if ($('btnExportarOT')) $('btnExportarOT').onclick = () => {
    const rows = data.map(ot => {
      const inc = Store.incidentes().find(i => i.id === ot.id_incidente);
      const p = Store.personas().find(x => x.id === inc?.persona_id);
      const sg = Store.subareasG().find(s => s.id === ot.id_subarea_gestion);
      const t = Store.tecnicos().find(x => x.id === ot.id_tecnico);
      return { OT: 'OT-' + String(ot.id).padStart(4, '0'), Incidente: inc?.nro_referencia || nroRef(ot.id_incidente), Ciudadano: p ? p.apellido + ' ' + p.nombre : '—', Subarea: sg?.nombre || '—', Tecnico: t ? t.apellido + ' ' + t.nombre : '—', Estado: ot.estado, Fecha: fmtFecha(ot.created_at) };
    });
    exportarXLS(rows, 'Ordenes_Trabajo');
  };
}

// ── TABLERO (actualizado con nombres de estados nuevos) ────────────────────
function renderTablero() {
  const incs = Store.incidentes();
  const ots = Store.ots();
  const total = incs.length;
  const abiertos = incs.filter(i => !ESTADOS[i.id_estado]?.terminal).length;
  const vencidos = incs.filter(i => i.fecha_limite_sla && new Date(i.fecha_limite_sla) < new Date() && !ESTADOS[i.id_estado]?.terminal).length;
  const resueltos = incs.filter(i => i.id_estado === 'RESUELTO').length;
  const otsPend = ots.filter(o => o.estado === 'PENDIENTE' || o.estado === 'EN_PROCESO').length;

  $('kpiContainer').innerHTML = `
    <div class="kpi-card"><div class="kpi-value">${total}</div><div class="kpi-label">Total incidentes</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--accent)">${abiertos}</div><div class="kpi-label">Incidentes abiertos</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--danger)">${vencidos}</div><div class="kpi-label">SLA Vencidos</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--success)">${resueltos}</div><div class="kpi-label">Resueltos</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--warning)">${otsPend}</div><div class="kpi-label">OT pendientes</div></div>`;

  // Tabla por área/estado
  const mapa = {};
  incs.forEach(i => {
    const t = Store.tipos().find(x => x.id === i.id_tipo);
    const s = Store.subareas().find(x => x.id === t?.id_subarea);
    const a = Store.areas().find(x => x.id === s?.id_area);
    const key = (a?.nombre || 'Sin área') + '|' + i.id_estado + '|' + (t?.categoria || '—');
    if (!mapa[key]) mapa[key] = { area: a?.nombre || 'Sin área', estado: i.id_estado, categ: t?.categoria || '—', total: 0, slaVenc: 0 };
    mapa[key].total++;
    if (i.fecha_limite_sla && new Date(i.fecha_limite_sla) < new Date() && !ESTADOS[i.id_estado]?.terminal) mapa[key].slaVenc++;
  });
  const tbody = $('tablaTableroBody'); tbody.innerHTML = '';
  Object.values(mapa).sort((a, b) => a.area.localeCompare(b.area)).forEach(r => {
    const est = ESTADOS[r.estado] || ESTADOS.SIN_ASIGNAR;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.area}</td><td><span class="est-chip ${est.cls}">${est.label}</span></td>
      <td><span class="cat-badge cat--${r.categ.toLowerCase()}">${r.categ}</span></td>
      <td><strong>${r.total}</strong></td>
      <td>${r.slaVenc ? `<span style="color:var(--danger);font-weight:700">${r.slaVenc}</span>` : '—'}</td>`;
    tbody.appendChild(tr);
  });
  $('btnRefreshTablero').onclick = renderTablero;
}

// ── ADMIN MAESTROS ────────────────────────────────────────────
let _editAreaId = null, _editTipoId = null;

function initAdmin() {
  document.querySelectorAll('.subtab[data-admin]').forEach(bt => {
    bt.addEventListener('click', () => {
      document.querySelectorAll('.subtab[data-admin]').forEach(b => { b.classList.remove('subtab--active'); b.setAttribute('aria-selected', 'false'); });
      bt.classList.add('subtab--active'); bt.setAttribute('aria-selected', 'true');
      ['adminAreas', 'adminTipos', 'adminCanales', 'adminAgentes'].forEach(id => $(id).hidden = true);
      const map = { areas: 'adminAreas', tipos: 'adminTipos', canales: 'adminCanales', agentes: 'adminAgentes' };
      if (map[bt.dataset.admin]) $(map[bt.dataset.admin]).hidden = false;
      if (bt.dataset.admin === 'areas') renderAdminAreas();
      if (bt.dataset.admin === 'tipos') renderAdminTipos();
      if (bt.dataset.admin === 'canales') renderAdminCanales();
      if (bt.dataset.admin === 'agentes') renderAdminAgentes();
    });
  });
  // Área
  $('btnNuevaArea').addEventListener('click', () => { _editAreaId = null; $('areaNombre').value = ''; $('areaDesc').value = ''; $('areaClave').value = ''; $('areaError').hidden = true; $('modalAreaTitle').textContent = 'Nueva Área'; $('modalArea').hidden = false; });
  $('btnCerrarAreaX').addEventListener('click', () => $('modalArea').hidden = true);
  $('btnCancelarArea').addEventListener('click', () => $('modalArea').hidden = true);
  $('btnGuardarArea').addEventListener('click', () => {
    const n = $('areaNombre').value.trim(); if (!n) { $('areaError').textContent = 'Nombre requerido.'; $('areaError').hidden = false; return; }
    Store.saveArea({ id: _editAreaId || undefined, nombre: n, descripcion: $('areaDesc').value.trim(), palabras_clave: $('areaClave').value.trim(), activo: true, created_at: new Date().toISOString() });
    $('modalArea').hidden = true; popularFiltros(); renderAdminAreas(); showToast('Área guardada', 'ok');
  });
  // Tipo
  $('btnNuevoTipo').addEventListener('click', () => { _editTipoId = null; $('tipoNombre').value = ''; $('tipoSla').value = 48; $('tipoError').hidden = true; $('modalTipoTitle').textContent = 'Nuevo Tipo'; popularFiltros(); $('modalTipo').hidden = false; });
  $('btnCerrarTipoX').addEventListener('click', () => $('modalTipo').hidden = true);
  $('btnCancelarTipo').addEventListener('click', () => $('modalTipo').hidden = true);
  $('tipoArea')?.addEventListener('change', () => { popularSubareas($('tipoArea').value, 'tipoSubArea'); });
  $('tipoCategoria')?.addEventListener('change', () => { $('tipoSlaGroup').hidden = $('tipoCategoria').value === 'CONSULTA'; });
  $('btnGuardarTipo').addEventListener('click', () => {
    const n = $('tipoNombre').value.trim(), sub = +$('tipoSubArea').value, cat = $('tipoCategoria').value;
    const err = $('tipoError');
    if (!n || !sub) { err.textContent = 'Nombre y sub-área requeridos.'; err.hidden = false; return; }
    Store.saveTipo({ id: _editTipoId || undefined, id_subarea: sub, nombre: n, categoria: cat, sla_horas: cat === 'CONSULTA' ? 0 : +$('tipoSla').value, activo: true, created_at: new Date().toISOString() });
    $('modalTipo').hidden = true; renderAdminTipos(); showToast('Tipo guardado', 'ok');
  });
  // Canal
  $('btnNuevoCanal').addEventListener('click', () => {
    const nombre = prompt('Nombre del nuevo canal:'); if (!nombre?.trim()) return;
    Store.saveCanal({ nombre: nombre.trim(), activo: true, created_at: new Date().toISOString() });
    renderAdminCanales(); showToast('Canal creado', 'ok');
  });
}

function renderAdminAreas() {
  $(adminAreas).style.display = 'block';
  const tbody = $('tablaAreasBody'); tbody.innerHTML = '';
  Store.areas().forEach(a => {
    const subs = Store.subareas().filter(s => s.id_area === a.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${a.nombre}</td><td style="font-size:.76rem;color:var(--text3)">${a.palabras_clave || '—'}</td>
      <td>${subs.map(s => `<span class="cat-badge cat--consulta" style="margin:.1rem">${s.nombre}</span>`).join('') || '—'}</td>
      <td>${a.activo ? '<span class="est-chip est--resuelto">Activo</span>' : '<span class="est-chip est--cancelado">Inactivo</span>'}</td>
      <td><button class="btn btn--outline btn--sm" data-edit-area="${a.id}">✎</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit-area]').forEach(b => b.addEventListener('click', () => {
    const a = Store.areas().find(x => x.id === +b.dataset.editArea); if (!a) return;
    _editAreaId = a.id; $('areaNombre').value = a.nombre; $('areaDesc').value = a.descripcion || ''; $('areaClave').value = a.palabras_clave || '';
    $('modalAreaTitle').textContent = 'Editar Área'; $('areaError').hidden = true; $('modalArea').hidden = false;
  }));
}

function renderAdminTipos() {
  const tbody = $('tablaTiposBody'); tbody.innerHTML = '';
  Store.tipos().forEach(t => {
    const s = Store.subareas().find(x => x.id === t.id_subarea);
    const a = Store.areas().find(x => x.id === s?.id_area);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.nombre}</td><td>${a?.nombre || '—'} › ${s?.nombre || '—'}</td>
      <td><span class="cat-badge cat--${t.categoria.toLowerCase()}">${t.categoria}</span></td>
      <td>${t.sla_horas || '—'}</td>
      <td>${t.activo ? '<span class="est-chip est--resuelto">Activo</span>' : '<span class="est-chip est--cancelado">Inactivo</span>'}</td>
      <td><button class="btn btn--outline btn--sm" data-edit-tipo="${t.id}">✎</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderAdminCanales() {
  const tbody = $('tablaCanalesBody'); tbody.innerHTML = '';
  Store.canales().forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${c.nombre}</td>
      <td>${c.activo ? '<span class="est-chip est--resuelto">Activo</span>' : '<span class="est-chip est--cancelado">Inactivo</span>'}</td>
      <td><button class="btn btn--danger btn--sm" onclick="Store.saveCanal({...Store.canales().find(x=>x.id===${c.id}),activo:false});renderAdminCanales()">⊘ Baja</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderAdminAgentes() {
  const tbody = $('tablaAgentesBody'); tbody.innerHTML = '';
  // Muestra todos los usuarios y su canal/subarea CRM asignado
  [
    { agente: 'admin@zaris.local', perfil: 'ADMINISTRADOR', asignacion: 'Todos los canales y áreas' },
    { agente: 'operador@zaris.local', perfil: 'ATENCIÓN/GESTIÓN', asignacion: 'Canal: Call Center · Sub-área: Todas' },
    { agente: 'consulta@zaris.local', perfil: 'SOLO LECTURA', asignacion: 'Sin asignación CRM' },
  ].forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.agente}</td><td>${r.perfil}</td><td>${r.asignacion}</td>
      <td><span class="est-chip est--resuelto">Activo</span></td>`;
    tbody.appendChild(tr);
  });
}

// ── BOOTSTRAP ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initNav();
  initDetalle();
  initCambiarEstado();
  initNuevaOT();
  initAdmin();
  if (typeof initNuevaCita === 'function') initNuevaCita();
});

// ── INTEGRACIÓN CON AGENDA: RESERVAR TURNO ─────────────────────
let _citaCentros = [];
let _citaConsultorios = [];
let _citaHorarios = [];

async function apiCitaGet(url) {
  const token = Auth.getToken();
  if(!token) return [];
  try {
    const res = await fetch(`https://zaris-api-production-bf0b.up.railway.app/api${url}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(!res.ok) return [];
    return await res.json();
  } catch(e) { return [];}
}

async function apiCitaPost(url, body) {
  const token = Auth.getToken();
  if(!token) return {error: "No autorizado"};
  try {
    const res = await fetch(`https://zaris-api-production-bf0b.up.railway.app/api${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if(!res.ok) {
        const text = await res.json().catch(()=>({}));
        return {error: text.detail || "Error en el servidor"};
    }
    return await res.json();
  } catch(e) { return {error: "Error de red"};}
}

async function abrirNuevaCita() {
  const inc = Store.incidentes().find(i => i.id === _detalleId); if (!inc) return;
  $('citaIncidenteInfo').textContent = 'Incidente: ' + (inc.nro_referencia || nroRef(inc.id)) + ' — Generando turno de agenda...';
  
  $('citaCentro').innerHTML = '<option value="">Cargando centros...</option>';
  $('citaConsultorio').innerHTML = '<option value="">Seleccione centro primero...</option>';
  $('citaHorario').innerHTML = '<option value="">Seleccione fecha y consultorio...</option>';
  $('citaFecha').value = new Date().toISOString().slice(0, 10);
  $('citaNotas').value = 'Turno originado por Incidente ' + (inc.nro_referencia || nroRef(inc.id));
  $('citaError').hidden = true;
  
  $('modalNuevaCita').hidden = false;

  // Cargar Centros
  const allEspacios = await apiCitaGet('/agenda/espacios');
  _citaCentros = allEspacios.filter(e => e.id_espacio_padre === null);
  _citaConsultorios = allEspacios.filter(e => e.id_espacio_padre !== null);

  const selC = $('citaCentro');
  selC.innerHTML = '<option value="">— Seleccione Centro —</option>';
  _citaCentros.forEach(c => {
    selC.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
  });
}

function initNuevaCita() {
  $('btnCerrarNuevaCitaX')?.addEventListener('click', () => $('modalNuevaCita').hidden = true);
  $('btnCancelarNuevaCita')?.addEventListener('click', () => $('modalNuevaCita').hidden = true);

  $('citaCentro')?.addEventListener('change', () => {
    const parentId = +$('citaCentro').value;
    const selSub = $('citaConsultorio');
    selSub.innerHTML = '<option value="">— Seleccione Consultorio —</option>';
    _citaConsultorios.filter(c => c.id_espacio_padre === parentId).forEach(c => {
      selSub.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
    $('citaHorario').innerHTML = '<option value="">Seleccione consultorio...</option>';
  });

  const buscarDisponibilidadEvent = async () => {
    const fecha = $('citaFecha').value;
    const consId = +$('citaConsultorio').value;
    const selHor = $('citaHorario');

    if(!fecha || !consId) {
        selHor.innerHTML = '<option value="">Seleccione consultorio y fecha</option>';
        return;
    }

    selHor.innerHTML = '<option value="">Buscando disponibilidad...</option>';
    
    const args = `?espacio_id=${consId}&fecha=${fecha}`;
    _citaHorarios = await apiCitaGet(`/agenda/disponibilidad/consultorios${args}`);

    if(_citaHorarios.length === 0) {
        selHor.innerHTML = '<option value="">No hay agentes trabajando en este horario/fecha</option>';
        return;
    }

    selHor.innerHTML = '<option value="">— Seleccione Horario —</option>';
    _citaHorarios.forEach(slot => {
      selHor.innerHTML += `<option value="${slot.hora_inicio}">${slot.hora_inicio} a ${slot.hora_fin} (Libre)</option>`;
    });
  };

  $('citaConsultorio')?.addEventListener('change', buscarDisponibilidadEvent);
  $('citaFecha')?.addEventListener('change', buscarDisponibilidadEvent);

  $('btnConfirmarNuevaCita')?.addEventListener('click', async () => {
    const consId = +$('citaConsultorio').value;
    const fecha = $('citaFecha').value;
    const hora = $('citaHorario').value;
    const notas = $('citaNotas').value.trim();
    const err = $('citaError');

    if (!consId || !fecha || !hora) {
        err.textContent = "Seleccione consultorio, fecha y horario.";
        err.hidden = false;
        return; 
    }

    const modalBtn = $('btnConfirmarNuevaCita');
    modalBtn.textContent = 'Procesando...';
    modalBtn.disabled = true;

    const inc = Store.incidentes().find(i => i.id === _detalleId);
    const fecHoraStr = `${fecha}T${hora}:00`;

    const bodyTurno = {
      espacio_id: consId,
      persona_id: inc.persona_id,
      fecha_hora: fecHoraStr,
      estado: 'RESERVADO',
      activo: true,
      observaciones: notas
    };

    const res = await apiCitaPost('/agenda/turnos', bodyTurno);
    
    modalBtn.textContent = '📅 Confirmar Turno';
    modalBtn.disabled = false;

    if (res.error) {
       err.textContent = res.error;
       err.hidden = false;
    } else {
       $('modalNuevaCita').hidden = true;
       // Agregar observación localmente que indique que se asignó turno
       Store.addObs({
         id_incidente: _detalleId,
         usuario: Auth.get().email,
         tipo: 'NOTA',
         texto: `Turno asignado en Agenda: ${fecha} a las ${hora}.`,
         created_at: new Date().toISOString()
       });
       showToast('✅ Turno asignado en Agenda exitosamente', 'ok');
       abrirDetalle(_detalleId);
    }
  });
}
