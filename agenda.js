'use strict';
// ============================================================
// agenda.js — ZARIS Módulo Agenda
// ============================================================

// ════════════════════════════════════════════════════════
// AUTH — comparte KEY con home.html / index.html
// ════════════════════════════════════════════════════════
const Auth = (() => {
    const KEY = 'zaris_session';

    function get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
    function set(u) { localStorage.setItem(KEY, JSON.stringify(u)); }
    function clear() { localStorage.removeItem(KEY); }
    function ini(n) { return n.trim().split(/\s+/).map(p => p[0].toUpperCase()).slice(0, 2).join(''); }
    function login(email, pass) { return null; /* Obsoleto, SSO por zaris_session */ }
    function esAdmin() { return get()?.rol === 'ADMINISTRADOR'; }
    function esColab() { return ['ADMINISTRADOR', 'COLABORADOR'].includes(get()?.rol); }
    return { get, set, clear, ini, login, esAdmin, esColab };
})();

// ════════════════════════════════════════════════════════
// STORE — localStorage Agenda + BUP compartido
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// STORE — Mapeo a FastAPI + JWT Backend
// ════════════════════════════════════════════════════════
const API_URL = 'https://zaris-api-production-bf0b.up.railway.app/api';

const Store = (() => {
    // Caché hidratado asíncronamente para simplificar el front
    let _cache = {
        espacios: [],
        equipos: [],
        agentesEspacio: [],
        eventos: [],
        turnos: [],
        entradas: [],
        espera: [],
        personas: [] // BUP Mock para refactorización iterativa
    };

    const objGet = {
        headers: function() {
            const u = Auth.get();
            return {
                'Content-Type': 'application/json',
                'Authorization': u && u.token ? `Bearer ${u.token}` : ''
            };
        }
    };

    const fetchAPI = async (endpoint, options = {}) => {
        options.headers = objGet.headers();
        const res = await fetch(`${API_URL}${endpoint}`, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Error HTTP ${res.status}`);
        }
        if (res.status === 204) return null;
        return res.json();
    };

    function _getLocalPersonas() { try { return JSON.parse(localStorage.getItem('bds_personas')) || []; } catch { return []; } }

    return {
        // GETTERS sincronos (leen desde caché)
        espacios: () => _cache.espacios,
        equipos: () => _cache.equipos,
        agEsp: () => _cache.agentesEspacio,
        eventos: () => _cache.eventos,
        turnos: () => _cache.turnos,
        entradas: () => _cache.entradas,
        espera: () => _cache.espera,
        incidentes: () => [], // CRM no migrado aún
        personas: () => _getLocalPersonas(),

        // HIDRATACIÓN: Carga toda la DB en el caché
        hidratar: async () => {
             // Simulando delay para efecto visual (opcional)
             await new Promise(r => setTimeout(r, 600));
            try {
                // Hacemos fetch parelelo
                const envStr = new Date().toISOString().slice(0,10);
                const [esp, eq, ev, t] = await Promise.all([
                    fetchAPI('/agenda/espacios').catch(()=>[]),
                    fetchAPI('/agenda/equipos').catch(()=>[]),
                    fetchAPI('/agenda/eventos').catch(()=>[]),
                    fetchAPI('/agenda/turnos?fecha=' + envStr).catch(()=>[])
                ]);
                _cache.espacios = esp || [];
                _cache.equipos = eq || [];
                _cache.eventos = ev || [];
                _cache.turnos = t || [];
                console.log('📦 Caché hidratado desde ZARIS API');
            } catch (err) {
                console.error('Error hidratando caché:', err);
                showToast('Error de conexión a la API Zaris', 'error');
            }
        },

        // MÉTODOS DE ESCRITURA
        saveEspacio: async (e) => {
            const method = e.id ? 'PUT' : 'POST';
            const ep = e.id ? `/agenda/espacios/${e.id}` : '/agenda/espacios';
            const r = await fetchAPI(ep, { method, body: JSON.stringify(e) });
            await Store.hidratar(); return r;
        },
        saveEquipo: async (e) => {
            const method = e.id ? 'PUT' : 'POST';
            const ep = e.id ? `/agenda/equipos/${e.id}` : '/agenda/equipos';
            const r = await fetchAPI(ep, { method, body: JSON.stringify(e) });
            await Store.hidratar(); return r;
        },
        saveEvento: async (e) => {
            const payload = {...e, cupo_maximo: Number(e.cupo_maximo)};
            const method = e.id ? 'PUT' : 'POST';
            const ep = e.id ? `/agenda/eventos/${e.id}` : '/agenda/eventos';
            const r = await fetchAPI(ep, { method, body: JSON.stringify(payload) });
            await Store.hidratar(); return r;
        },
        saveTurno: async (e) => {
            const r = await fetchAPI(e.id ? `/agenda/turnos/${e.id}` : '/agenda/turnos', {
                method: e.id ? 'PUT' : 'POST',
                body: JSON.stringify(e)
            });
            await Store.hidratar(); return r;
        },
        cancelarTurnoAPI: async (id, motivo) => {
            const r = await fetchAPI(`/agenda/turnos/${id}/cancelar?motivo=${encodeURIComponent(motivo)}`, { method: 'PUT' });
            await Store.hidratar(); return r;
        },
        cancelarEventoAPI: async (id) => {
            const r = await fetchAPI(`/agenda/eventos/${id}/cancelar`, { method: 'POST' });
            await Store.hidratar(); return r;
        },

        // Mock methods BUP
        findPersona: (tipo, nro, sexo) =>
            _getLocalPersonas().find(p => p.tipo_doc === tipo && String(p.nro_doc) === String(nro) && p.sexo === sexo) || null,
        findPersonasByApellido: (ap) =>
            _getLocalPersonas().filter(p => p.activo && (p.apellido || '').toLowerCase().includes(ap.toLowerCase())),
    };
})();

// ════════════════════════════════════════════════════════
// DEMO DATA
// ════════════════════════════════════════════════════════
function cargarDemoData() {
    if (Store.espacios().length) return;
    const now = new Date().toISOString();
    Store.saveEspacio({ nombre: 'Atención Ciudadana', descripcion: 'Mesa de entrada principal', tipo: 'ATENDIDO', capacidad_turno: 2, activo: true, created_at: now });
    Store.saveEspacio({ nombre: 'Sala de Lectura', descripcion: 'Sala de consulta libre', tipo: 'DESATENDIDO', capacidad_turno: 4, activo: true, created_at: now });
    Store.saveEspacio({ nombre: 'Sala de Reuniones', descripcion: 'Para eventos y reuniones', tipo: 'ATENDIDO', capacidad_turno: 1, activo: true, created_at: now });
    Store.saveEquipo({ nombre: 'Equipo Técnico', descripcion: 'IT y soporte técnico', activo: true, created_at: now });
    Store.saveEquipo({ nombre: 'Equipo Social', descripcion: 'Asistencia al ciudadano', activo: true, created_at: now });
    [1, 2, 3, 4, 5].forEach(d => {
        Store.saveHorEsp({ id_espacio: 1, dia_semana: d, hora_inicio: '08:00', hora_fin: '17:00', activo: true });
        Store.saveHorEsp({ id_espacio: 2, dia_semana: d, hora_inicio: '09:00', hora_fin: '18:00', activo: true });
    });
    const manana = new Date(); manana.setDate(manana.getDate() + 3);
    Store.saveEvento({
        nombre: 'Charla Vecinal 2026', descripcion: 'Taller de participación ciudadana',
        espacio_id: 1, fecha_hora: manana.toISOString().slice(0, 10) + 'T18:00:00',
        duracion_min: 90, cupo_maximo: 30, entradas_emitidas: 0,
        estado: 'ACTIVO', activo: true, created_at: now
    });
}

// ════════════════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

function showToast(msg, tipo = 'ok', dur = 4500) {
    const c = $('toastContainer'), t = document.createElement('div');
    t.className = `toast toast--${tipo}`; t.textContent = msg; c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 300); }, dur);
}

function fmtFechaHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).toUpperCase().slice(0, 16); }
function lunes(fecha = new Date()) {
    const d = new Date(fecha); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
}
function semanaLabel(base) {
    const d = new Date(base), fin = new Date(base); fin.setDate(fin.getDate() + 6);
    return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} — ${fin.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function esHoy(d) { const h = new Date(); return d.toDateString() === h.toDateString(); }

// ════════════════════════════════════════════════════════
// LOGIN — login único en home.html. Si no hay sesión → redirige allí.
// ════════════════════════════════════════════════════════
async function initLogin() {
    const u = Auth.get();
    if (!u) {
        document.body.style.visibility = 'hidden';
        location.replace('home.html');
        return;
    }
    // Sesión activa: ocultar overlay y cargar módulo
    const overlay = $('loginOverlay');
    if (overlay) overlay.hidden = true;
    renderHeader(); applyRoleUI(); 
    
    // Hidratar Caché asíncrono
    $('calGrid').innerHTML = '<div style="padding:2rem;text-align:center"><p>Cargando datos de la API ZARIS...</p></div>';
    await Store.hidratar();
    
    initCalendario();
    initTurnos();
    initEventos();
    initEspera();
}

function renderHeader() {
    const u = Auth.get(); if (!u) return;
    $('userAvatar').textContent = u.iniciales;
    $('userNombre').textContent = u.nombre;
    const rol = $('userRol');
    rol.textContent = u.rol;
    // Clases definidas en styles.css: rol--consulta / rol--colaborador / rol--administrador
    rol.className = 'user-rol rol--' + u.rol.toLowerCase();
}

function applyRoleUI() {
    const colab = Auth.esColab(), admin = Auth.esAdmin();
    $('navTurnos').hidden = !colab;
    $('navEventos').hidden = !colab;
    $('navEspera').hidden = !colab;
    $('navIncidentes').hidden = !colab;
    $('navAdmin').hidden = !admin;
    const btnEv = $('btnNuevoEvento');
    if (btnEv) btnEv.hidden = !admin;
}

// ════════════════════════════════════════════════════════
// NAV
// ════════════════════════════════════════════════════════
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => { v.hidden = true; v.classList.remove('view--active'); });
    document.querySelectorAll('.nav-btn[data-view]').forEach(b => { b.classList.remove('nav-btn--active'); b.removeAttribute('aria-current'); });
    const view = $(viewId);
    const btn = document.querySelector(`[data-view="${viewId.replace('view', '')}"]`);
    if (view) { view.hidden = false; view.classList.add('view--active'); }
    if (btn) { btn.classList.add('nav-btn--active'); btn.setAttribute('aria-current', 'page'); }
}

function initNav() {
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = btn.dataset.view;
            const viewId = 'view' + v.charAt(0).toUpperCase() + v.slice(1);
            showView(viewId);
            if (v === 'turnos') renderTurnos();
            if (v === 'eventos') renderEventos();
            if (v === 'espera') renderEspera();
            if (v === 'incidentes') renderIncidentes();
            
            if (v === 'calendario') renderCalendario();
        });
    });
    $('btnLogout').addEventListener('click', () => { Auth.clear(); location.reload(); });
}

// ════════════════════════════════════════════════════════
// CALENDARIO
// ════════════════════════════════════════════════════════
let _calBase = lunes();

function initCalendario() {
    $('calPrev').addEventListener('click', () => { _calBase.setDate(_calBase.getDate() - 7); renderCalendario(); });
    $('calNext').addEventListener('click', () => { _calBase.setDate(_calBase.getDate() + 7); renderCalendario(); });
    $('calHoy').addEventListener('click', () => { _calBase = lunes(); renderCalendario(); });
    $('calFiltroEspacio').addEventListener('change', renderCalendario);
    popularSelectEspacios('calFiltroEspacio');
    renderCalendario();
}

async function renderCalendario() {
    $('calWeekLabel').textContent = semanaLabel(_calBase);
    const filtroEsp = +$('calFiltroEspacio').value || null;
    
    $('calGrid').innerHTML = '<div style="padding:3rem;text-align:center"><div class="spinner"></div><p style="margin-top:1rem;color:var(--text-muted)">Calculando disponibilidad real...</p></div>';
    
    // Obtenemos turnos y eventos base
    const turnos = Store.turnos().filter(t => t.estado !== 'CANCELADO');
    const eventos = Store.eventos().filter(e => e.estado === 'ACTIVO');
    
    const dias7 = [];
    for (let i = 0; i < 7; i++) { const d = new Date(_calBase); d.setDate(d.getDate() + i); dias7.push(d); }

    // Fetch Disponibilidad de backend
    let dispSlots = [];
    for (let d of dias7) {
        let url = `/agenda/disponibilidad/consultorios?fecha=${d.toISOString().slice(0, 10)}`;
        if (filtroEsp) url += `&espacio_id=${filtroEsp}`;
        // Para no fallar si no hay backend en pruebas aisladas, ignoramos errores
        if(typeof fetchAPI === 'function') {
            let res = await fetchAPI(url).catch(()=>[]);
            dispSlots.push(...res);
        }
    }

    const horas = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
        '16:00', '16:30', '17:00', '17:30', '18:00'];

    let html = `<table class="cal-table"><thead><tr><th>Hora</th>`;
    dias7.forEach(d => {
        html += `<th class="${esHoy(d) ? 'cal-hoy' : ''}">${DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]}<br><small>${d.getDate()}/${d.getMonth() + 1}</small></th>`;
    });
    html += `</tr></thead><tbody>`;

    horas.forEach(hora => {
        html += `<tr><td class="cal-hora">${hora}</td>`;
        dias7.forEach(dia => {
            const dStr = dia.toISOString().slice(0, 10);
            
            // Primero, evaluar si hay un turno ocupado en este horario exacto
            const turno = turnos.find(t => t.fecha_hora?.startsWith(dStr) && t.fecha_hora.includes('T' + hora) && (!filtroEsp || t.espacio_id === filtroEsp));
            // Evaluación de eventos
            const ev = eventos.find(e => e.fecha_hora?.startsWith(dStr) && e.fecha_hora.includes('T' + hora.replace(':30', ':00')) && (!filtroEsp || e.espacio_id === filtroEsp));

            let cls = 'cal-cell';
            let content = '';

            if (turno) {
                const esp = Store.espacios().find(e => e.id === turno.espacio_id);
                cls = 'cal-cell cal-cell--turno';
                content = `<span class="cal-tip">🎫 Ocupado</span>`;
            } else if (ev) {
                cls = 'cal-cell cal-cell--evento'; 
                content = `<span class="cal-tip">🎟 ${ev.nombre}</span>`;
            } else {
                // Verificar si el slot está en dispSlots
                const slotDisponible = dispSlots.find(ds => ds.fecha === dStr && ds.hora_inicio.startsWith(hora));
                
                if (slotDisponible) {
                    cls = 'cal-cell cal-cell--libre';
                    const esp = Store.espacios().find(e => e.id === slotDisponible.espacio_id) || {};
                    content = `<span class="cal-tip" style="color:var(--success); font-weight:500;">🟢 Libre</span>`;
                } else {
                    // Celda inactiva/bloqueada, no hay agente trabajando en este consultorio según la config
                    cls = 'cal-cell'; 
                    content = `<span style="color:#d1d5db; user-select:none;">—</span>`;
                }
            }

            const canCreate = Auth.esColab() && cls.includes('cal-cell--libre');
            const dataAttr = canCreate ? `data-fecha="${dStr}" data-hora="${hora}"` : '';
            html += `<td class="${cls}" ${dataAttr} style="${cls==='cal-cell' ? 'background:#f9fafb;cursor:not-allowed;' : ''}">${content}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    $('calGrid').innerHTML = html;

    document.querySelectorAll('.cal-cell--libre[data-fecha]').forEach(td => {
        td.addEventListener('click', () => abrirModalTurno(null, td.dataset.fecha, td.dataset.hora));
    });
}

// ════════════════════════════════════════════════════════
// TURNOS
// ════════════════════════════════════════════════════════
let _editTurnoId = null;
let _turnoPersonaId = null;
let _cancelTurnoId = null;

function initTurnos() {
    $('turnoFiltroFecha').value = new Date().toISOString().slice(0, 10);
    popularSelectEspacios('turnoFiltroEspacio');
    [$('turnoFiltroFecha'), $('turnoFiltroEspacio'), $('turnoFiltroEstado')].forEach(el => el.addEventListener('change', renderTurnos));
    $('btnNuevoTurno').addEventListener('click', () => abrirModalTurno(null));
    $('btnCancelarTurnoModal').addEventListener('click', () => { $('modalTurno').hidden = true; });
    $('btnCancelarTurnoForm').addEventListener('click', () => { $('modalTurno').hidden = true; });
    $('formTurno').addEventListener('submit', e => { e.preventDefault(); guardarTurno(); });
    $('btnBuscarPersonaTurno').addEventListener('click', buscarPersonaTurno);
    $('btnRegistrarPersonaTurno').addEventListener('click', registrarPersonaInlineTurno);
    $('t_espacio').addEventListener('change', popularAgentesEnTurno);
    $('btnCancelCancelTurno').addEventListener('click', () => { $('modalCancelarTurno').hidden = true; });
    $('btnCancelCancelTurnoX').addEventListener('click', () => { $('modalCancelarTurno').hidden = true; });
    $('btnConfirmarCancelTurno').addEventListener('click', confirmarCancelTurno);
}

function popularSelectEspacios(selId) {
    const sel = document.getElementById(selId); if (!sel) return;
    const primero = sel.options[0];
    sel.innerHTML = ''; 
    if (primero) sel.appendChild(primero);
    const todos = Store.espacios().filter(e => e.activo);
    const padres = todos.filter(e => e.id_espacio_padre === null);
    
    padres.forEach(p => {
        const hijos = todos.filter(h => h.id_espacio_padre === p.id);
        if (hijos.length === 0) return; // No tiene subespacios
        
        const grp = document.createElement('optgroup');
        grp.label = p.nombre;
        
        hijos.forEach(h => {
            const o = document.createElement('option'); 
            o.value = h.id; 
            o.textContent = h.nombre + (h.tipo === 'DESATENDIDO' ? ' (Campo)' : ' (Consultorio)'); 
            grp.appendChild(o);
        });
        sel.appendChild(grp);
    });
}

function popularAgentesEnTurno() {
    const espId = +$('t_espacio').value;
    const sel = $('t_agente'); sel.innerHTML = '<option value="">— Sin agente —</option>';
    const esp = Store.espacios().find(e => e.id === espId);
    if (!esp || esp.tipo === 'DESATENDIDO') return;
    Store.agEsp().filter(a => a.espacio_id === espId && a.activo).forEach(a => {
        const o = document.createElement('option'); o.value = a.usuario_id;
        o.textContent = 'Agente #' + a.usuario_id; sel.appendChild(o);
    });
}

function abrirModalTurno(turnoId, fecha = '', hora = '') {
    _editTurnoId = turnoId; _turnoPersonaId = null;
    $('modalTurnoTitle').textContent = turnoId ? 'Editar Turno' : 'Nuevo Turno';
    popularSelectEspacios('t_espacio');
    $('bupResultTurno').hidden = true;
    $('altaInlineBoxTurno').hidden = true;
    $('turnoConflicto').hidden = true;
    $('turnoError').hidden = true;
    if (fecha) $('t_fecha').value = fecha;
    if (hora) $('t_hora').value = hora;
    $('modalTurno').hidden = false;
}

function buscarPersonaTurno() {
    const tipo = $('t_tipo_doc').value, nro = $('t_nro_doc').value.trim(), sexo = $('t_sexo').value;
    const res = $('bupResultTurno');
    // Si el campo parece apellido (no numérico), buscar por apellido
    if (nro && isNaN(nro.replace(/\s/g, ''))) {
        const lista = Store.findPersonasByApellido(nro);
        if (lista.length === 1) {
            _turnoPersonaId = lista[0].id;
            res.innerHTML = `<div class="bup-found">✅ ${lista[0].apellido}, ${lista[0].nombre} — ${lista[0].tipo_doc} ${lista[0].nro_doc}</div>`;
        } else if (lista.length > 1) {
            _turnoPersonaId = null;
            res.innerHTML = `<div style="color:var(--text1)">Seleccione una persona:</div>` +
                lista.map(p => `<div class="bup-found" style="cursor:pointer;margin:.2rem 0" data-pid="${p.id}">✅ ${p.apellido}, ${p.nombre} — ${p.tipo_doc} ${p.nro_doc}</div>`).join('');
            res.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
                const p = Store.personas().find(x => x.id === +el.dataset.pid);
                _turnoPersonaId = p.id;
                res.innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} — ${p.tipo_doc} ${p.nro_doc}</div>`;
            }));
        } else {
            _turnoPersonaId = null;
            res.innerHTML = `<div class="bup-notfound">❌ Sin resultados para apellido "${nro}"</div>`;
        }
        res.hidden = false; return;
    }
    const p = Store.findPersona(tipo, nro, sexo);
    if (p && p.activo) {
        _turnoPersonaId = p.id;
        res.innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} — ${tipo} ${p.nro_doc}</div>`;
        $('altaInlineBoxTurno').hidden = true;
    } else {
        _turnoPersonaId = null;
        res.innerHTML = `<div class="bup-notfound">❌ No encontrado en BUP o registro inactivo</div>`;
        $('ait_tipo').value = tipo; $('ait_nro').value = nro; $('ait_sexo').value = sexo;
        $('ait_nombre').value = ''; $('ait_apellido').value = ''; $('ait_tel').value = '';
        $('altaErrorTurno').hidden = true;
        $('altaInlineBoxTurno').hidden = false;
    }
    res.hidden = false;
}

function registrarPersonaInlineTurno() {
    const nombre = $('ait_nombre').value.trim(), apellido = $('ait_apellido').value.trim();
    const tipo = $('ait_tipo').value, nro = $('ait_nro').value.trim(), sexo = $('ait_sexo').value;
    const tel = $('ait_tel').value.trim();
    const err = $('altaErrorTurno');
    if (!nombre || !apellido || !tipo || !nro) { err.textContent = 'Nombre, apellido, tipo y nro. de documento son obligatorios.'; err.hidden = false; return; }
    
    const p = Store.savePersona({
        nombre, apellido, tipo_doc: tipo, nro_doc: nro, sexo, telefono: tel,
        activo: true, created_at: new Date().toISOString()
    });
    
    _turnoPersonaId = p.id;
    err.hidden = true;
    $('altaInlineBoxTurno').hidden = true;
    $('bupResultTurno').innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} registrado y seleccionado.</div>`;
    $('bupResultTurno').hidden = false;
}

function verificarConflictoPersona(personaId, fechaHora, durMin, excludeId = null) {
    const fin = new Date(new Date(fechaHora).getTime() + durMin * 60000);
    return Store.turnos().some(t => {
        if (t.persona_id !== personaId || t.estado === 'CANCELADO') return false;
        if (excludeId && t.id === excludeId) return false;
        const tf = new Date(t.fecha_hora), tf2 = new Date(tf.getTime() + t.duracion_min * 60000);
        return tf < fin && tf2 > new Date(fechaHora);
    });
}

async function guardarTurno() {
    if (!_turnoPersonaId) { $('turnoError').textContent = 'Debe buscar y seleccionar una persona BUP.'; $('turnoError').hidden = false; return; }
    const espId = +$('t_espacio').value, fecha = $('t_fecha').value, hora = $('t_hora').value;
    const dur = +$('t_duracion').value, agenteId = +$('t_agente').value || null;
    if (!espId || !fecha || !hora) { $('turnoError').textContent = 'Complete espacio, fecha y hora.'; $('turnoError').hidden = false; return; }
    
    // Convertir de local a ISO
    const dStr = `${fecha}T${hora}:00`;
    const d = new Date(dStr);
    const dFin = new Date(d.getTime() + dur * 60000);
    
    if (verificarConflictoPersona(_turnoPersonaId, dStr, dur, _editTurnoId)) {
        $('turnoConflicto').textContent = '⚠ La persona ya tiene un turno o entrada en ese horario.';
        $('turnoConflicto').hidden = false; return;
    }
    
    const boton = document.querySelector('#formTurno button[type="submit"]');
    boton.disabled = true; boton.textContent = 'Guardando...';

    try {
        await Store.saveTurno({
            id: _editTurnoId || undefined,
            persona_id: _turnoPersonaId,
            espacio_id: espId,
            usuario_agente_id: agenteId,
            fecha_hora_inicio: d.toISOString(),
            fecha_hora_fin: dFin.toISOString(),
            notas_usuario: 'Creado desde UI web'
        });
        generarAutoIncidente(_turnoPersonaId, 'Turno Nuevo', `Se registró un turno para la fecha ${fecha} a las ${hora}.`);
        $('modalTurno').hidden = true;
        renderCalendario(); renderTurnos();
        showToast('✅ Turno registrado en API ZARIS', 'ok');
    } catch (err) {
        $('turnoError').textContent = err.message || 'Error al guardar el turno.';
        $('turnoError').hidden = false;
    } finally {
        boton.disabled = false; boton.textContent = '💾 Confirmar turno';
    }
}

function renderTurnos() {
    const fecha = $('turnoFiltroFecha').value;
    const espId = +$('turnoFiltroEspacio').value || null;
    const estado = $('turnoFiltroEstado').value;
    let data = Store.turnos();
    if (fecha) data = data.filter(t => t.fecha_hora?.startsWith(fecha));
    if (espId) data = data.filter(t => t.espacio_id === espId);
    if (estado) data = data.filter(t => t.estado === estado);

    $('turnosVacio').hidden = data.length > 0;
    const tbody = $('tablaTurnosBody'); tbody.innerHTML = '';
    data.forEach(t => {
        const p = Store.personas().find(x => x.id === t.persona_id);
        const esp = Store.espacios().find(x => x.id === t.espacio_id);
        const tr = document.createElement('tr');
        const stClss = { 'PENDIENTE': 'st-pend', 'CONFIRMADO': 'st-ok', 'COMPLETADO': 'st-comp', 'CANCELADO': 'st-inact' }[t.estado] || '';
        tr.innerHTML = `<td>${fmtFechaHora(t.fecha_hora)}</td>
      <td>${p ? p.apellido + ', ' + p.nombre : '—'}</td>
      <td>${esp?.nombre || '—'}</td>
      <td>${t.agente_id ? 'Agente #' + t.agente_id : '—'}</td>
      <td><span class="${stClss}">${t.estado}</span></td>
      <td>
        <div style="display:flex; gap:.3rem; justify-content:flex-end">
            ${p ? `<a href="hc.html?dni=${p.nro_doc}&sexo=${p.sexo}" class="btn btn--primary btn--sm" style="text-decoration:none">🩺 Atender</a>` : ''}
            ${t.estado !== 'CANCELADO' && t.estado !== 'COMPLETADO' ? `<button class="btn btn--outline btn--sm" data-cancelar="${t.id}">✕</button>` : ''}
        </div>
      </td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-cancelar]').forEach(b => b.addEventListener('click', () => abrirCancelarTurno(+b.dataset.cancelar)));
}

function abrirCancelarTurno(id) {
    const t = Store.turnos().find(x => x.id === id); if (!t) return;
    const diff = (new Date(t.fecha_hora) - new Date()) / 3600000;
    if (diff < 4) { showToast('⚠ No se puede cancelar con menos de 4 horas de anticipación', 'warn'); return; }
    _cancelTurnoId = id;
    const p = Store.personas().find(x => x.id === t.persona_id);
    $('cancelarTurnoInfo').textContent = `Turno de ${p ? p.apellido + ', ' + p.nombre : '—'} el ${fmtFechaHora(t.fecha_hora)}`;
    $('motivoCancelTurno').value = '';
    $('cancelTurnoError').hidden = true;
    $('modalCancelarTurno').hidden = false;
}

async function confirmarCancelTurno() {
    const motivo = $('motivoCancelTurno').value.trim();
    if (!motivo) { $('cancelTurnoError').textContent = 'El motivo es obligatorio.'; $('cancelTurnoError').hidden = false; return; }
    
    const boton = $('btnConfirmarCancelTurno');
    boton.disabled = true; boton.textContent = 'Procesando...';

    try {
        await Store.cancelarTurnoAPI(_cancelTurnoId, motivo);
        $('modalCancelarTurno').hidden = true;
        renderTurnos(); renderCalendario();
        showToast('Turno cancelado en API Zaris', 'ok');
    } catch (err) {
        $('cancelTurnoError').textContent = err.message || 'Error al cancelar.';
        $('cancelTurnoError').hidden = false;
    } finally {
        boton.disabled = false; boton.textContent = 'Cancelar turno';
    }
}

// ════════════════════════════════════════════════════════
// EVENTOS y ENTRADAS
// ════════════════════════════════════════════════════════
let _eventoEntradaId = null;
let _entradaPersonaId = null;

function initEventos() {
    $('btnNuevoEvento').addEventListener('click', () => abrirModalEvento(null));
    $('btnCancelarEvento').addEventListener('click', () => { $('modalEvento').hidden = true; });
    $('btnCancelarEventoX').addEventListener('click', () => { $('modalEvento').hidden = true; });
    $('formEvento').addEventListener('submit', e => { e.preventDefault(); guardarEvento(); });
    popularSelectEspacios('ev_espacio');
    $('btnCancelarEntrada').addEventListener('click', () => { $('modalEntrada').hidden = true; });
    $('btnCancelarEntradaX').addEventListener('click', () => { $('modalEntrada').hidden = true; });
    $('btnBuscarPersonaEntrada').addEventListener('click', buscarPersonaEntrada);
    $('btnRegistrarPersonaEntrada').addEventListener('click', registrarPersonaInlineEntrada);
    $('btnEmitirEntrada').addEventListener('click', emitirEntrada);
    $('btnCerrarQR').addEventListener('click', () => { $('modalQR').hidden = true; });
    $('btnCerrarQRX').addEventListener('click', () => { $('modalQR').hidden = true; });
    $('btnImprimirQR').addEventListener('click', () => window.print());
}

function renderEventos() {
    const lista = $('eventosLista');
    const data = Store.eventos().filter(e => e.activo);
    if (!data.length) { lista.innerHTML = '<div class="empty-msg"><span class="empty-icon">🎟</span><p>No hay eventos activos.</p></div>'; return; }
    lista.innerHTML = data.map(ev => {
        const esp = Store.espacios().find(e => e.id === ev.espacio_id);
        const emitidas = Store.entradas().filter(e => e.evento_id === ev.id && e.estado !== 'CANCELADA').length;
        const disponibles = ev.cupo_maximo - emitidas;
        const pct = Math.min(100, Math.round(emitidas / ev.cupo_maximo * 100));
        const stClss = { 'ACTIVO': 'st-ok', 'CANCELADO': 'st-inact', 'FINALIZADO': 'st-comp' }[ev.estado] || '';
        return `<div class="evento-card">
      <div class="evento-card-header">
        <div>
          <div class="evento-nombre">${ev.nombre}</div>
          <div class="evento-meta">📍 ${esp?.nombre || '—'} &nbsp;·&nbsp; 🗓 ${fmtFechaHora(ev.fecha_hora)} &nbsp;·&nbsp; ⏱ ${ev.duracion_min} min</div>
          ${ev.descripcion ? `<div class="evento-desc">${ev.descripcion}</div>` : ''}
        </div>
        <span class="${stClss}">${ev.estado}</span>
      </div>
      <div class="cupo-container">
        <div class="cupo-bar"><div class="cupo-fill" style="width:${pct}%"></div></div>
        <span class="cupo-label">${emitidas}/${ev.cupo_maximo} entradas &nbsp;·&nbsp; ${disponibles} disponibles</span>
      </div>
      <div class="evento-actions">
        ${ev.estado === 'ACTIVO' && disponibles > 0 && Auth.esColab() ? `<button class="btn btn--primary btn--sm" data-entrada="${ev.id}">🎟 Emitir entrada</button>` : ''}
        ${Auth.esAdmin() && ev.estado === 'ACTIVO' ? `<button class="btn btn--danger btn--sm" data-cancelar-ev="${ev.id}">✕ Cancelar evento</button>` : ''}
      </div>
    </div>`;
    }).join('');

    lista.querySelectorAll('[data-entrada]').forEach(b => b.addEventListener('click', () => abrirModalEntrada(+b.dataset.entrada)));
    lista.querySelectorAll('[data-cancelar-ev]').forEach(b => b.addEventListener('click', () => cancelarEvento(+b.dataset.cancelarEv)));
}

function abrirModalEvento(id) {
    popularSelectEspacios('ev_espacio');
    $('modalEventoTitle').textContent = id ? 'Editar Evento' : 'Nuevo Evento';
    if (!id) { ['ev_nombre', 'ev_descripcion'].forEach(f => { $(f).value = ''; }); $('ev_cupo').value = 50; $('ev_duracion').value = 60; $('ev_fecha').value = new Date().toISOString().slice(0, 10); }
    $('eventoError').hidden = true; $('modalEvento').hidden = false;
}

async function guardarEvento() {
    const nombre = $('ev_nombre').value.trim();
    if (!nombre || !$('ev_espacio').value || !$('ev_fecha').value) { $('eventoError').textContent = 'Complete todos los campos obligatorios.'; $('eventoError').hidden = false; return; }
    
    // Parse fecha UTC simple
    const dStr = `${$('ev_fecha').value}T${$('ev_hora').value || '09:00'}:00`;
    const dIni = new Date(dStr);
    const dur = +$('ev_duracion').value || 60;
    const dFin = new Date(dIni.getTime() + dur * 60000);
    
    const boton = document.querySelector('#formEvento button[type="submit"]');
    boton.disabled = true; boton.textContent = 'Guardando...';

    try {
        await Store.saveEvento({
            id: undefined,
            titulo: nombre,
            descripcion: $('ev_descripcion').value.trim(),
            espacio_id: +$('ev_espacio').value,
            fecha_inicio: dIni.toISOString(),
            fecha_fin: dFin.toISOString(),
            cupo_maximo: +$('ev_cupo').value || 50,
            estado: 'ACTIVO'
        });
        $('modalEvento').hidden = true; renderEventos();
        showToast('✅ Evento creado en la Base', 'ok');
    } catch (e) {
        $('eventoError').textContent = e.message || 'Fallo API creación evento';
        $('eventoError').hidden = false;
    } finally {
        boton.disabled = false; boton.textContent = '💾 Crear evento';
    }
}

async function cancelarEvento(id) {
    if (!confirm('¿Cancelar este evento? Se notificará automáticamente a los inscriptos.')) return;
    try {
        await Store.cancelarEventoAPI(id);
        renderEventos();
        showToast(`✅ Evento cancelado exitosamente.`, 'warn', 6000);
    } catch(e) {
        showToast('Error cancelando evento: ' + e.message, 'error');
    }
}

function abrirModalEntrada(eventoId) {
    _eventoEntradaId = eventoId; _entradaPersonaId = null;
    const ev = Store.eventos().find(e => e.id === eventoId); if (!ev) return;
    $('entradaEventoInfo').textContent = `Evento: ${ev.nombre} — ${fmtFechaHora(ev.fecha_hora)}`;
    $('bupResultEntrada').hidden = true; $('entradaError').hidden = true;
    $('altaInlineBoxEntrada').hidden = true;
    $('btnEmitirEntrada').disabled = true; $('en_doc').value = '';
    $('modalEntrada').hidden = false;
}

function buscarPersonaEntrada() {
    const tipo = $('en_tipo').value, nro = $('en_doc').value.trim(), sexo = $('en_sexo').value;
    const p = Store.findPersona(tipo, nro, sexo);
    const res = $('bupResultEntrada');
    if (!p || !p.activo) {
        _entradaPersonaId = null;
        res.innerHTML = `<div class="bup-notfound">❌ No encontrado en BUP o registro inactivo</div>`;
        res.hidden = false; $('btnEmitirEntrada').disabled = true; 
        $('aie_tipo').value = tipo; $('aie_nro').value = nro; $('aie_sexo').value = sexo;
        $('aie_nombre').value = ''; $('aie_apellido').value = ''; $('aie_tel').value = '';
        $('altaErrorEntrada').hidden = true;
        $('altaInlineBoxEntrada').hidden = false;
        return;
    }
    const yaEmitidas = Store.entradas().filter(e => e.persona_id === p.id && e.evento_id === _eventoEntradaId && e.estado !== 'CANCELADA').length;
    if (yaEmitidas >= 2) {
        res.innerHTML = `<div class="bup-notfound">⚠ Esta persona ya tiene ${yaEmitidas} entrada/s (máximo 2 por evento).</div>`;
        res.hidden = false; $('btnEmitirEntrada').disabled = true; $('altaInlineBoxEntrada').hidden = true; return;
    }
    const ev = Store.eventos().find(e => e.id === _eventoEntradaId);
    if (ev && verificarConflictoPersona(p.id, ev.fecha_hora, ev.duracion_min)) {
        res.innerHTML = `<div class="bup-notfound">⚠ La persona tiene un turno en conflicto con este evento.</div>`;
        res.hidden = false; $('btnEmitirEntrada').disabled = true; $('altaInlineBoxEntrada').hidden = true; return;
    }
    _entradaPersonaId = p.id;
    res.innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} — ${tipo} ${p.nro_doc}<br><small>Entradas previas para este evento: ${yaEmitidas}/2</small></div>`;
    res.hidden = false; $('btnEmitirEntrada').disabled = false; $('altaInlineBoxEntrada').hidden = true;
}

function registrarPersonaInlineEntrada() {
    const nombre = $('aie_nombre').value.trim(), apellido = $('aie_apellido').value.trim();
    const tipo = $('aie_tipo').value, nro = $('aie_nro').value.trim(), sexo = $('aie_sexo').value;
    const tel = $('aie_tel').value.trim();
    const err = $('altaErrorEntrada');
    if (!nombre || !apellido || !tipo || !nro) { err.textContent = 'Nombre, apellido, tipo y nro. de documento son obligatorios.'; err.hidden = false; return; }
    
    const p = Store.savePersona({
        nombre, apellido, tipo_doc: tipo, nro_doc: nro, sexo, telefono: tel,
        activo: true, created_at: new Date().toISOString()
    });
    
    _entradaPersonaId = p.id;
    err.hidden = true;
    $('altaInlineBoxEntrada').hidden = true;
    $('btnEmitirEntrada').disabled = false;
    $('bupResultEntrada').innerHTML = `<div class="bup-found">✅ ${p.apellido}, ${p.nombre} registrado y seleccionado.</div>`;
    $('bupResultEntrada').hidden = false;
}

function emitirEntrada() {
    if (!_entradaPersonaId || !_eventoEntradaId) return;
    const u = Auth.get();
    const codigoQR = 'ZRS-' + uuid();
    Store.saveEntrada({
        persona_id: _entradaPersonaId, evento_id: _eventoEntradaId, codigo_qr: codigoQR,
        usuario_emisor: u.email, estado: 'EMITIDA', ts: Date.now()
    });
    
    // Autoincidente
    const ev = Store.eventos().find(e => e.id === _eventoEntradaId);
    generarAutoIncidente(_entradaPersonaId, 'Emisión de Entrada', `Se emitió 1 entrada para el evento "${ev?.nombre}" con código QR: ${codigoQR}`);

    $('modalEntrada').hidden = true;
    abrirModalQR(codigoQR, _entradaPersonaId);
}

// ════════════════════════════════════════════════════════
// CRM INTEGRATION: AUTO-INCIDENTES
// ════════════════════════════════════════════════════════
function generarAutoIncidente(personaId, accion, desc) {
    try {
        let incs = JSON.parse(localStorage.getItem('crm_incidentes')) || [];
        let obs = JSON.parse(localStorage.getItem('crm_observaciones')) || [];
        let tipos = JSON.parse(localStorage.getItem('crm_tipos')) || [];
        let canales = JSON.parse(localStorage.getItem('crm_canales')) || [];

        const canal = canales.find(c => c.nombre && c.nombre.includes('Web')) || canales[0] || { id: 1 };
        let tipo = tipos.find(t => t.nombre && (t.nombre.includes('Turno') || t.nombre.includes('Agenda')));
        if (!tipo) tipo = tipos[0] || { id: 1 };

        const nid = incs.length ? Math.max(...incs.map(x => x.id || 0)) + 1 : 1;
        const ahora = new Date().toISOString();
        const nroRef = 'AUTO-' + String(nid).padStart(5, '0');

        const inc = {
            id: nid, persona_id: personaId, id_tipo: tipo.id, id_canal: canal.id,
            id_estado: 'PENDIENTE', descripcion: desc, ubicacion_calle: '', ubicacion_altura: '',
            id_incidente_padre: null, id_usuario_creador: 'SISTEMA_AGENDA',
            fecha_limite_sla: null, created_at: ahora, updated_at: ahora,
            nro_referencia: nroRef
        };
        incs.push(inc);
        localStorage.setItem('crm_incidentes', JSON.stringify(incs));

        const obsId = obs.length ? Math.max(...obs.map(x => x.id || 0)) + 1 : 1;
        obs.push({
            id: obsId, id_incidente: nid, usuario: 'SISTEMA_AGENDA', tipo: 'CREACION_AUTOMATICA',
            texto: `[Auto-Incidente] ${accion} generado desde el Módulo de Agenda.\n\n${desc}`,
            estado_nuevo: 'PENDIENTE', created_at: ahora
        });
        localStorage.setItem('crm_observaciones', JSON.stringify(obs));
    } catch(e) { console.error("Error injectando auto-incidente", e); }
}

function abrirModalQR(codigo, pId) {
    renderEventos();
    // The original mostrarQR logic should be here to actually display the QR modal
    const p = Store.personas().find(x => x.id === pId);
    const ev = Store.eventos().find(x => x.id === _eventoEntradaId); // _eventoEntradaId is still in scope
    $('qrPersonaInfo').textContent = `${p ? p.apellido + ', ' + p.nombre : '—'} — ${ev?.nombre || '—'}`;
    $('qrCodeText').textContent = codigo;
    $('qrCodeDiv').innerHTML = '';
    try { new QRCode($('qrCodeDiv'), { text: codigo, width: 180, height: 180, colorDark: '#000', colorLight: '#fff' }); }
    catch { $('qrCodeDiv').innerHTML = `<code style="font-size:.7rem;word-break:break-all">${codigo}</code>`; }
    $('modalQR').hidden = false;
}

function mostrarQR(codigoQR, personaId, eventoId) {
    const p = Store.personas().find(x => x.id === personaId);
    const ev = Store.eventos().find(x => x.id === eventoId);
    $('qrPersonaInfo').textContent = `${p ? p.apellido + ', ' + p.nombre : '—'} — ${ev?.nombre || '—'}`;
    $('qrCodeText').textContent = codigoQR;
    $('qrCodeDiv').innerHTML = '';
    try { new QRCode($('qrCodeDiv'), { text: codigoQR, width: 180, height: 180, colorDark: '#000', colorLight: '#fff' }); }
    catch { $('qrCodeDiv').innerHTML = `<code style="font-size:.7rem;word-break:break-all">${codigoQR}</code>`; }
    $('modalQR').hidden = false;
}

// ════════════════════════════════════════════════════════
// LISTA DE ESPERA
// ════════════════════════════════════════════════════════
function initEspera() {
    popularSelectEspacios('esperaFiltroEspacio');
    [$('esperaFiltroEspacio'), $('esperaFiltroFecha')].forEach(el => el.addEventListener('change', renderEspera));
}

function renderEspera() {
    const espId = +$('esperaFiltroEspacio').value || null;
    const fecha = $('esperaFiltroFecha').value;
    let data = Store.espera();
    if (espId) data = data.filter(e => e.espacio_id === espId);
    if (fecha) data = data.filter(e => e.fecha_deseada === fecha);
    $('esperaVacio').hidden = data.length > 0;
    const tbody = $('tablaEsperaBody'); tbody.innerHTML = '';
    data.sort((a, b) => a.orden - b.orden).forEach(e => {
        const p = Store.personas().find(x => x.id === e.persona_id);
        const esp = Store.espacios().find(x => x.id === e.espacio_id);
        const stCls = { 'EN_ESPERA': 'st-pend', 'ADJUDICADA': 'st-ok', 'VENCIDA': 'st-inact' }[e.estado] || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${e.orden}</td>
      <td>${p ? p.apellido + ', ' + p.nombre : 'Persona #' + e.persona_id}</td>
      <td>${esp?.nombre || '—'}</td><td>${e.fecha_deseada}</td>
      <td><span class="${stCls}">${e.estado}</span></td>
      <td>${e.estado === 'EN_ESPERA' ? `<button class="btn btn--primary btn--sm" data-adjudicar="${e.id}">Adjudicar</button>` : '—'}</td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-adjudicar]').forEach(b => b.addEventListener('click', () => {
        const item = Store.espera().find(x => x.id === +b.dataset.adjudicar);
        if (item) { Store.saveEspera({ ...item, estado: 'ADJUDICADA', updated_at: new Date().toISOString() }); renderEspera(); showToast('✅ Adjudicado', 'ok'); }
    }));
}

// ════════════════════════════════════════════════════════
// INCIDENTES (stub CRM)
// ════════════════════════════════════════════════════════
function renderIncidentes() {
    const data = Store.incidentes();
    const tbody = $('tablaIncidentesBody'); tbody.innerHTML = '';
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-td">No hay incidentes pendientes.</td></tr>'; return; }
    data.forEach(inc => {
        const eq = Store.equipos().find(e => e.id === inc.equipo_id);
        const stCls = { 'EN_ESPERA': 'st-pend', 'ASIGNADO': 'st-ok', 'EN_CURSO': 'st-comp', 'CERRADO': 'st-inact' }[inc.estado] || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="font-family:var(--mono);font-size:.78rem">${inc.incidente_ref}</td>
      <td>${inc.descripcion || '—'}</td><td>${eq?.nombre || '—'}</td>
      <td><span class="${stCls}">${inc.estado}</span></td><td>—</td>`;
        tbody.appendChild(tr);
    });
}

