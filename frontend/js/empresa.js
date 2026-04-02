/**
 * ZARIS — Lógica del Formulario de Empresa (independiente)
 * Gestión de empresa sin flujo desde ciudadano.
 * El campo Tipo Representación NO se muestra en este modo.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ── State ──
    const state = {
        mode: 'search',
        empresaId: null,
        actividades: []
    };

    // ── Elements ──
    const els = {
        searchPanel:    document.getElementById('search-panel'),
        searchQuery:    document.getElementById('search-query'),
        searchResult:   document.getElementById('search-result'),
        resultName:     document.getElementById('result-name'),
        resultDetail:   document.getElementById('result-detail'),
        formCard:       document.getElementById('form-card'),
        formEmpresa:    document.getElementById('form-empresa'),
        formTitle:      document.getElementById('form-title'),
        formState:      document.getElementById('form-state'),
        obsTextarea:    document.getElementById('emp-observaciones'),
        obsCount:       document.getElementById('obs-count'),
        badgeCategoria: document.getElementById('badge-categoria'),

        // Buttons
        btnBuscar:          document.getElementById('btn-buscar'),
        btnNuevo:           document.getElementById('btn-nuevo'),
        btnEditarEncontrado: document.getElementById('btn-editar-encontrado'),
        btnNuevoForzar:     document.getElementById('btn-nuevo-forzar'),
        btnGuardar:         document.getElementById('btn-guardar'),
        btnCancelar:        document.getElementById('btn-cancelar'),
        btnValidarCuit:     document.getElementById('btn-validar-cuit'),
    };

    // ── Init ──
    init();

    async function init() {
        attachEvents();
        await cargarActividades();
        els.searchQuery.focus();
    }

    // ── Cargar Actividades ──
    async function cargarActividades() {
        try {
            state.actividades = await ZUtils.apiFetch('/actividades');
            const sel = document.getElementById('emp-actividad');
            sel.innerHTML = '<option value="">Seleccionar actividad...</option>';

            // Agrupar por categoría
            const grupos = {};
            state.actividades.forEach(a => {
                if (!grupos[a.categoria_tasa]) grupos[a.categoria_tasa] = [];
                grupos[a.categoria_tasa].push(a);
            });

            Object.entries(grupos).forEach(([cat, acts]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = cat.charAt(0).toUpperCase() + cat.slice(1);
                acts.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.id;
                    opt.dataset.categoria = a.categoria_tasa;
                    opt.textContent = `${a.codigo_clae} — ${a.descripcion}`;
                    optgroup.appendChild(opt);
                });
                sel.appendChild(optgroup);
            });

            console.log('[ZARIS] Actividades cargadas desde API');
        } catch (err) {
            console.error('[ZARIS] Error cargando actividades:', err);
            ZUtils.toast('Error cargando actividades desde el servidor', 'error');
        }
    }

    // ── Eventos ──
    function attachEvents() {
        // Búsqueda
        els.btnBuscar.addEventListener('click', handleBuscar);
        els.searchQuery.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleBuscar(); }
        });

        // Nuevo
        els.btnNuevo.addEventListener('click', () => activarModoNuevo());
        els.btnNuevoForzar.addEventListener('click', () => activarModoNuevo());
        els.btnEditarEncontrado.addEventListener('click', () => activarModoEdicion());

        // CUIT
        els.btnValidarCuit.addEventListener('click', handleValidarCuit);
        document.getElementById('emp-cuit').addEventListener('input', formatCuitInput);

        // Actividad -> badge categoría
        document.getElementById('emp-actividad').addEventListener('change', (e) => {
            const selected = e.target.options[e.target.selectedIndex];
            if (selected && selected.dataset.categoria) {
                const cat = selected.dataset.categoria;
                const colors = {
                    comercio: { bg: '#E3F2FD', color: '#1565C0' },
                    servicios: { bg: '#E8F5E9', color: '#2E7D32' },
                    industria: { bg: '#FFF8E1', color: '#F57F17' }
                };
                const c = colors[cat] || { bg: '#F5F5F5', color: '#333' };
                els.badgeCategoria.textContent = `Categoría: ${cat.toUpperCase()}`;
                els.badgeCategoria.style.background = c.bg;
                els.badgeCategoria.style.color = c.color;
                els.badgeCategoria.style.display = 'inline-flex';
            } else {
                els.badgeCategoria.style.display = 'none';
            }
        });

        // Guardar/Cancelar
        els.btnGuardar.addEventListener('click', handleGuardar);
        els.btnCancelar.addEventListener('click', handleCancelar);

        // Observaciones counter
        els.obsTextarea.addEventListener('input', () => {
            els.obsCount.textContent = els.obsTextarea.value.length;
        });
    }

    // ── Búsqueda ──
    async function handleBuscar() {
        const query = els.searchQuery.value.trim();
        if (!query) {
            ZUtils.toast('Ingresá un CUIT o Email para buscar.', 'warning');
            els.searchQuery.focus();
            return;
        }

        try {
            const resultados = await ZUtils.apiFetch(`/empresas/buscar?q=${encodeURIComponent(query)}`);
            if (resultados.length === 0) {
                ZUtils.toast('No se encontró ninguna empresa con esos datos.', 'info');
                els.searchResult.classList.remove('visible');
            } else {
                const emp = resultados[0];
                els.resultName.textContent = emp.nombre;
                els.resultDetail.textContent = `CUIT: ${emp.cuit} | ${emp.email}`;
                els.searchResult.classList.add('visible');
                state.empresaEncontrada = emp;
            }
        } catch (err) {
            ZUtils.toast('Error en la búsqueda: ' + err.message, 'error');
        }
    }

    // ── Modo Nuevo ──
    function activarModoNuevo() {
        state.mode = 'new';
        state.empresaId = null;

        els.formEmpresa.reset();
        els.formCard.style.display = 'block';
        els.formTitle.textContent = 'Alta de Empresa';
        els.formState.className = 'z-form-state z-form-state--new';
        els.formState.textContent = '● NUEVO';
        els.badgeCategoria.style.display = 'none';
        els.searchResult.classList.remove('visible');
        els.obsCount.textContent = '0';

        // Limpiar validaciones
        els.formEmpresa.querySelectorAll('.z-input, .z-select, .z-textarea').forEach(el => {
            ZValidaciones.limpiarCampo(el);
        });

        setTimeout(() => {
            els.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        document.getElementById('emp-cuit').focus();
    }

    // ── Modo Edición ──
    function activarModoEdicion() {
        state.mode = 'edit';
        els.formCard.style.display = 'block';
        els.formTitle.textContent = 'Modificar Empresa';
        els.formState.className = 'z-form-state z-form-state--edit';
        els.formState.textContent = '✏️ EDICIÓN';

        setTimeout(() => {
            els.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // ── Validar CUIT ──
    function handleValidarCuit() {
        const input = document.getElementById('emp-cuit');
        const result = ZValidaciones.validarCuilCuit(input.value);

        if (result.valido) {
            input.value = result.formateado;
            ZValidaciones.marcarCampo(input, true);
            ZUtils.toast('CUIT válido ✓', 'success');
        } else {
            ZValidaciones.marcarCampo(input, false, result.error);
            ZUtils.toast(result.error, 'error');
        }
    }

    function formatCuitInput(e) {
        let val = e.target.value.replace(/[^0-9-]/g, '');
        const digits = val.replace(/-/g, '');
        if (digits.length >= 2 && digits.length <= 10) {
            val = digits.substring(0, 2) + '-' + digits.substring(2);
        } else if (digits.length >= 11) {
            val = digits.substring(0, 2) + '-' + digits.substring(2, 10) + '-' + digits.substring(10, 11);
        }
        e.target.value = val;
    }

    // ── Guardar ──
    async function handleGuardar() {
        const { valido, errores } = ZValidaciones.validarFormulario(els.formEmpresa);

        // Validaciones específicas
        const cuit = document.getElementById('emp-cuit').value;
        if (cuit) {
            const cuitResult = ZValidaciones.validarCuilCuit(cuit);
            if (!cuitResult.valido) {
                ZValidaciones.marcarCampo(document.getElementById('emp-cuit'), false, cuitResult.error);
                errores.push('CUIT inválido');
            }
        }

        const email = document.getElementById('emp-email').value;
        if (email && !ZValidaciones.validarEmail(email)) {
            ZValidaciones.marcarCampo(document.getElementById('emp-email'), false, 'Formato de email inválido');
            errores.push('Email inválido');
        }

        const telefono = document.getElementById('emp-telefono').value;
        if (telefono) {
            const telResult = ZValidaciones.validarTelefono(telefono);
            if (!telResult.valido) {
                ZValidaciones.marcarCampo(document.getElementById('emp-telefono'), false, telResult.error);
                errores.push('Teléfono inválido');
            }
        }

        if (errores.length > 0) {
            ZUtils.toast(`Hay ${errores.length} error(es). Revisá los campos marcados.`, 'error');
            return;
        }

        const formData = new FormData(els.formEmpresa);
        const data = Object.fromEntries(formData.entries());
        data.email_chk = false;

        // Formatear CUIT
        const cuitResult = ZValidaciones.validarCuilCuit(data.cuit);
        if (cuitResult.valido) data.cuit = cuitResult.formateado;

        try {
            const response = await ZUtils.apiFetch('/empresas', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            state.empresaId = response.id_empresa;
            ZUtils.toast('Empresa guardada exitosamente (ID: ' + response.id_empresa + ')', 'success');

            setTimeout(() => {
                if (confirm('¿Deseas dar de alta otra empresa?')) {
                    activarModoNuevo();
                } else {
                    window.location.href = 'menu.html';
                }
            }, 1000);
        } catch (err) {
            ZUtils.toast(`Error al guardar: ${err.message}`, 'error');
        }
    }

    // ── Cancelar ──
    async function handleCancelar() {
        const confirmed = await ZUtils.confirm(
            '¿Salir del formulario?',
            'Los datos no guardados se perderán. ¿Estás seguro que deseas salir?'
        );
        if (confirmed) {
            window.location.href = 'menu.html';
        }
    }

    // ── Datos de actividades ──
    function getActividadesData() {
        return [
            {id:1,codigo_clae:471100,descripcion:'Venta menor - alimentos (no especializados)',categoria_tasa:'comercio'},
            {id:2,codigo_clae:472100,descripcion:'Venta menor - alimentos (especializados)',categoria_tasa:'comercio'},
            {id:3,codigo_clae:473000,descripcion:'Venta menor - combustibles',categoria_tasa:'comercio'},
            {id:4,codigo_clae:475100,descripcion:'Venta menor - textiles',categoria_tasa:'comercio'},
            {id:5,codigo_clae:476100,descripcion:'Venta menor - libros/papelería',categoria_tasa:'comercio'},
            {id:6,codigo_clae:477100,descripcion:'Venta menor - prendas de vestir',categoria_tasa:'comercio'},
            {id:7,codigo_clae:478100,descripcion:'Venta menor - alimentos móviles',categoria_tasa:'comercio'},
            {id:8,codigo_clae:461000,descripcion:'Venta mayor - retribución/contrata',categoria_tasa:'comercio'},
            {id:9,codigo_clae:551000,descripcion:'Alojamiento hotelero',categoria_tasa:'servicios'},
            {id:10,codigo_clae:561000,descripcion:'Restaurantes y expendio de comidas',categoria_tasa:'servicios'},
            {id:11,codigo_clae:620100,descripcion:'Programación informática',categoria_tasa:'servicios'},
            {id:12,codigo_clae:631100,descripcion:'Procesamiento de datos',categoria_tasa:'servicios'},
            {id:13,codigo_clae:641900,descripcion:'Intermediación monetaria',categoria_tasa:'servicios'},
            {id:14,codigo_clae:681000,descripcion:'Actividades inmobiliarias',categoria_tasa:'servicios'},
            {id:15,codigo_clae:691000,descripcion:'Actividades jurídicas',categoria_tasa:'servicios'},
            {id:16,codigo_clae:692000,descripcion:'Contabilidad y auditoría',categoria_tasa:'servicios'},
            {id:17,codigo_clae:711000,descripcion:'Arquitectura e ingeniería',categoria_tasa:'servicios'},
            {id:18,codigo_clae:750000,descripcion:'Actividades veterinarias',categoria_tasa:'servicios'},
            {id:19,codigo_clae:851000,descripcion:'Enseñanza inicial y primaria',categoria_tasa:'servicios'},
            {id:20,codigo_clae:862000,descripcion:'Médicos y odontólogos',categoria_tasa:'servicios'},
            {id:21,codigo_clae:101000,descripcion:'Elaboración de carne',categoria_tasa:'industria'},
            {id:22,codigo_clae:105000,descripcion:'Productos lácteos',categoria_tasa:'industria'},
            {id:23,codigo_clae:110000,descripcion:'Elaboración de bebidas',categoria_tasa:'industria'},
            {id:24,codigo_clae:251100,descripcion:'Productos metálicos estructurales',categoria_tasa:'industria'},
            {id:25,codigo_clae:310000,descripcion:'Muebles y colchones',categoria_tasa:'industria'}
        ];
    }
});
