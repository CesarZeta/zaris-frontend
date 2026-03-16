/* ============================================================
   ZARIS v2 — app.js
   Base Única de Personas
   ============================================================ */
'use strict';

// ════════════════════════════════════════════════════════
// 1. AUTH — usuarios con contraseña, roles pre-configurados
// ════════════════════════════════════════════════════════
const Auth = (() => {
    const KEY_SESSION = 'zaris_session';
    const API_URL = 'https://zaris-api-production-bf0b.up.railway.app/api';

    const PERMISOS = {
        CONSULTA: { ver: true, alta: false, modificar: false, baja: false, exportar: false, padrones: false },
        COLABORADOR: { ver: true, alta: true, modificar: true, baja: false, exportar: true, padrones: false },
        ADMINISTRADOR: { ver: true, alta: true, modificar: true, baja: true, exportar: true, padrones: true },
    };

    function _initUsers() {
        // Obsoleto: los usuarios ahora provienen de la BD PostgreSQL vía FastAPI
    }

    async function login(email, password) {
        try {
            const resp = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password: password })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || 'Error de autenticación');
            }

            const data = await resp.json();
            const nombreCompleto = `${data.usuario.nombre} ${data.usuario.apellido}`;
            const session = {
                token: data.access_token,
                id: data.usuario.id,
                email: data.usuario.email,
                nombre: data.usuario.nombre,
                apellido: data.usuario.apellido,
                rol: data.usuario.rol || 'CONSULTA',
                iniciales: _iniciales(nombreCompleto),
                ts: Date.now()
            };
            localStorage.setItem(KEY_SESSION, JSON.stringify(session));
            return session;
        } catch (e) {
            console.error('Login error:', e);
            throw e;
        }
    }

    function getUsuario() {
        try { return JSON.parse(localStorage.getItem(KEY_SESSION)); } catch { return null; }
    }

    function puede(accion) {
        const u = getUsuario();
        if (!u) return false;
        return !!PERMISOS[u.rol]?.[accion];
    }

    function logout() { localStorage.removeItem(KEY_SESSION); localStorage.removeItem('bds_usuario'); }

    function recuperarPassword(email) {
        // Pendiente de implementar endpoint en backend
        console.info(`[ZARIS] Recupero para ${email} no implementado con backend aún.`);
        return false;
    }

    function _iniciales(nombre) {
        return nombre.trim().split(/\s+/).map(p => p[0].toUpperCase()).slice(0, 2).join('');
    }
    
    function getToken() {
        const u = getUsuario();
        return u ? u.token : null;
    }

    return { login, getUsuario, puede, logout, recuperarPassword, initUsers: _initUsers, getToken };
})();


// ════════════════════════════════════════════════════════
// 2. STORE — Conexión con Backend FastAPI
// ════════════════════════════════════════════════════════
const Store = (() => {
    const K = {
        audit: 'zaris_audit' // Auditoría simple local por ahora
    };
    
    // Obtenemos API_URL desde Auth o lo hardcodeamos aquí si falla
    const API_URL = 'https://zaris-api-production-bf0b.up.railway.app/api';

    async function _fetchAuth(endpoint, options = {}) {
        const token = Auth.getToken();
        if (!token) throw new Error("No hay sesión activa.");
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };
        
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Error HTTP: ${response.status}`);
        }
        return response.json();
    }

    // --- Personas ---

    async function getPersonas() { 
        return await _fetchAuth('/personas/buscar'); 
    }
    
    // No usado activamente en la UI con fetch directo (se llama a backend directamente), pero se mantiene firma para compatibilidad
    function setPersonas(arr) { console.warn("setPersonas() obsoleto. El backend administra la persistencia."); }

    async function findPersona(tipo_doc, nro_doc, sexo) {
        // En BUP real buscamos por DNI, no hace falta tipo_doc y sexo en el endpoint simple,
        // pero mapeamos a /personas/buscar?dni=...
        const res = await _fetchAuth(`/personas/buscar?dni=${nro_doc}`);
        if (res && res.length > 0) {
            // Filtrar exactamente si hace falta
            return res.find(p => p.sexo === sexo) || res[0];
        }
        return null;
    }

    async function savePersona(datos) {
        if (datos.id) {
            return await _fetchAuth(`/personas/${datos.id}`, {
                method: 'PUT',
                body: JSON.stringify(datos)
            });
        } else {
            return await _fetchAuth('/personas', {
                method: 'POST',
                body: JSON.stringify(datos)
            });
        }
    }

    // --- Padrones ---
    // Caché local para padrones para evitar consultas constantes
    const padronCache = {};

    async function getPadron(nombre) { 
        if (padronCache[nombre]) return padronCache[nombre];
        let endpoint = '';
        if (nombre === 'paises') endpoint = '/padrones/paises';
        else if (nombre === 'provincias') endpoint = '/padrones/provincias/1'; // Por defecto Argentina (id=1)
        else if (nombre === 'localidades') endpoint = '/padrones/localidades'; 
        else if (nombre === 'combos') endpoint = '/padrones/generales';
        else return [];

        try {
            const data = await _fetchAuth(endpoint);
            padronCache[nombre] = data;
            return data;
        } catch (e) {
            console.error(`Error loading padron ${nombre}:`, e);
            return [];
        }
    }

    // --- Auditoría Local (Transicional) ---
    function logAudit(entry) {
        try {
            const log = JSON.parse(localStorage.getItem(K.audit)) || [];
            log.unshift({ ...entry, ts: new Date().toISOString() });
            localStorage.setItem(K.audit, JSON.stringify(log.slice(0, 500)));
        } catch {}
    }
    function getAudit() { 
        try { return JSON.parse(localStorage.getItem(K.audit)) || []; } 
        catch { return []; }
    }

    return {
        getPersonas, setPersonas, findPersona, savePersona,
        logAudit, getAudit, getPadron
    };
})();


// ════════════════════════════════════════════════════════
// 3. NORMALIZACIÓN DE TELÉFONOS (JavaScript)
// ════════════════════════════════════════════════════════
const Tel = (() => {
    const AREAS = {
        '11': 8, '221': 7, '223': 7, '261': 7, '264': 7, '266': 7, '280': 7, '291': 7,
        '294': 7, '297': 7, '299': 7, '341': 7, '342': 7, '343': 7, '351': 7, '353': 7,
        '358': 7, '362': 7, '370': 7, '376': 7, '379': 7, '381': 7, '383': 7, '385': 7, '387': 7, '388': 7,
    };

    function normalizar(raw) {
        const orig = (raw || '').trim();
        if (!orig) return { tipo: '', fmt: '', valido: false };
        let d = orig.replace(/\D/g, '');
        if (d.length < 5) return { tipo: 'invalido', fmt: orig, valido: false };
        if (d.startsWith('0054')) d = d.slice(4);
        else if (d.startsWith('54') && d.length >= 12) d = d.slice(2);
        if (d.startsWith('0')) d = d.slice(1);
        if (/^(800|810|600)/.test(d)) return { tipo: 'gratuito', fmt: '0' + d.slice(0, 3) + '-' + d.slice(3), valido: true };
        if (d.startsWith('911') && d.length === 11) { const n = d.slice(3); return { tipo: 'celular_gba', fmt: '011 15-' + n.slice(0, 4) + '-' + n.slice(4), valido: true }; }
        if (d.startsWith('11') && d.length === 10) { const n = d.slice(2); return { tipo: 'fijo_gba', fmt: '011 ' + n.slice(0, 4) + '-' + n.slice(4), valido: true }; }
        if (d.startsWith('15') && d.length === 10) { const n = d.slice(2); return { tipo: 'celular_gba', fmt: '011 15-' + n.slice(0, 4) + '-' + n.slice(4), valido: true }; }
        if (d.length === 8) return { tipo: 'fijo_gba', fmt: '011 ' + d.slice(0, 4) + '-' + d.slice(4), valido: true };
        for (const al of [3, 2]) {
            const a = d.slice(0, al);
            if (AREAS[a]) {
                const r = d.slice(al), e = AREAS[a];
                if (r.startsWith('15') && r.length === e + 2) { const n = r.slice(2); return { tipo: 'celular_interior', fmt: '0' + a + ' 15-' + n.slice(0, Math.ceil(n.length / 2)) + '-' + n.slice(Math.ceil(n.length / 2)), valido: true }; }
                if (r.length === e) return { tipo: 'fijo_interior', fmt: '0' + a + ' ' + r.slice(0, Math.ceil(r.length / 2)) + '-' + r.slice(Math.ceil(r.length / 2)), valido: true };
            }
        }
        return { tipo: 'desconocido', fmt: orig, valido: false };
    }

    const EMOJI = { celular_gba: '📱', celular_interior: '📱', fijo_gba: '☎', fijo_interior: '☎', gratuito: '📞', invalido: '❌', desconocido: '❓' };
    function emoji(t) { return EMOJI[t] || ''; }

    return { normalizar, emoji };
})();


// ════════════════════════════════════════════════════════
// 4. GEOCODIFICACIÓN OSM — Nominatim
// ════════════════════════════════════════════════════════
const Geo = (() => {
    const cache = {};

    async function geocodificar(calle, numero, localidad, provincia = 'Buenos Aires') {
        const q = [calle, numero, localidad, provincia, 'Argentina'].filter(Boolean).join(', ');
        if (cache[q]) return cache[q];
        try {
            const res = await fetch('https://nominatim.openstreetmap.org/search?' +
                new URLSearchParams({ q, format: 'json', addressdetails: '1', limit: '5', countrycodes: 'ar', 'accept-language': 'es' }),
                { headers: { 'User-Agent': 'ZARIS-BaseUnicaPersonas/2.0' } });
            const data = await res.json();
            if (!data.length) return null;
            const r = data[0], addr = r.address || {};
            const result = {
                latitud: parseFloat(r.lat),
                longitud: parseFloat(r.lon),
                cp: addr.postcode || '',
                localidad_osm: addr.suburb || addr.city_district || addr.city || addr.town || addr.village || '',
                display: r.display_name,
                calle_norm: normCalle(calle),
            };
            cache[q] = result;
            return result;
        } catch { return null; }
    }

    function normCalle(s) {
        if (!s) return '';
        const min = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'en', 'al']);
        return s.toLowerCase().split(/\s+/).map((w, i) => (i === 0 || !min.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
    }

    return { geocodificar, normCalle };
})();


// ════════════════════════════════════════════════════════
// 5. UTILIDADES UI
// ════════════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function $q(sel, ctx = document) { return ctx.querySelector(sel); }
function $qa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showToast(msg, tipo = 'ok', dur = 4000) {
    const c = $('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast toast--' + tipo;
    t.setAttribute('role', 'alert');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 350); }, dur);
}

function showView(id) {
    $qa('.view').forEach(v => { v.hidden = true; v.classList.remove('view--active'); });
    $qa('.nav-btn').forEach(b => { b.classList.remove('nav-btn--active'); b.removeAttribute('aria-current'); });
    const view = $(id), btn = $q('[data-view="' + id.replace('view', '').toLowerCase() + '"]');
    if (view) { view.hidden = false; view.classList.add('view--active'); }
    if (btn) { btn.classList.add('nav-btn--active'); btn.setAttribute('aria-current', 'page'); }
}

function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDNI(n) { return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'; }


// ════════════════════════════════════════════════════════
// 6. DEMO DATA
// ════════════════════════════════════════════════════════
async function cargarDemoData() {
    // 1. Limpiamos cualquier rastro de la demo estática vieja en localStorage
    const localKeys = ['bds_personas', 'zaris_pad_paises', 'zaris_pad_provincias', 'zaris_pad_localidades', 'zaris_pad_combos'];
    localKeys.forEach(k => localStorage.removeItem(k));

    console.info('[ZARIS] Inicializando conexión con backend BUP (FastAPI)...');
    try {
        // Pre-cargamos los padrones desde el backend a la caché del Store para uso rápido
        await Promise.all([
            Store.getPadron('paises'),
            Store.getPadron('provincias'),
            Store.getPadron('localidades'),
            Store.getPadron('combos')
        ]);
        console.info('[ZARIS] Padrones BUP cargados correctamente desde el servidor.');
    } catch (error) {
        console.error('[ZARIS] Error al cargar padrones:', error);
        showToast('⚠ No se pudieron cargar los padrones del servidor', 'warn');
    }
}


// ════════════════════════════════════════════════════════
// 7. LOGIN UI — Login único desde home.html
// ════════════════════════════════════════════════════════
function initLogin() {
    const u = Auth.getUsuario();
    if (!u) {
        // Sin sesión activa → redirigir al portal de inicio (login único)
        document.body.style.visibility = 'hidden';
        location.replace('home.html');
        return;
    }
    // Sesión activa: ocultar overlay y cargar módulo
    const overlay = $('loginOverlay');
    if (overlay) overlay.hidden = true;
    renderUserChip();
    applyRoleUI();
    cargarDemoData();
}

function renderUserChip() {
    const u = Auth.getUsuario();
    if (!u) return;
    $('userAvatar').textContent = u.iniciales;
    $('userNombre').textContent = u.nombre + ' ' + u.apellido;
    $('userRol').textContent = u.rol;
    $('userRol').className = 'user-rol rol--' + u.rol.toLowerCase();
}

function applyRoleUI() {
    $('navPadrones').hidden = !Auth.puede('padrones');
    $('btnExportarCSV').hidden = !Auth.puede('exportar');
}


// ════════════════════════════════════════════════════════
// 8. NAV
// ════════════════════════════════════════════════════════
function initNav() {
    $qa('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = btn.dataset.view;
            showView('view' + v.charAt(0).toUpperCase() + v.slice(1));
            if (v === 'consulta') renderTablaConsulta();
            if (v === 'audit') renderAudit();
            if (v === 'padrones') renderPadrones('paises');
        });
    });
    $('btnLogout').addEventListener('click', () => { Auth.logout(); location.reload(); });
}


// ════════════════════════════════════════════════════════
// 9. WIDGETS — Teléfonos y Direcciones
// ════════════════════════════════════════════════════════
let _tels = [];
let _dirs = [];

function renderTelefonos() {
    const c = $('telefonosContainer');
    c.innerHTML = '';
    _tels.forEach((tel, i) => {
        const el = document.createElement('div');
        el.className = 'item-row';
        el.setAttribute('role', 'listitem');
        el.innerHTML =
            '<div class="item-fields">'
            + '<select class="form-control form-control--sm" data-ti="' + i + '" data-f="tipo" style="max-width:110px">'
            + '<option value="CEL"' + (tel.tipo === 'CEL' ? ' selected' : '') + '>📱 Celular</option>'
            + '<option value="FIJ"' + (tel.tipo === 'FIJ' ? ' selected' : '') + '>☎ Fijo</option>'
            + '<option value="LAB"' + (tel.tipo === 'LAB' ? ' selected' : '') + '>💼 Laboral</option>'
            + '<option value="EMR"' + (tel.tipo === 'EMR' ? ' selected' : '') + '>🚨 Emerg.</option>'
            + '</select>'
            + '<input type="text" class="form-control form-control--sm tel-input" value="' + (tel.numero_raw || '') + '" placeholder="Ej: 1164882709" data-ti="' + i + '" style="max-width:180px" />'
            + '<span class="tel-badge" id="telB_' + i + '"></span>'
            + '</div>'
            + '<button type="button" class="btn btn--outline btn--sm" data-rm="' + i + '" aria-label="Eliminar">✕</button>';
        c.appendChild(el);
        telBadge(i);
    });
    c.querySelectorAll('.tel-input').forEach(inp => {
        inp.addEventListener('blur', e => { _tels[+e.target.dataset.ti].numero_raw = e.target.value; telBadge(+e.target.dataset.ti); });
    });
    c.querySelectorAll('select[data-f="tipo"]').forEach(sel => {
        sel.addEventListener('change', e => { _tels[+e.target.dataset.ti].tipo = e.target.value; });
    });
    c.querySelectorAll('[data-rm]').forEach(btn => {
        btn.addEventListener('click', e => { _tels.splice(+e.target.dataset.rm, 1); renderTelefonos(); });
    });
}

function telBadge(i) {
    const tel = _tels[i], b = $('telB_' + i);
    if (!tel || !b) return;
    const r = Tel.normalizar(tel.numero_raw || '');
    if (r.valido) {
        b.textContent = Tel.emoji(r.tipo) + ' ' + r.fmt;
        b.className = 'tel-badge tel-badge--ok';
    } else {
        b.textContent = r.tipo === 'invalido' ? '❌ Inválido' : '❓';
        b.className = 'tel-badge tel-badge--warn';
    }
}

function renderDirecciones() {
    const c = $('direccionesContainer');
    c.innerHTML = '';
    _dirs.forEach((dir, i) => {
        const el = document.createElement('div');
        el.className = 'item-row item-row--dir';
        el.setAttribute('role', 'listitem');
        el.innerHTML =
            '<div class="dir-fields">'
            + '<div class="dir-row">'
            + '<div class="form-group" style="flex:2"><label class="form-label form-label--sm">Calle</label>'
            + '<input type="text" class="form-control form-control--sm dir-calle" value="' + (dir.calle || '') + '" placeholder="Av. Maipú" data-di="' + i + '" /></div>'
            + '<div class="form-group" style="flex:0.7"><label class="form-label form-label--sm">Número</label>'
            + '<input type="text" class="form-control form-control--sm" value="' + (dir.numero || '') + '" placeholder="1332" data-di="' + i + '" data-f="numero" /></div>'
            + '<div class="form-group" style="flex:0.7"><label class="form-label form-label--sm">Depto</label>'
            + '<input type="text" class="form-control form-control--sm" value="' + (dir.depto || '') + '" placeholder="3B" data-di="' + i + '" data-f="depto" /></div>'
            + '</div>'
            + '<div class="dir-row">'
            + '<div class="form-group" style="flex:1.5"><label class="form-label form-label--sm">Barrio / Localidad</label>'
            + '<input type="text" class="form-control form-control--sm" value="' + (dir.barrio || '') + '" placeholder="Vicente López" data-di="' + i + '" data-f="barrio" /></div>'
            + '<div class="form-group" style="flex:0.6"><label class="form-label form-label--sm">CP</label>'
            + '<input type="text" class="form-control form-control--sm" value="' + (dir.cp || '') + '" placeholder="1638" data-di="' + i + '" data-f="cp" /></div>'
            + '<div class="form-group" style="flex:0.4;justify-content:flex-end">'
            + '<button type="button" class="btn btn--outline btn--sm dir-geo" data-di="' + i + '" title="Geocodificar">🗺</button></div>'
            + '</div>'
            + '<div class="dir-geoinfo" id="dirGeo_' + i + '"></div>'
            + '</div>'
            + '<button type="button" class="btn btn--outline btn--sm" data-rm="' + i + '" aria-label="Eliminar">✕</button>';
        c.appendChild(el);
    });
    c.querySelectorAll('[data-f]').forEach(inp =>
        inp.addEventListener('change', e => { _dirs[+e.target.dataset.di][e.target.dataset.f] = e.target.value; })
    );
    c.querySelectorAll('.dir-calle').forEach(inp => {
        inp.addEventListener('change', e => { _dirs[+e.target.dataset.di].calle = e.target.value; });
        inp.addEventListener('blur', e => { const n = Geo.normCalle(e.target.value); e.target.value = n; _dirs[+e.target.dataset.di].calle = n; });
    });
    c.querySelectorAll('.dir-geo').forEach(btn => {
        btn.addEventListener('click', async e => {
            const i = +e.target.dataset.di, dir = _dirs[i], geo = $('dirGeo_' + i);
            geo.innerHTML = '<span class="form-hint">🔍 Geocodificando…</span>';
            const r = await Geo.geocodificar(dir.calle, dir.numero, dir.barrio);
            if (r) {
                dir.latitud = r.latitud; dir.longitud = r.longitud; if (r.cp && !dir.cp) dir.cp = r.cp;
                geo.innerHTML = '<span class="geo-ok">📍 ' + r.latitud.toFixed(5) + ', ' + r.longitud.toFixed(5) + ' — ' + r.display.split(',').slice(0, 2).join(',') + '</span>';
                renderDirecciones();
            } else {
                geo.innerHTML = '<span class="geo-err">❌ Dirección no encontrada</span>';
            }
        });
    });
    c.querySelectorAll('[data-rm]').forEach(btn =>
        btn.addEventListener('click', e => { _dirs.splice(+e.target.dataset.rm, 1); renderDirecciones(); })
    );
}


// ════════════════════════════════════════════════════════
// 10. ABM
// ════════════════════════════════════════════════════════
const MODO = { ALTA: 'ALTA', MODIFY: 'MODIFY' };
const app = { modo: null, personaActual: null, pagina: 1, sortCol: 'apellido', sortDir: 1, resultados: [] };

function initABM() {
    $('formBusqueda').addEventListener('submit', async e => {
        e.preventDefault();
        const td = _v('busq_tipo_doc'), nd = _v('busq_nro_doc').trim(), sex = _v('busq_sexo'), err = $('busquedaError');
        if (!nd || !sex) { err.textContent = 'Complete Número y Sexo.'; err.hidden = false; return; }
        if (+nd < 1000000 || +nd > 99999999) { err.textContent = 'DNI debe tener entre 7 y 8 dígitos.'; err.hidden = false; return; }
        err.hidden = true;
        
        const btn = $q('button[type="submit"]', e.target);
        const htmlOrig = btn.innerHTML;
        btn.innerHTML = 'Buscando...'; btn.disabled = true;
        
        try {
            const personaEncontrada = await Store.findPersona(td, nd, sex);
            abrirFormulario(personaEncontrada, { tipo_doc: td, nro_doc: nd, sexo: sex });
        } catch (error) {
            err.textContent = 'Error al conectar con la BD.';
            err.hidden = false;
        } finally {
            btn.innerHTML = htmlOrig; btn.disabled = false;
        }
    });
    $('btnCancelar').addEventListener('click', () => { $('panelFormulario').hidden = true; $('panelBusqueda').hidden = false; });
    $('btnAddTel').addEventListener('click', () => { _tels.push({ tipo: 'CEL', numero_raw: '' }); renderTelefonos(); });
    $('btnAddDir').addEventListener('click', () => { _dirs.push({ calle: '', numero: '', depto: '', barrio: '', cp: '' }); renderDirecciones(); });
    $('formPersona').addEventListener('submit', e => { e.preventDefault(); guardarPersona(); });
    $('btnBajaLogica').addEventListener('click', () => {
        if (!Auth.puede('baja')) return;
        $('motivoBaja').value = ''; $('err_motivo_baja').textContent = '';
        $('modalBaja').hidden = false; $('motivoBaja').focus();
    });
    $('btnCancelarBaja').addEventListener('click', () => { $('modalBaja').hidden = true; });
    $('btnConfirmarBaja').addEventListener('click', confirmarBaja);
    $('f_parentesco').addEventListener('change', e => { $('secParienteRef').hidden = !e.target.value; });
}

function _v(id) { return $(id) ? $(id).value : ''; }

function abrirFormulario(persona, busqData) {
    app.personaActual = persona;
    app.modo = persona ? MODO.MODIFY : MODO.ALTA;
    const esAlta = app.modo === MODO.ALTA;
    const puedeMod = Auth.puede('modificar');
    const puedeBaja = Auth.puede('baja');
    const soloLec = !puedeMod;

    $('modeBadge').textContent = esAlta ? '✦ NUEVA ALTA' : (persona?.activo ? '✎ MODIFICACIÓN' : '⚠ INACTIVO');
    $('modeBadge').className = 'mode-badge ' + (esAlta ? 'mode-badge--alta' : (persona?.activo ? 'mode-badge--mod' : 'mode-badge--inact'));
    $('formModeTitle').textContent = esAlta ? 'Nuevo Registro' : persona.apellido + ', ' + persona.nombre;
    $('formModeDesc').textContent = esAlta ? 'Complete los datos y guarde.' : 'DNI ' + fmtDNI(persona.nro_doc) + ' — ' + persona.tipo_doc + ' — ' + persona.sexo;

    $('f_tipo_doc').value = busqData.tipo_doc;
    $('f_nro_doc').value = busqData.nro_doc;
    $('f_sexo').value = busqData.sexo;
    $('f_cuil').value = persona?.cuil || '';
    $('f_apellido').value = persona?.apellido || '';
    $('f_nombre').value = persona?.nombre || '';
    $('f_fecha_nac').value = persona?.fecha_nac || '';
    $('f_estado_civil').value = persona?.estado_civil || '';
    $('f_nivel_estudio').value = persona?.nivel_estudio || '';
    $('f_email').value = persona?.email || '';
    $('f_acepta_mails').value = persona?.acepta_mails === false ? 'false' : 'true';
    $('f_obra_social').value = persona?.obra_social || '';
    $('f_nro_afiliado').value = persona?.nro_afiliado || '';
    $('f_contacto_emergencia').value = persona?.contacto_emergencia || '';
    $('f_parentesco').value = persona?.parentesco || '';
    $('secParienteRef').hidden = !persona?.parentesco;

    _tels = JSON.parse(JSON.stringify(persona?.telefonos || []));
    _dirs = JSON.parse(JSON.stringify(persona?.domicilios || []));
    renderTelefonos(); renderDirecciones();

    $('bannerSoloLectura').hidden = !soloLec;
    $('btnGuardar').hidden = soloLec;
    $('btnBajaLogica').hidden = soloLec || !puedeBaja || esAlta || persona?.activo === false;
    $('alertaContacto').hidden = true;

    $qa('#formPersona input:not([readonly]), #formPersona select, #formPersona textarea').forEach(el => { el.disabled = soloLec; });

    $('panelBusqueda').hidden = true;
    $('panelFormulario').hidden = false;
}

async function guardarPersona() {
    const apellido = $('f_apellido').value.trim(), nombre = $('f_nombre').value.trim();
    if (!apellido) { $('err_apellido').textContent = 'Requerido'; return; }
    if (!nombre) { $('err_nombre').textContent = 'Requerido'; return; }
    const email = $('f_email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('err_email').textContent = 'Formato inválido'; return; }
    if (!email && !_tels.some(t => t.numero_raw) && !_dirs.some(d => d.calle)) { $('alertaContacto').hidden = false; return; }
    $('alertaContacto').hidden = true;

    const esAlta = app.modo === MODO.ALTA;
    const btn = $('btnGuardar');
    const htmlOrig = btn.innerHTML;
    btn.innerHTML = 'Guardando...'; btn.disabled = true;

    try {
        const domPrinc = _dirs[0] || {};
        
        let pData = {
            dni: +$('f_nro_doc').value,
            cuil: $('f_cuil').value.trim() || null,
            nombre: $('f_nombre').value.trim(),
            apellido: $('f_apellido').value.trim(),
            sexo: $('f_sexo').value,
            fecha_nacimiento: $('f_fecha_nac').value || null,
            email: email || null,
            email_es_real: true, // simplified for now
            dom_calle: domPrinc.calle || null,
            dom_numero: domPrinc.numero || null,
            dom_barrio: domPrinc.barrio || null,
            dom_codigo_postal: domPrinc.cp || null,
            dom_latitud: domPrinc.latitud || null,
            dom_longitud: domPrinc.longitud || null,
            obra_social: $('f_obra_social').value.trim() || null,
            nro_afiliado: $('f_nro_afiliado').value.trim() || null,
            contacto_emergencia: $('f_contacto_emergencia').value.trim() || null,
        };

        if (esAlta) {
            pData.telefonos = _tels.map(t => {
                const r = Tel.normalizar(t.numero_raw);
                return { tipo: t.tipo, numero: r.fmt, prefijo: null, observacion: t.numero_raw, es_principal: false };
            }).filter(t => t.numero);
        } else {
            pData.id = app.personaActual.id; // required for PUT
        }

        const personaGuardada = await Store.savePersona(pData);
        showToast(esAlta ? '✅ Persona registrada correctamente' : '✅ Datos actualizados');
        $('panelFormulario').hidden = true;
        $('panelBusqueda').hidden = false;
        $('formBusqueda').reset();
    } catch (error) {
        showToast('❌ Error: ' + error.message, 'error');
    } finally {
        btn.innerHTML = htmlOrig; btn.disabled = false;
    }
}

function confirmarBaja() {
    const motivo = $('motivoBaja').value.trim();
    if (!motivo) { $('err_motivo_baja').textContent = 'El motivo es requerido.'; return; }
    const u = Auth.getUsuario();
    const p = { ...app.personaActual, activo: false, fecha_baja: new Date().toISOString(), motivo_baja: motivo, baja_por: u.email };
    Store.savePersona(p);
    Store.logAudit({ op: 'BAJA', dni: p.nro_doc, nombre: p.apellido + ', ' + p.nombre, motivo, usuario: u.email });
    $('modalBaja').hidden = true;
    showToast('🗃 Baja lógica registrada.', 'warn');
    app.personaActual = p;
    abrirFormulario(p, { tipo_doc: p.tipo_doc, nro_doc: p.nro_doc, sexo: p.sexo });
}


// ════════════════════════════════════════════════════════
// 11. CONSULTA
// ════════════════════════════════════════════════════════
const POR_PAG = 15;

function initConsulta() {
    $('btnFiltrar').addEventListener('click', renderTablaConsulta);
    $('btnLimpiarFiltros').addEventListener('click', () => {
        ['flt_apellido_desde', 'flt_apellido_hasta', 'flt_fecha_desde', 'flt_fecha_hasta', 'flt_texto'].forEach(id => $(id).value = '');
        $('flt_sexo').value = ''; $('flt_activo').value = 'true';
        renderTablaConsulta();
    });
    $qa('#tablaPersonas th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => { if (app.sortCol === th.dataset.sort) app.sortDir *= -1; else { app.sortCol = th.dataset.sort; app.sortDir = 1; } app.pagina = 1; renderTablaConsulta(); });
    });
    $('btnExportarCSV').addEventListener('click', exportarCSV);
}

async function renderTablaConsulta() {
    const fn_indicador = $q('#tablaPersonasBody');
    if (fn_indicador) fn_indicador.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px"><span class="form-hint" style="font-size:18px;">⏳ Cargando desde BUP...</span></td></tr>';

    const act = $('flt_activo').value;
    const txt = $('flt_texto').value;

    let params = `?activos=${act === 'true'}`;
    if (txt) {
        // Simple heurística para saber si buscó DNI directo o texto libre
        if (/^\d{7,8}$/.test(txt)) params += `&dni=${txt}`;
        else params += `&texto=${encodeURIComponent(txt)}`;
    }

    let res = [];
    try {
        const token = Auth.getToken();
        const response = await fetch(`${Store.API_URL || 'https://zaris-api-production-bf0b.up.railway.app/api'}/personas/buscar${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) res = await response.json();
    } catch (e) {
        console.error('Error fetching search:', e);
        if (fn_indicador) fn_indicador.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px"><span class="geo-err">❌ Error de conexión con BUP</span></td></tr>';
        return;
    }

    res.sort((a, b) => { const av = String(a[app.sortCol] || '').toLowerCase(), bv = String(b[app.sortCol] || '').toLowerCase(); return av < bv ? -app.sortDir : av > bv ? app.sortDir : 0; });
    app.resultados = res;
    const total = res.length, pags = Math.ceil(total / POR_PAG) || 1;
    if (app.pagina > pags) app.pagina = 1;
    const slice = res.slice((app.pagina - 1) * POR_PAG, app.pagina * POR_PAG);
    $('tablaConteo').textContent = total ? total + ' registros (pág ' + app.pagina + '/' + pags + ')' : '';
    const tbody = $('tablaPersonasBody');
    tbody.innerHTML = '';
    $('tablaVacia').hidden = total > 0;
    slice.forEach(p => {
        const tr = document.createElement('tr');
        const tel = p.telefonos && p.telefonos[0], dir = p.domicilios && p.domicilios[0];
        tr.innerHTML =
            '<td class="mono">' + fmtDNI(p.nro_doc) + '<br><small>' + p.tipo_doc + '</small></td>' +
            '<td><strong>' + (p.apellido || '') + '</strong>, ' + (p.nombre || '') + '</td>' +
            '<td>' + (p.sexo || '') + '</td>' +
            '<td>' + fmtFecha(p.fecha_nac) + '</td>' +
            '<td>' + (p.email ? '<small>' + p.email + '</small>' : '') +
            (tel ? '<br><small>📱 ' + (tel.numero_raw || '') + '</small>' : '') +
            (dir ? '<br><small>📍 ' + (dir.calle || '') + ' ' + (dir.numero || '') + '</small>' : '') + '</td>' +
            '<td>' + (p.activo ? '<span class="stat-activo">Activo</span>' : '<span class="stat-inact">Baja</span>') + '</td>' +
            '<td><small>' + fmtFecha(p.created_at) + '</small></td>' +
            '<td><button class="btn btn--outline btn--sm" data-id="' + p.id + '">✎ Editar</button></td>';
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', e => {
        const p = Store.getPersonas().find(x => x.id === +e.target.dataset.id);
        if (p) { showView('viewAbm'); abrirFormulario(p, { tipo_doc: p.tipo_doc, nro_doc: p.nro_doc, sexo: p.sexo }); }
    }));
    const pagin = $('paginacion'); pagin.innerHTML = '';
    if (pags > 1) for (let i = 1; i <= pags; i++) { const b = document.createElement('button'); b.className = 'page-btn' + (i === app.pagina ? ' page-btn--active' : ''); b.textContent = i; b.addEventListener('click', () => { app.pagina = i; renderTablaConsulta(); }); pagin.appendChild(b); }
}

function exportarCSV() {
    if (!Auth.puede('exportar')) return;
    const data = app.resultados.length ? app.resultados : Store.getPersonas();
    const cols = ['nro_doc', 'tipo_doc', 'apellido', 'nombre', 'sexo', 'fecha_nac', 'email', 'activo', 'created_at'];
    const rows = [cols.join(';')];
    data.forEach(p => rows.push(cols.map(c => JSON.stringify(p[c] !== undefined ? p[c] : '')).join(';')));
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'ZARIS_personas_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    showToast('📥 CSV descargado', 'ok');
}


// ════════════════════════════════════════════════════════
// 12. ADMIN PADRONES
// ════════════════════════════════════════════════════════
const PADRON_DEF = {
    paises: { title: 'Países', cols: ['codigo_iso2', 'nombre', 'activo'], labels: ['ISO2', 'Nombre', 'Activo'] },
    provincias: { title: 'Provincias', cols: ['nombre', 'activo'], labels: ['Nombre', 'Activo'] },
    localidades: { title: 'Localidades', cols: ['nombre', 'cp', 'activo'], labels: ['Nombre', 'CP', 'Activo'] },
    combos: { title: 'Combos', cols: ['categoria', 'codigo', 'descripcion', 'activo'], labels: ['Cat.', 'Código', 'Descripción', 'Activo'] },
};
let _padron = 'paises', _padPag = 1, _padEditId = null, _importPend = [];

function initPadrones() {
    $qa('.subtab').forEach(bt => {
        bt.addEventListener('click', async () => {
            $qa('.subtab').forEach(b => { b.classList.remove('subtab--active'); b.setAttribute('aria-selected', 'false'); });
            bt.classList.add('subtab--active'); bt.setAttribute('aria-selected', 'true');
            await renderPadrones(bt.dataset.padron);
        });
    });
    $('padronBusqueda').addEventListener('input', async () => await renderPadrones(_padron));
    $('btnPadronNuevo').addEventListener('click', () => abrirModalPadron(null));
    $('btnCancelarPadron').addEventListener('click', () => { $('modalPadron').hidden = true; });
    $('formPadron').addEventListener('submit', e => { e.preventDefault(); guardarPadronItem(); });
    $('importCSVInput').addEventListener('change', e => leerCSVImport(e.target.files[0]));
    $('btnCancelarImport').addEventListener('click', () => { $('modalImportCSV').hidden = true; });
    $('btnConfirmarImport').addEventListener('click', confirmarImportCSV);
}

async function renderPadrones(nombre) {
    _padron = nombre;
    const def = PADRON_DEF[nombre], txt = ($('padronBusqueda').value || '').toLowerCase();
    const dataRaw = await Store.getPadron(nombre);
    const data = dataRaw.filter(x => !txt || def.cols.some(c => String(x[c] || '').toLowerCase().includes(txt)));
    
    $('tablaPadronHead').innerHTML = '<tr>' + def.labels.map(l => '<th>' + l + '</th>').join('') + '<th>Acciones</th></tr>';
    const PER = 20, pags = Math.ceil(data.length / PER) || 1;
    if (_padPag > pags) _padPag = 1;
    const slice = data.slice((_padPag - 1) * PER, _padPag * PER);
    $('padronConteo').textContent = data.length + ' registros';
    $('padronVacio').hidden = data.length > 0;
    const tbody = $('tablaPadronBody'); tbody.innerHTML = '';
    slice.forEach(row => {
        const tr = document.createElement('tr');
        if (!row.activo) tr.classList.add('row--inact');
        tr.innerHTML = def.cols.map(c => '<td>' + (c === 'activo' ? (row[c] ? '✅' : '❌') : String(row[c] !== undefined ? row[c] : '')) + '</td>').join('')
            + '<td><button class="btn btn--outline btn--sm" data-edit="' + row.id + '" disabled title="No implementado">✎</button> '
            + (row.activo ? '<button class="btn btn--danger btn--sm" data-baja="' + row.id + '" disabled title="No implementado">⊘</button>' : '<span class="stat-inact">Baja</span>') + '</td>';
        tbody.appendChild(tr);
    });
    // NOTE: Edition deactivated temporarily pending full Backend Padron CRUD implementation
    const pagin = $('padronPaginacion'); pagin.innerHTML = '';
    if (pags > 1) for (let i = 1; i <= pags; i++) { const b = document.createElement('button'); b.className = 'page-btn' + (i === _padPag ? ' page-btn--active' : ''); b.textContent = i; b.addEventListener('click', async () => { _padPag = i; await renderPadrones(_padron); }); pagin.appendChild(b); }
}

function abrirModalPadron(id) {
    _padEditId = id; const def = PADRON_DEF[_padron], item = id ? Store.getPadron(_padron).find(x => x.id === id) : null;
    $('modalPadronTitle').textContent = (id ? 'Editar' : 'Nuevo') + ' — ' + def.title;
    $('formPadronCampos').innerHTML = def.cols.filter(c => c !== 'activo').map(c =>
        '<div class="form-group"><label class="form-label">' + c.charAt(0).toUpperCase() + c.slice(1) + '</label>'
        + '<input type="text" id="padF_' + c + '" class="form-control" value="' + (item && item[c] !== undefined ? item[c] : '') + '" /></div>'
    ).join('');
    $('padronError').hidden = true; $('modalPadron').hidden = false;
    const first = $('formPadronCampos').querySelector('input'); if (first) first.focus();
}

function guardarPadronItem() {
    const def = PADRON_DEF[_padron], datos = { id: _padEditId || Store.nextPadronId(_padron), activo: true };
    def.cols.filter(c => c !== 'activo').forEach(c => { const el = $('padF_' + c); if (el) datos[c] = el.value.trim(); });
    Store.savePadronItem(_padron, datos);
    $('modalPadron').hidden = true; renderPadrones(_padron);
    showToast(_padEditId ? '✅ Actualizado' : '✅ Creado', 'ok');
}

function leerCSVImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.trim().replace(/["']/g, '').toLowerCase());
        _importPend = lines.slice(1).filter(l => l.trim()).map(l => {
            const vals = l.split(sep).map(v => v.trim().replace(/["']/g, ''));
            const obj = { activo: true }; headers.forEach((h, i) => { obj[h] = vals[i] || ''; }); return obj;
        });
        $('modalImportTitle').textContent = 'Importar — ' + PADRON_DEF[_padron].title;
        $('modalImportDesc').textContent = _importPend.length + ' registros — Columnas: ' + headers.join(', ');
        $('importPreview').innerHTML = '<table class="data-table"><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
            + _importPend.slice(0, 5).map(r => '<tr>' + headers.map(h => '<td>' + (r[h] || '') + '</td>').join('') + '</tr>').join('')
            + '</tbody></table>';
        $('importError').hidden = true; $('modalImportCSV').hidden = false; $('importCSVInput').value = '';
    };
    reader.readAsText(file, 'utf-8');
}

function confirmarImportCSV() {
    if (!_importPend.length) return; let ok = 0;
    _importPend.forEach(item => { Store.savePadronItem(_padron, { ...item, id: Store.nextPadronId(_padron), activo: true }); ok++; });
    $('modalImportCSV').hidden = true; _importPend = []; renderPadrones(_padron);
    showToast(ok + ' registros importados', 'ok');
}


// ════════════════════════════════════════════════════════
// 13. AUDITORÍA
// ════════════════════════════════════════════════════════
function renderAudit() {
    const log = $('auditLog'), data = Store.getAudit();
    if (!data.length) { log.innerHTML = '<p class="empty-state">No hay operaciones registradas.</p>'; return; }
    log.innerHTML = data.map(e =>
        '<div class="audit-entry">'
        + '<span class="audit-op audit-op--' + e.op.toLowerCase() + '">' + e.op + '</span>'
        + '<span class="audit-info"><strong>' + (e.nombre || '') + '</strong> — DNI ' + fmtDNI(e.dni) + '</span>'
        + '<span class="audit-user">' + (e.usuario || '') + '</span>'
        + '<span class="audit-ts">' + fmtFecha(e.ts) + '</span>'
        + '</div>'
    ).join('');
}


// ════════════════════════════════════════════════════════
// 14. BOOTSTRAP
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    Auth.initUsers();
    initLogin();
    initNav();
    initABM();
    initConsulta();
    initPadrones();
});


