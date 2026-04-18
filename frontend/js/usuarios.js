/**
 * ZARIS — Lógica del Padrón de Usuarios
 * Alta, baja, modificación y consulta de usuarios del sistema.
 */
document.addEventListener('DOMContentLoaded', () => {

    // ── State ──────────────────────────────────────────────────
    const state = {
        modo: null,          // 'nuevo' | 'edicion' | 'consulta'
        usuario: null,       // objeto usuario cargado
        busquedaTipo: 'texto'
    };

    const NIVELES = { 1: 'Administrador', 2: 'Supervisor', 3: 'Operador', 4: 'Consultor' };

    // ── Elements ───────────────────────────────────────────────
    const els = {
        searchPanel:   document.getElementById('search-panel'),
        searchQuery:   document.getElementById('search-query'),
        searchResult:  document.getElementById('search-result'),
        resultName:    document.getElementById('result-name'),
        resultDetail:  document.getElementById('result-detail'),
        resultList:    document.getElementById('result-list'),
        formCard:      document.getElementById('form-card'),
        formTitle:     document.getElementById('form-title'),
        formState:     document.getElementById('form-state'),
        activoRow:     document.getElementById('activo-row'),
        activoBadge:   document.getElementById('activo-badge'),

        id:              document.getElementById('usr-id'),
        nombre:          document.getElementById('usr-nombre'),
        username:        document.getElementById('usr-username'),
        nivel:           document.getElementById('usr-nivel'),
        cargo:           document.getElementById('usr-cargo'),
        cuil:            document.getElementById('usr-cuil'),
        bucAcceso:       document.getElementById('usr-buc-acceso'),
        password:        document.getElementById('usr-password'),
        passwordConfirm: document.getElementById('usr-password-confirm'),
        passwordReqStar: document.getElementById('password-req-star'),
        passwordHint:    document.getElementById('password-hint'),

        btnBuscar:             document.getElementById('btn-buscar'),
        btnNuevo:              document.getElementById('btn-nuevo'),
        btnNuevoForzar:        document.getElementById('btn-nuevo-forzar'),
        btnEditarEncontrado:   document.getElementById('btn-editar-encontrado'),
        btnConsultarEncontrado:document.getElementById('btn-consultar-encontrado'),
        btnGuardar:            document.getElementById('btn-guardar'),
        btnCancelar:           document.getElementById('btn-cancelar'),
        btnEditar:             document.getElementById('btn-editar'),
        btnBaja:               document.getElementById('btn-baja'),
        btnReactivar:          document.getElementById('btn-reactivar'),
        btnModoTexto:          document.getElementById('btn-modo-texto'),
        btnModoNumero:         document.getElementById('btn-modo-numero'),
    };

    // ── Init ───────────────────────────────────────────────────
    attachEvents();
    els.searchQuery.focus();

    // ── Eventos ────────────────────────────────────────────────
    function attachEvents() {
        els.btnBuscar.addEventListener('click', buscar);
        els.searchQuery.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });

        els.btnNuevo.addEventListener('click', activarModoNuevo);
        els.btnNuevoForzar.addEventListener('click', activarModoNuevo);
        els.btnCancelar.addEventListener('click', handleCancelar);
        els.btnEditar.addEventListener('click', activarModoEdicion);
        els.btnGuardar.addEventListener('click', guardar);
        els.btnBaja.addEventListener('click', () => cambiarEstado(false));
        els.btnReactivar.addEventListener('click', () => cambiarEstado(true));

        els.btnModoTexto.addEventListener('click', () => setModoBusqueda('texto'));
        els.btnModoNumero.addEventListener('click', () => setModoBusqueda('numero'));
    }

    function setModoBusqueda(tipo) {
        state.busquedaTipo = tipo;
        if (tipo === 'texto') {
            els.btnModoTexto.classList.replace('z-btn--ghost', 'z-btn--primary');
            els.btnModoNumero.classList.replace('z-btn--primary', 'z-btn--ghost');
            els.searchQuery.placeholder = 'Ingresá nombre del usuario...';
        } else {
            els.btnModoNumero.classList.replace('z-btn--ghost', 'z-btn--primary');
            els.btnModoTexto.classList.replace('z-btn--primary', 'z-btn--ghost');
            els.searchQuery.placeholder = 'Ingresá CUIL o nombre de usuario...';
        }
        els.searchQuery.focus();
    }

    // ── Búsqueda ───────────────────────────────────────────────
    async function buscar() {
        const q = els.searchQuery.value.trim();
        if (!q) { ZUtils.toast('Ingresá un término de búsqueda', 'warning'); return; }

        ocultarResultados();
        try {
            const data = await ZUtils.apiFetch(
                `/usuarios/buscar?q=${encodeURIComponent(q)}&tipo=${state.busquedaTipo}`
            );
            mostrarResultados(data);
        } catch (err) {
            ZUtils.toast(err.message || 'Error al buscar', 'error');
        }
    }

    function mostrarResultados(usuarios) {
        els.searchResult.classList.add('visible');
        els.resultList.innerHTML = '';
        els.btnEditarEncontrado.style.display   = 'none';
        els.btnConsultarEncontrado.style.display = 'none';

        if (usuarios.length === 0) {
            els.resultName.textContent   = 'Sin resultados';
            els.resultDetail.textContent = 'No se encontraron usuarios con ese criterio.';
            return;
        }

        if (usuarios.length === 1) {
            const u = usuarios[0];
            els.resultName.textContent   = u.nombre;
            els.resultDetail.textContent = `${u.username} — Nivel ${u.nivel_acceso} (${NIVELES[u.nivel_acceso] || ''}) — ${u.activo ? 'Activo' : 'Inactivo'}`;
            els.btnEditarEncontrado.style.display    = 'inline-flex';
            els.btnConsultarEncontrado.style.display = 'inline-flex';

            els.btnEditarEncontrado.onclick    = () => cargarUsuario(u.id_usuario, 'edicion');
            els.btnConsultarEncontrado.onclick = () => cargarUsuario(u.id_usuario, 'consulta');
            return;
        }

        els.resultName.textContent   = `${usuarios.length} usuarios encontrados`;
        els.resultDetail.textContent = 'Seleccioná uno para continuar:';

        usuarios.forEach(u => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--z-border);';
            row.innerHTML = `
                <span style="font-size:0.88rem;">
                    <strong>${u.nombre}</strong>
                    <span style="color:var(--z-text2);margin-left:8px;">${u.username}</span>
                    <span style="color:var(--z-text3);margin-left:6px;font-size:0.78rem;">Nivel ${u.nivel_acceso}</span>
                    ${!u.activo ? '<span style="color:#C62828;font-size:0.75rem;margin-left:6px;">[Inactivo]</span>' : ''}
                </span>
                <span style="display:flex;gap:6px;">
                    <button class="z-btn z-btn--xs z-btn--primary" data-id="${u.id_usuario}" data-modo="edicion">Editar</button>
                    <button class="z-btn z-btn--xs z-btn--ghost"   data-id="${u.id_usuario}" data-modo="consulta">Ver</button>
                </span>
            `;
            row.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () =>
                    cargarUsuario(parseInt(btn.dataset.id), btn.dataset.modo)
                );
            });
            els.resultList.appendChild(row);
        });
    }

    function ocultarResultados() {
        els.searchResult.classList.remove('visible');
        els.resultList.innerHTML = '';
    }

    // ── Cargar usuario ─────────────────────────────────────────
    async function cargarUsuario(id, modo = 'consulta') {
        try {
            const u = await ZUtils.apiFetch(`/usuarios/${id}`);
            state.usuario = u;
            poblarFormulario(u);
            if (modo === 'edicion') activarModoEdicion();
            else activarModoConsulta();
            mostrarFormCard();
        } catch (err) {
            ZUtils.toast(err.message || 'Error al cargar usuario', 'error');
        }
    }

    // ── Poblar formulario ──────────────────────────────────────
    function poblarFormulario(u) {
        els.id.value              = u.id_usuario || '';
        els.nombre.value          = u.nombre     || '';
        els.username.value        = u.username   || '';
        els.nivel.value           = u.nivel_acceso || '';
        els.cargo.value           = u.id_cargo   || '';
        els.cuil.value            = u.cuil       || '';
        els.bucAcceso.checked     = u.buc_acceso || false;
        els.password.value        = '';
        els.passwordConfirm.value = '';
        actualizarBadgeActivo(u.activo);
    }

    function actualizarBadgeActivo(activo) {
        els.activoBadge.textContent = activo ? '● ACTIVO' : '● INACTIVO';
        els.activoBadge.className = 'z-form-state ' + (activo ? 'z-user-activo' : 'z-user-inactivo');
    }

    // ── Modos de formulario ────────────────────────────────────
    function activarModoNuevo() {
        state.modo    = 'nuevo';
        state.usuario = null;
        resetFormulario();
        mostrarFormCard();

        els.formTitle.textContent = 'Alta de Usuario';
        els.formState.textContent = '● NUEVO';
        els.formState.className   = 'z-form-state z-form-state--new';
        els.activoRow.style.display = 'none';

        setFieldsDisabled(false);
        els.username.readOnly = false;

        els.passwordReqStar.style.display = 'inline';
        els.passwordHint.textContent      = 'Requerida. Mínimo 8 caracteres.';
        els.passwordHint.className        = 'z-password-hint';

        els.btnGuardar.style.display   = 'inline-flex';
        els.btnEditar.style.display    = 'none';
        els.btnBaja.style.display      = 'none';
        els.btnReactivar.style.display = 'none';
        els.btnCancelar.textContent    = '✕ Cancelar';
        els.nombre.focus();
    }

    function activarModoEdicion() {
        state.modo = 'edicion';
        const u = state.usuario;

        els.formTitle.textContent = 'Editar Usuario';
        els.formState.textContent = '● EDICIÓN';
        els.formState.className   = 'z-form-state z-form-state--edit';
        els.activoRow.style.display = 'block';

        setFieldsDisabled(false);
        els.username.readOnly = true; // username no se puede cambiar

        els.passwordReqStar.style.display = 'none';
        els.passwordHint.textContent      = 'Dejar vacío para no cambiar la contraseña.';
        els.passwordHint.className        = 'z-password-hint z-password-hint--optional';

        els.btnGuardar.style.display   = 'inline-flex';
        els.btnEditar.style.display    = 'none';
        els.btnCancelar.textContent    = '✕ Salir';

        if (u && u.activo) {
            els.btnBaja.style.display      = 'inline-flex';
            els.btnReactivar.style.display = 'none';
        } else {
            els.btnBaja.style.display      = 'none';
            els.btnReactivar.style.display = 'inline-flex';
        }
    }

    function activarModoConsulta() {
        state.modo = 'consulta';

        els.formTitle.textContent = 'Consulta de Usuario';
        els.formState.textContent = '● CONSULTA';
        els.formState.className   = 'z-form-state z-form-state--view';
        els.activoRow.style.display = 'block';

        setFieldsDisabled(true);

        els.btnGuardar.style.display   = 'none';
        els.btnBaja.style.display      = 'none';
        els.btnReactivar.style.display = 'none';
        els.btnEditar.style.display    = 'inline-flex';
        els.btnCancelar.textContent    = '✕ Salir';
    }

    function setFieldsDisabled(disabled) {
        [els.nombre, els.username, els.nivel, els.cargo, els.cuil,
         els.bucAcceso, els.password, els.passwordConfirm].forEach(el => {
            el.disabled = disabled;
        });
    }

    function resetFormulario() {
        [els.id, els.nombre, els.username, els.cargo, els.cuil,
         els.password, els.passwordConfirm].forEach(el => el.value = '');
        els.nivel.value      = '';
        els.bucAcceso.checked = false;
        limpiarErrores();
    }

    function mostrarFormCard() {
        els.formCard.style.display = 'block';
        els.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Cancelar ───────────────────────────────────────────────
    async function handleCancelar() {
        if (state.modo === 'nuevo') {
            const tieneData = els.nombre.value || els.username.value || els.password.value;
            if (tieneData) {
                const ok = await ZUtils.confirm('Cancelar alta', '¿Descartár los datos ingresados?');
                if (!ok) return;
            }
            ocultarFormCard();
        } else {
            ocultarFormCard();
        }
    }

    function ocultarFormCard() {
        els.formCard.style.display = 'none';
        state.modo    = null;
        state.usuario = null;
    }

    // ── Validación ─────────────────────────────────────────────
    function validar() {
        limpiarErrores();
        let ok = true;

        if (!els.nombre.value.trim()) {
            showError('err-nombre', 'El nombre es requerido');
            ok = false;
        }
        if (!els.username.value.trim()) {
            showError('err-username', 'El nombre de usuario es requerido');
            ok = false;
        } else if (!/^[a-zA-Z0-9_.\-]+$/.test(els.username.value.trim())) {
            showError('err-username', 'Solo letras, números, puntos, guiones y guiones bajos');
            ok = false;
        }
        if (!els.nivel.value) {
            showError('err-nivel', 'Seleccioná un nivel de acceso');
            ok = false;
        }

        const pass = els.password.value;
        const passConfirm = els.passwordConfirm.value;

        if (state.modo === 'nuevo') {
            if (!pass) {
                showError('err-password', 'La contraseña es requerida');
                ok = false;
            } else if (pass.length < 8) {
                showError('err-password', 'Mínimo 8 caracteres');
                ok = false;
            }
        } else if (pass) {
            if (pass.length < 8) {
                showError('err-password', 'Mínimo 8 caracteres');
                ok = false;
            }
        }

        if (pass && pass !== passConfirm) {
            showError('err-password-confirm', 'Las contraseñas no coinciden');
            ok = false;
        }

        if (els.cuil.value.trim()) {
            const cuil = els.cuil.value.replace(/[-\s]/g, '');
            if (!/^\d{11}$/.test(cuil)) {
                showError('err-cuil', 'El CUIL debe contener 11 dígitos');
                ok = false;
            }
        }

        return ok;
    }

    function showError(id, msg) {
        const el = document.getElementById(id);
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    function limpiarErrores() {
        document.querySelectorAll('.z-input-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    // ── Guardar ────────────────────────────────────────────────
    async function guardar() {
        if (!validar()) return;

        const payload = {
            nombre:       els.nombre.value.trim(),
            nivel_acceso: parseInt(els.nivel.value),
            id_cargo:     els.cargo.value.trim() || null,
            cuil:         els.cuil.value.replace(/[-\s]/g, '') || null,
            buc_acceso:   els.bucAcceso.checked,
        };

        if (els.password.value) payload.password = els.password.value;

        try {
            els.btnGuardar.disabled = true;
            els.btnGuardar.textContent = '⏳ Guardando...';

            if (state.modo === 'nuevo') {
                payload.username = els.username.value.trim();
                const u = await ZUtils.apiFetch('/usuarios', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                ZUtils.modalGuardado(
                    'Usuario creado',
                    `${u.nombre} (${u.username}) fue registrado correctamente.`,
                    activarModoNuevo,
                    () => window.location.href = 'mainconfig.html'
                );
            } else {
                const u = await ZUtils.apiFetch(`/usuarios/${state.usuario.id_usuario}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                state.usuario = u;
                poblarFormulario(u);
                activarModoConsulta();
                ZUtils.toast('Usuario guardado correctamente', 'success');
            }
        } catch (err) {
            ZUtils.toast(err.message || 'Error al guardar', 'error');
        } finally {
            els.btnGuardar.disabled = false;
            els.btnGuardar.textContent = '💾 Guardar';
        }
    }

    // ── Alta / Baja ────────────────────────────────────────────
    async function cambiarEstado(nuevoActivo) {
        const accion = nuevoActivo ? 'reactivar' : 'dar de baja';
        const titulo = nuevoActivo ? 'Reactivar usuario' : 'Dar de baja usuario';
        const msg    = nuevoActivo
            ? `¿Reactivar al usuario <strong>${state.usuario.nombre}</strong>?`
            : `¿Dar de baja al usuario <strong>${state.usuario.nombre}</strong>? No podrá iniciar sesión.`;

        const ok = await ZUtils.confirm(titulo, msg);
        if (!ok) return;

        try {
            const u = await ZUtils.apiFetch(
                `/usuarios/${state.usuario.id_usuario}/estado?activo=${nuevoActivo}`,
                { method: 'PUT' }
            );
            state.usuario = u;
            poblarFormulario(u);
            activarModoEdicion();
            ZUtils.toast(nuevoActivo ? 'Usuario reactivado' : 'Usuario dado de baja', 'success');
        } catch (err) {
            ZUtils.toast(err.message || `Error al ${accion}`, 'error');
        }
    }

});
