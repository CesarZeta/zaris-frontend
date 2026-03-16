/* ============================================================
   ZARIS v2 — hc.js
   Historia Clínica (Consultorio)
   ============================================================ */
'use strict';

// ════════════════════════════════════════════════════════
// 1. ESTADO COMPARTIDO ("Store") y AUTH
// ════════════════════════════════════════════════════════
const HC_KEY = 'zaris_hc';
const KEY_SESSION = 'zaris_session';
const PERSONAS_KEY = 'bds_personas';

function getUsuario() {
    try { return JSON.parse(localStorage.getItem(KEY_SESSION)); } catch { return null; }
}

function getPersonas() {
    try { return JSON.parse(localStorage.getItem(PERSONAS_KEY)) || []; } catch { return []; }
}

function getHCRegistros() {
    try { return JSON.parse(localStorage.getItem(HC_KEY)) || []; } catch { return []; }
}

function setHCRegistros(arr) {
    localStorage.setItem(HC_KEY, JSON.stringify(arr));
}

// ════════════════════════════════════════════════════════
// 2. UTILIDADES
// ════════════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function $q(s) { return document.querySelector(s); }

function showToast(msg, tipo = 'ok', dur = 3000) {
    const c = $('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast toast--' + tipo;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => { t.classList.remove('toast--show'); setTimeout(() => t.remove(), 350); }, dur);
}

function fmtFechaHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

// ════════════════════════════════════════════════════════
// 3. ESTADO LOCAL HC
// ════════════════════════════════════════════════════════
const state = {
    pacienteActual: null,
    registroEditado: null // ID del registro si está en BORRADOR
};

// ════════════════════════════════════════════════════════
// 4. INICIALIZACIÓN
// ════════════════════════════════════════════════════════
function init() {
    const u = getUsuario();
    if (!u) {
        location.replace('home.html');
        return;
    }

    // Cabecera
    $('userAvatar').textContent = u.iniciales;
    $('userNombre').textContent = u.nombre + ' ' + u.apellido;
    $('userRol').textContent = u.rol;
    $('userRol').className = 'user-rol rol--' + u.rol.toLowerCase();

    // Eventos
    $('btnLogout').addEventListener('click', () => {
        localStorage.removeItem(KEY_SESSION);
        location.replace('home.html');
    });

    $('formBuscarPaciente').addEventListener('submit', handleBuscarPaciente);
    $('btnBuscarOtro').addEventListener('click', mostrarBuscador);
    $('btnNuevaAtencion').addEventListener('click', () => abrirFormularioAtencion(null));
    $('btnCancelarAtencion').addEventListener('click', cancelarAtencion);
    
    // Guardar borrador vs Cerrar
    $('btnGuardarBorrador').addEventListener('click', () => guardarAtencion('BORRADOR'));
    $('formAtencion').addEventListener('submit', e => {
        e.preventDefault();
        guardarAtencion('CERRADO');
    });

    // Leer query params (Si venimos de Agenda)
    const urlParams = new URLSearchParams(window.location.search);
    const pDni = urlParams.get('dni');
    const pSexo = urlParams.get('sexo');
    if (pDni && pSexo) {
        // Rellenar ocultamente y buscar
        $('busq_dni').value = pDni;
        $('busq_sexo').value = pSexo;
        handleBuscarPaciente(new Event('submit'));
    } else {
        mostrarBuscador();
    }
}

// ════════════════════════════════════════════════════════
// 5. ACCESO PACIENTE
// ════════════════════════════════════════════════════════
function mostrarBuscador() {
    $('overlayBuscador').style.display = 'flex';
    $('mainContent').hidden = true;
    $('busq_dni').value = '';
    $('busq_sexo').value = '';
    $('busqError').hidden = true;
    $('busq_dni').focus();
    state.pacienteActual = null;
    cancelarAtencion();
}

function handleBuscarPaciente(e) {
    if (e) e.preventDefault();
    const nd = $('busq_dni').value.trim();
    const sx = $('busq_sexo').value;
    const err = $('busqError');

    const lista = getPersonas();
    const paciente = lista.find(p => String(p.nro_doc) === nd && p.sexo === sx);

    if (!paciente) {
        err.textContent = '❌ Paciente no encontrado en la Base Única de Personas.';
        err.hidden = false;
        return;
    }

    if (!paciente.activo) {
        err.textContent = '⚠ Esta persona figura como DADA DE BAJA en el padrón.';
        err.hidden = false;
        return;
    }

    // Cargar Paciente
    state.pacienteActual = paciente;
    err.hidden = true;
    $('overlayBuscador').style.display = 'none';
    $('mainContent').hidden = false;

    renderPacienteSidebar();
    renderTimeline();
}

function renderPacienteSidebar() {
    const p = state.pacienteActual;
    const iniciales = p.nombre.charAt(0) + p.apellido.charAt(0);
    
    $('pacAvatar').textContent = iniciales.toUpperCase();
    $('pacNombre').textContent = `${p.apellido}, ${p.nombre}`;
    $('pacDNI').textContent = `DNI ${p.nro_doc} • ${p.sexo}`;

    if (p.fecha_nac) {
        const d_nac = new Date(p.fecha_nac);
        const diff_ms = Date.now() - d_nac.getTime();
        const age_dt = new Date(diff_ms); 
        const age = Math.abs(age_dt.getUTCFullYear() - 1970);
        $('pacEdad').textContent = `${p.fecha_nac.split('-').reverse().join('/')} (${age} años)`;
    } else {
        $('pacEdad').textContent = '— (-- años)';
    }

    $('pacObraSocial').innerHTML = p.obra_social ? `<strong>${escapeHTML(p.obra_social)}</strong>` : '<i>Sin especificar</i>';
    $('pacNroAfiliado').textContent = p.nro_afiliado ? `Afiliado/a: ${p.nro_afiliado}` : '';

    const tel = p.telefonos && p.telefonos[0] ? p.telefonos[0].numero_raw : '—';
    $('pacTelefono').textContent = `☎ ${tel}`;
    $('pacEmail').textContent = p.email ? `✉ ${escapeHTML(p.email)}` : '✉ —';

    $('pacEmergencia').textContent = p.contacto_emergencia || 'Sin especificar';
}


// ════════════════════════════════════════════════════════
// 6. TIMELINE DE ATENCIONES
// ════════════════════════════════════════════════════════
function renderTimeline() {
    const pId = state.pacienteActual.id;
    const todos = getHCRegistros();
    // Filtrar por paciente actual y ordenar desc (más reciente primero)
    const atenciones = todos.filter(r => r.persona_id === pId).sort((a,b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

    const tl = $('hcTimeline');
    tl.innerHTML = '';

    if (atenciones.length === 0) {
        tl.innerHTML = `<div class="empty-state">
                            <span style="font-size:2rem">📂</span>
                            <p>No hay atenciones registradas para este paciente.</p>
                        </div>`;
        return;
    }

    atenciones.forEach(r => {
        const card = document.createElement('div');
        const estCls = r.estado.toLowerCase(); // borrador, cerrado, anulado
        card.className = `registro-card es-${estCls}`;

        const badgeMap = {
            'BORRADOR': '<span class="badge-estado badge--borrador">BORRADOR</span>',
            'CERRADO': '<span class="badge-estado badge--cerrado">CERRADO</span>',
            'ANULADO': '<span class="badge-estado badge--anulado">ANULADO</span>'
        };

        const profNombre = r.profesional_nombre || 'Profesional no especificado';

        let html = `
            <div class="registro-header">
                <div>
                    <div class="registro-titulo">🩺 ${fmtFechaHora(r.fecha_hora)} ${badgeMap[r.estado]}</div>
                    <div class="registro-meta">👨‍⚕️ Atendido por: ${escapeHTML(profNombre)}</div>
                </div>
            </div>
            <div class="registro-body">
                <div class="campo-medico">
                    <div class="campo-label">Motivo de Consulta</div>
                    <div class="campo-valor">${escapeHTML(r.motivo_consulta)}</div>
                </div>
        `;

        if (r.antecedentes) html += `<div class="campo-medico"><div class="campo-label">Antecedentes</div><div class="campo-valor">${escapeHTML(r.antecedentes)}</div></div>`;
        if (r.examen_fisico) html += `<div class="campo-medico"><div class="campo-label">Examen Físico</div><div class="campo-valor">${escapeHTML(r.examen_fisico)}</div></div>`;
        
        html += `
                <div class="campo-medico">
                    <div class="campo-label">Diagnóstico</div>
                    <div class="campo-valor" style="font-weight: 600">${escapeHTML(r.diagnostico)}</div>
                </div>
        `;

        if (r.tratamiento) html += `<div class="campo-medico"><div class="campo-label">Tratamiento / Receta</div><div class="campo-valor">${escapeHTML(r.tratamiento)}</div></div>`;
        if (r.indicaciones) html += `<div class="campo-medico"><div class="campo-label">Indicaciones</div><div class="campo-valor">${escapeHTML(r.indicaciones)}</div></div>`;
        
        if (r.estado === 'ANULADO') {
             html += `<div class="campo-medico mt-3 p-3 bg-red-50 border-red-200" style="background:#fef2f2; border:1px solid #fecaca; border-radius:4px">
                        <div class="campo-label" style="color:#b91c1c">Motivo de Anulación</div>
                        <div class="campo-valor">${escapeHTML(r.motivo_anulacion)}</div>
                    </div>`;
        }

        html += `</div>`; // .registro-body

        const u = getUsuario();
        
        // Acciones: Si es borrador mío, puedo editar. Si es CERRADO, puedo anular (si soy admin o el mismo prof)
        if (r.estado === 'BORRADOR' && r.profesional_email === u.email) {
            html += `<div class="registro-actions">
                        <button class="btn btn--outline btn--sm btn-continuar" data-id="${r.id}">✎ Continuar Editando</button>
                    </div>`;
        } else if (r.estado === 'CERRADO' && (u.rol === 'ADMINISTRADOR' || r.profesional_email === u.email)) {
            html += `<div class="registro-actions">
                        <button class="btn btn--danger btn--sm btn-anular" data-id="${r.id}">⚠ Anular Enmienda</button>
                    </div>`;
        }

        card.innerHTML = html;
        tl.appendChild(card);
    });

    // Binding actions
    tl.querySelectorAll('.btn-continuar').forEach(btn => {
        btn.addEventListener('click', e => abrirFormularioAtencion(+e.target.dataset.id));
    });

}

// ════════════════════════════════════════════════════════
// 7. FORMULARIO DE ATENCIÓN (ABM)
// ════════════════════════════════════════════════════════
function abrirFormularioAtencion(registroId) {
    state.registroEditado = registroId;
    const u = getUsuario();

    if (registroId) {
        // Cargar Borrador
        const r = getHCRegistros().find(x => x.id === registroId);
        if (!r) return;
        
        $('hc_fecha').value = r.fecha_hora.slice(0,16); // format para datetime-local
        $('hc_motivo').value = r.motivo_consulta;
        $('hc_antecedentes').value = r.antecedentes;
        $('hc_examen').value = r.examen_fisico;
        $('hc_diagnostico').value = r.diagnostico;
        $('hc_tratamiento').value = r.tratamiento;
        $('hc_indicaciones').value = r.indicaciones;
    } else {
        // Nuevo
        $('formAtencion').reset();
        
        // set today local iso
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        $('hc_fecha').value = now.toISOString().slice(0,16);
    }

    $('hc_profesional').value = `${u.nombre} ${u.apellido}`;
    
    // Smooth scroll down
    $('panelFormAtencion').hidden = false;
    $('panelFormAtencion').scrollIntoView({ behavior: 'smooth' });
    $('hc_motivo').focus();
    
    $('btnNuevaAtencion').disabled = true;
}

function cancelarAtencion() {
    $('panelFormAtencion').hidden = true;
    $('btnNuevaAtencion').disabled = false;
    state.registroEditado = null;
}

function guardarAtencion(estado) {
    // Basic validation para BORRADOR, Strict para CERRADO
    const mc = $('hc_motivo').value.trim();
    const di = $('hc_diagnostico').value.trim();
    
    if (estado === 'CERRADO') {
        if (!mc || !di) {
            showToast('Debe completar Motivo y Diagnóstico para cerrar la atención.', 'warn');
            return;
        }
        if (!confirm('¿Está seguro de cerrar la atención? Quedará inalterable.')) return;
    }

    const u = getUsuario();
    const todos = getHCRegistros();

    let reg = {};
    if (state.registroEditado) {
        reg = todos.find(r => r.id === state.registroEditado);
    } else {
        reg = {
            id: Date.now(),
            persona_id: state.pacienteActual.id,
            profesional_email: u.email,
            profesional_nombre: u.nombre + ' ' + u.apellido,
            created_at: new Date().toISOString()
        };
        todos.push(reg);
    }

    // Update fields
    // Reconvertir datetime-local a Date ISO
    let fechaLocal = $('hc_fecha').value;
    if (fechaLocal.length === 16) fechaLocal += ':00';
    
    reg.fecha_hora = new Date(fechaLocal).toISOString();
    reg.motivo_consulta = mc;
    reg.antecedentes = $('hc_antecedentes').value.trim();
    reg.examen_fisico = $('hc_examen').value.trim();
    reg.diagnostico = di;
    reg.tratamiento = $('hc_tratamiento').value.trim();
    reg.indicaciones = $('hc_indicaciones').value.trim();
    reg.estado = estado;
    reg.updated_at = new Date().toISOString();

    if (estado === 'CERRADO') {
        reg.fecha_cierre = new Date().toISOString();
    }

    setHCRegistros(todos);
    
    if (estado === 'CERRADO') {
        showToast('🔒 Atención firmada y cerrada con éxito');
        cancelarAtencion();
    } else {
        showToast('💾 Borrador guardado');
        state.registroEditado = reg.id; // se queda abierto
    }

    renderTimeline();
}

// Inicialización de página
document.addEventListener('DOMContentLoaded', init);
