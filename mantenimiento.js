/** 
 * mantenimiento.js 
 * Lógica para la administración de Espacios y Sub-espacios de Agenda 
 */

'use strict';

const AdminStore = (() => {
    let _espaciosCache = [];
    const API_URL = 'https://zaris-api-production-bf0b.up.railway.app/api';

    const fetchAPI = async (endpoint, options = {}) => {
        const u = Auth.getUsuario();
        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': u && u.token ? `Bearer ${u.token}` : ''
        };
        const res = await fetch(`${API_URL}${endpoint}`, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Error HTTP ${res.status}`);
        }
        if (res.status === 204) return null;
        return res.json();
    };

    async function cargarEspacios() {
        try {
            _espaciosCache = await fetchAPI('/agenda/espacios');
            return _espaciosCache;
        } catch (e) {
            console.error("Error al cargar espacios:", e);
            showToast("Error al conectar con el servidor", "error");
            return [];
        }
    }

    function getEspacios() {
        return _espaciosCache;
    }

    async function saveEspacio(esp) {
        try {
            if (esp.id) {
                await fetchAPI(`/agenda/espacios/${esp.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(esp)
                });
            } else {
                await fetchAPI('/agenda/espacios', {
                    method: 'POST',
                    body: JSON.stringify(esp)
                });
            }
            await cargarEspacios();
            return true;
        } catch (e) {
            console.error(e);
            showToast("Error al guardar espacio: " + e.message, "error");
            return false;
        }
    }

    return { getEspacios, saveEspacio, cargarEspacios };
})();

// -- Variables Globales Vista --
let _padreActualId = null; 

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Control de Acceso
  const u = Auth.getUsuario();
  if (!u || u.rol !== 'ADMINISTRADOR') {
    document.getElementById('mainLayout').hidden = true;
    document.getElementById('noAccessMsg').hidden = false;
    return;
  }
  document.getElementById('mainLayout').hidden = false;

  await AdminStore.cargarEspacios();
  initNav();
  initEspaciosView();
});

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('nav-btn--active');
        b.setAttribute('aria-selected', 'false');
      });
      e.target.classList.add('nav-btn--active');
      e.target.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.view').forEach(v => {
        v.hidden = true;
        v.classList.remove('view--active');
      });
      const tgt = document.getElementById('view' + e.target.dataset.view.charAt(0).toUpperCase() + e.target.dataset.view.slice(1));
      if (tgt) {
        tgt.hidden = false;
        tgt.classList.add('view--active');
      }
    });
  });
}

// -------------------------------------------------------------
// VISTA ESPACIOS
// -------------------------------------------------------------
function initEspaciosView() {
  document.getElementById('btnNuevoCentro').addEventListener('click', () => abrirModalEspacio(null));
  document.getElementById('btnNuevoSub').addEventListener('click', () => abrirModalEspacio(_padreActualId));
  
  document.getElementById('btnCerrarSecModal').addEventListener('click', cerrarModal);
  document.getElementById('btnCancelEspacio').addEventListener('click', cerrarModal);
  document.getElementById('formEspacio').addEventListener('submit', guardarEspacio);

  renderCentros();
}

function renderCentros() {
  const lista = document.getElementById('listaCentros');
  lista.innerHTML = '';
  const todos = AdminStore.getEspacios();
  const padres = todos.filter(e => e.id_espacio_padre === null && e.tipo === 'PADRE');

  if (padres.length === 0) {
    lista.innerHTML = '<li class="text-muted" style="justify-content:center">No hay centros registrados</li>';
  } else {
    padres.forEach(p => {
      const li = document.createElement('li');
      if (p.id === _padreActualId) li.classList.add('active');
      
      const subCount = todos.filter(e => e.id_espacio_padre === p.id).length;
      
      li.innerHTML = `
        <div>
          <span class="item-title">${p.nombre}</span>
          <span class="item-desc">${p.descripcion || 'Sin descripción'}</span>
        </div>
        <span class="badge" title="Sub-espacios configurados">${subCount}</span>
      `;
      li.addEventListener('click', () => seleccionarCentro(p.id));
      lista.appendChild(li);
    });
  }

  if (!_padreActualId && padres.length > 0) {
    seleccionarCentro(padres[0].id);
  }
}

function seleccionarCentro(id) {
  _padreActualId = id;
  const centro = AdminStore.getEspacios().find(e => e.id === id);
  if (!centro) return;

  document.getElementById('tituloSubespacios').textContent = `Sub-espacios de: ${centro.nombre}`;
  document.getElementById('btnNuevoSub').disabled = false;
  
  // Actualizar lista visual
  document.querySelectorAll('#listaCentros li').forEach(li => li.classList.remove('active'));
  const lis = document.querySelectorAll('#listaCentros li');
  // Hack simple para marcar el activo (depende del orden)
  renderCentros(); 

  renderSubespacios(id);
}

function renderSubespacios(idPadre) {
  const tbody = document.getElementById('bodySubespacios');
  const subs = AdminStore.getEspacios().filter(e => e.id_espacio_padre === idPadre);

  if (subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No existen sub-espacios para este centro.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  subs.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.nombre}</strong><br><small class="text-muted">${s.descripcion || ''}</small></td>
      <td>${s.tipo === 'ATENDIDO' ? '🧑‍⚕️ Consultorio' : '🏟️ Campo'}</td>
      <td>${s.duracion_turno_defecto} min</td>
      <td>${s.capacidad_turno} pers.</td>
      <td>${s.activo ? '<span class="stat-activo">Activo</span>' : '<span class="stat-inact">Inactivo</span>'}</td>
      <td>
        <button class="btn btn--ghost btn--sm" onclick="editarEspacio(${s.id})">✎</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// MODALES (Alta / Modificación)
// -------------------------------------------------------------
function abrirModalEspacio(idPadre) {
  const form = document.getElementById('formEspacio');
  form.reset();
  document.getElementById('f_esp_id').value = '';
  document.getElementById('f_esp_padre_id').value = idPadre || '';

  const isHijo = idPadre !== null;
  document.getElementById('modalEspacioTitle').textContent = isHijo ? 'Nuevo Sub-espacio' : 'Nuevo Centro Principal';
  
  // Ocultar/mostrar opciones según jerarquía
  document.getElementById('optPadre').hidden = isHijo;
  document.getElementById('optAtendido').hidden = !isHijo;
  document.getElementById('optDesatendido').hidden = !isHijo;

  document.getElementById('f_esp_tipo').value = isHijo ? 'ATENDIDO' : 'PADRE';
  
  // Mostrar config específica
  document.getElementById('cf_subespacio').style.display = isHijo ? 'none' : 'none'; // oculto para padre, block para hijo? En realidad el padre tmb puede tener cap, pero simplifiquemos:
  document.getElementById('cf_subespacio').style.display = isHijo ? 'flex' : 'none';
  
  document.getElementById('modalEspacio').hidden = false;
  document.getElementById('f_esp_nombre').focus();
}

window.editarEspacio = function(id) {
  const esp = AdminStore.getEspacios().find(e => e.id === id);
  if (!esp) return;

  const isHijo = esp.id_espacio_padre !== null;
  document.getElementById('modalEspacioTitle').textContent = isHijo ? 'Editar Sub-espacio' : 'Editar Centro Principal';
  
  document.getElementById('f_esp_id').value = esp.id;
  document.getElementById('f_esp_padre_id').value = esp.id_espacio_padre || '';
  document.getElementById('f_esp_nombre').value = esp.nombre;
  document.getElementById('f_esp_desc').value = esp.descripcion || '';
  
  document.getElementById('optPadre').hidden = isHijo;
  document.getElementById('optAtendido').hidden = !isHijo;
  document.getElementById('optDesatendido').hidden = !isHijo;
  document.getElementById('f_esp_tipo').value = esp.tipo;

  if (isHijo) {
    document.getElementById('cf_subespacio').style.display = 'flex';
    document.getElementById('f_esp_duracion').value = esp.duracion_turno_defecto;
    document.getElementById('f_esp_cap').value = esp.capacidad_turno;
    document.getElementById('f_esp_activo').value = esp.activo.toString();
  } else {
    document.getElementById('cf_subespacio').style.display = 'none';
  }

  document.getElementById('modalEspacio').hidden = false;
};

function cerrarModal() {
  document.getElementById('modalEspacio').hidden = true;
}

async function guardarEspacio(e) {
  e.preventDefault();
  
  const id = document.getElementById('f_esp_id').value;
  const idPadre = document.getElementById('f_esp_padre_id').value;
  const isHijo = idPadre !== '';

  // Transformar de nombres del form frontend al DTO de Backend
  const esp = {
    nombre: document.getElementById('f_esp_nombre').value.trim(),
    descripcion: document.getElementById('f_esp_desc').value.trim() || undefined,
    tipo: document.getElementById('f_esp_tipo').value,
    id_espacio_padre: isHijo ? parseInt(idPadre) : null,
    capacidad: isHijo ? parseInt(document.getElementById('f_esp_cap').value) : 1,
    activo: isHijo ? (document.getElementById('f_esp_activo').value === 'true') : true
  };
  if (id) esp.id = parseInt(id);

  // NOTA: "duracion_turno_defecto" se movió a agente_espacio. duracion_turno_minutos => agente_espacio. 
  // Sin embargo en ZARIS, al crear el espacio inicialmente, lo dejaremos en capacity=1 y se asignará la duración al agente. El formulario lo tiene pero no envía a DB espacio, así que lo ignoramos aquí o lo guardamos si existe.
  
  const btn = document.querySelector('#formEspacio button[type="submit"]');
  btn.disabled = true;

  const ok = await AdminStore.saveEspacio(esp);
  btn.disabled = false;

  if (ok) {
    cerrarModal();
    showToast('✅ Espacio guardado correctamente', 'ok');

    if (isHijo) {
        renderSubespacios(esp.id_espacio_padre);
        renderCentros(); // Refrescar conteo visual
    } else {
        renderCentros();
    }
  }
}

// -----------------------------------------------------------------------------
// VISTA EQUIPOS Y AGENTES
// -----------------------------------------------------------------------------
let _agentesCache = [];
let _asignacionesCache = [];

async function initEquiposView() {
  document.getElementById('btnRefreshAgentes').addEventListener('click', loadTableAsignaciones);
  document.getElementById('formAgenteEspacio').addEventListener('submit', handleSaveAsignacion);

  // Generar lista de horarios en form
  const container = document.getElementById('agenteHorariosList');
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  dias.forEach(d => {
    container.innerHTML += `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 5px;">
        <label style="flex:1; text-transform:capitalize;">
          <input type="checkbox" id="chk_dia_${d}"> ${d}
        </label>
        <input type="time" id="tinicio_${d}" value="08:00" class="form-control" style="width:auto" disabled>
        <span>a</span>
        <input type="time" id="tfin_${d}" value="14:00" class="form-control" style="width:auto" disabled>
      </div>
    `;
  });

  // Activar inputs de tiempo si el checkbox está checkeado
  dias.forEach(d => {
    document.getElementById(`chk_dia_${d}`).addEventListener('change', (e) => {
      document.getElementById(`tinicio_${d}`).disabled = !e.target.checked;
      document.getElementById(`tfin_${d}`).disabled = !e.target.checked;
    });
  });

  await loadSelects();
  await loadTableAsignaciones();
}

async function loadSelects() {
  _agentesCache = await AdminStore.loadAgentes();
  const selectAgentes = document.getElementById('f_ag_usuario');
  selectAgentes.innerHTML = '<option value="">Seleccione agente...</option>';
  _agentesCache.forEach(u => {
    selectAgentes.innerHTML += `<option value="${u.id}">${u.nombre} ${u.apellido} (${u.rol_nombre})</option>`;
  });

  const selectEspacios = document.getElementById('f_ag_espacio');
  selectEspacios.innerHTML = '<option value="">Seleccione consultorio...</option>';
  const espaciosHijos = AdminStore.getEspacios().filter(e => e.id_espacio_padre !== null);
  espaciosHijos.forEach(e => {
    selectEspacios.innerHTML += `<option value="${e.id}">${e.nombre} (${e.duracion_turno_defecto || 15} min)</option>`;
  });
}

async function loadTableAsignaciones() {
  const tbody = document.getElementById('bodyAgentesEspacios');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center">Cargando...</td></tr>';
  
  _asignacionesCache = await AdminStore.loadAsignaciones();
  
  if (_asignacionesCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay asignaciones registradas.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  _asignacionesCache.forEach(a => {
    const agente = _agentesCache.find(x => x.id === a.usuario_id) || {nombre: 'Desconocido', apellido: ''};
    const espacio = AdminStore.getEspacios().find(x => x.id === a.espacio_id) || {nombre: 'Espacio Eliminado'};
    
    // Formatear dias
    let diasStr = [];
    if (a.config_horaria_personal) {
      for (const [dia, arrayTiempos] of Object.entries(a.config_horaria_personal)) {
         if (arrayTiempos && arrayTiempos.length > 0) {
           diasStr.push(`<strong style="text-transform:capitalize">${dia.slice(0,3)}</strong>: ${arrayTiempos[0].inicio}-${arrayTiempos[0].fin}`);
         }
      }
    }

    tbody.innerHTML += `
      <tr>
        <td><strong>${agente.nombre} ${agente.apellido}</strong></td>
        <td>${espacio.nombre}</td>
        <td style="font-size: 0.85em; line-height: 1.4;">${diasStr.join('<br>') || 'Sin horario'}</td>
      </tr>
    `;
  });
}

async function handleSaveAsignacion(e) {
  e.preventDefault();
  
  const payload = {
    usuario_id: document.getElementById('f_ag_usuario').value,
    espacio_id: parseInt(document.getElementById('f_ag_espacio').value),
    duracion_turno_minutos: parseInt(document.getElementById('f_ag_duracion').value),
    activo: true,
    config_horaria_personal: {}
  };

  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  dias.forEach(d => {
    if (document.getElementById(`chk_dia_${d}`).checked) {
      payload.config_horaria_personal[d] = [{
        inicio: document.getElementById(`tinicio_${d}`).value,
        fin: document.getElementById(`tfin_${d}`).value
      }];
    }
  });
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  
  const ok = await AdminStore.saveAsignacion(payload);
  if (ok) {
    showToast('Espacio asignado. La agenda correspondiente se ha abierto.', 'ok');
    e.target.reset();
    dias.forEach(d => { document.getElementById(`tinicio_${d}`).disabled = true; document.getElementById(`tfin_${d}`).disabled = true; });
    await loadTableAsignaciones();
  }
  
  btn.disabled = false;
}
