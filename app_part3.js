// ════════════════════════════════════════════════════════
// 11. VISTA CONSULTA
// ════════════════════════════════════════════════════════
const POR_PAG = 15;

function initConsulta() {
  document.getElementById("btnFiltrar").addEventListener("click", renderTablaConsulta);
  document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
    document.getElementById("flt_apellido_desde").value = "";
    document.getElementById("flt_apellido_hasta").value = "";
    document.getElementById("flt_fecha_desde").value    = "";
    document.getElementById("flt_fecha_hasta").value    = "";
    document.getElementById("flt_sexo").value           = "";
    document.getElementById("flt_activo").value         = "true";
    document.getElementById("flt_texto").value          = "";
    renderTablaConsulta();
  });
  document.querySelectorAll("#tablaPersonas th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      if (app.sortCol === th.dataset.sort) app.sortDir *= -1;
      else { app.sortCol = th.dataset.sort; app.sortDir = 1; }
      app.pagina = 1;
      renderTablaConsulta();
    });
  });
  document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);
}

function aplicarFiltros() {
  const desde  = (document.getElementById("flt_apellido_desde").value||"").toLowerCase();
  const hasta  = document.getElementById("flt_apellido_hasta").value.toLowerCase();
  const fDesde = document.getElementById("flt_fecha_desde").value;
  const fHasta = document.getElementById("flt_fecha_hasta").value;
  const sexo   = document.getElementById("flt_sexo").value;
  const activo = document.getElementById("flt_activo").value;
  const texto  = document.getElementById("flt_texto").value.toLowerCase();

  return Store.getPersonas().filter(p => {
    const ap = (p.apellido||"").toLowerCase();
    if (desde && ap < desde) return false;
    if (hasta && ap > hasta) return false;
    if (activo === "true"  && p.activo === false) return false;
    if (activo === "false" && p.activo !== false) return false;
    if (sexo && p.sexo !== sexo) return false;
    if (fDesde && (p.created_at||"") < fDesde) return false;
    if (fHasta && (p.created_at||"") > (fHasta+"T23:59:59")) return false;
    if (texto) {
      const hay = v => String(v||"").toLowerCase().includes(texto);
      if (!hay(p.apellido) && !hay(p.nombre) && !hay(p.nro_doc) && !hay(p.email)) return false;
    }
    return true;
  });
}

function renderTablaConsulta() {
  const res = aplicarFiltros();
  res.sort((a,b) => {
    const col = app.sortCol;
    const av  = (a[col]||"").toString().toLowerCase();
    const bv  = (b[col]||"").toString().toLowerCase();
    return av < bv ? -app.sortDir : av > bv ? app.sortDir : 0;
  });
  app.resultados = res;
  const total  = res.length;
  const paginas= Math.ceil(total/POR_PAG) || 1;
  if (app.pagina > paginas) app.pagina = 1;
  const slice  = res.slice((app.pagina-1)*POR_PAG, app.pagina*POR_PAG);

  document.getElementById("tablaConteo").textContent = total ? `${total} registros (página ${app.pagina}/${paginas})` : "";
  const tbody = document.getElementById("tablaPersonasBody");
  tbody.innerHTML = "";
  document.getElementById("tablaVacia").hidden = total > 0;

  slice.forEach(p => {
    const tr  = document.createElement("tr");
    const tel = p.telefonos?.[0];
    const dir = p.domicilios?.[0];
    tr.innerHTML = `
      <td class="mono">${fmtDNI(p.nro_doc)}<br><small>${p.tipo_doc}</small></td>
      <td><strong>${p.apellido||""}</strong>, ${p.nombre||""}</td>
      <td>${p.sexo||""}</td>
      <td>${fmtFecha(p.fecha_nac)}</td>
      <td>${p.email?`<small>${p.email}</small>`:""}${tel?`<br><small>📱${tel.numero_raw||tel.numero||""}</small>`:""}${dir?`<br><small>📍${dir.calle||""} ${dir.numero||""}</small>`:""}</td>
      <td>${p.activo !== false ? "<span class='stat-activo'>Activo</span>" : "<span class='stat-inact'>Baja</span>"}</td>
      <td><small>${fmtFecha(p.created_at)}</small></td>
      <td><button class="btn btn--ghost btn--sm" data-id="${p.id}">✎ Editar</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", e => {
      const p = Store.getPersonas().find(x => x.id === +e.target.dataset.id);
      if (p) { showView("viewAbm"); abrirFormulario(p, {tipo_doc:p.tipo_doc, nro_doc:p.nro_doc, sexo:p.sexo}); }
    });
  });

  renderPaginacionConsulta(paginas, total);
}

function renderPaginacionConsulta(paginas, total) {
  const c = document.getElementById("paginacion");
  c.innerHTML = "";
  if (paginas <= 1) return;
  for (let i=1; i<=paginas; i++) {
    const b = document.createElement("button");
    b.className = "page-btn" + (i === app.pagina ? " page-btn--active" : "");
    b.textContent = i;
    b.addEventListener("click", () => { app.pagina = i; renderTablaConsulta(); });
    c.appendChild(b);
  }
}

function exportarCSV() {
  if (!Auth.puede("exportar")) return;
  const data = app.resultados.length ? app.resultados : Store.getPersonas();
  const cols = ["nro_doc","tipo_doc","apellido","nombre","sexo","fecha_nac","email","activo","created_at"];
  const rows = [cols.join(";")];
  data.forEach(p => rows.push(cols.map(c => JSON.stringify(p[c] ?? "")).join(";")));
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `BDS_personas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast("📥 CSV descargado", "ok");
}


// ════════════════════════════════════════════════════════
// 12. ADMIN PADRONES
// ════════════════════════════════════════════════════════
const PADRON_DEF = {
  paises:      { title:"Países",      cols:["codigo_iso2","nombre","activo"],       labels:["ISO2","Nombre","Activo"] },
  provincias:  { title:"Provincias",  cols:["nombre","activo"],                     labels:["Nombre","Activo"] },
  localidades: { title:"Localidades", cols:["nombre","id_provincia","cp","activo"], labels:["Nombre","Prov. ID","CP","Activo"] },
  combos:      { title:"Combos",      cols:["categoria","codigo","descripcion","activo"], labels:["Categoría","Código","Descripción","Activo"] },
};

let _padronActual   = "paises";
let _padronPagina   = 1;
let _padronEditId   = null;
let _importPendiente= [];

function initPadrones() {
  document.querySelectorAll(".subtab").forEach(bt => {
    bt.addEventListener("click", () => {
      document.querySelectorAll(".subtab").forEach(b => { b.classList.remove("subtab--active"); b.setAttribute("aria-selected","false"); });
      bt.classList.add("subtab--active"); bt.setAttribute("aria-selected","true");
      renderPadrones(bt.dataset.padron);
    });
  });
  document.getElementById("padronBusqueda").addEventListener("input", () => renderPadrones(_padronActual));
  document.getElementById("btnPadronNuevo").addEventListener("click", () => abrirModalPadron(null));
  document.getElementById("btnCancelarPadron").addEventListener("click", () => { document.getElementById("modalPadron").hidden=true; });
  document.getElementById("formPadron").addEventListener("submit", e => { e.preventDefault(); guardarPadronItem(); });
  document.getElementById("importCSVInput").addEventListener("change", e => leerCSVImport(e.target.files[0]));
  document.getElementById("btnCancelarImport").addEventListener("click", () => { document.getElementById("modalImportCSV").hidden=true; });
  document.getElementById("btnConfirmarImport").addEventListener("click", confirmarImportCSV);
}

function renderPadrones(nombre) {
  _padronActual = nombre;
  _padronPagina = 1;
  const def   = PADRON_DEF[nombre];
  const texto = (document.getElementById("padronBusqueda").value||"").toLowerCase();
  let data    = Store.getPadron(nombre).filter(x => !texto || def.cols.some(c => String(x[c]||"").toLowerCase().includes(texto)));

  const thead = document.getElementById("tablaPadronHead");
  thead.innerHTML = `<tr>${def.labels.map(l => `<th scope="col">${l}</th>`).join("")}<th>Acciones</th></tr>`;

  const PER_PAD = 20;
  const pags    = Math.ceil(data.length/PER_PAD) || 1;
  if (_padronPagina > pags) _padronPagina = 1;
  const slice   = data.slice((_padronPagina-1)*PER_PAD, _padronPagina*PER_PAD);

  document.getElementById("padronConteo").textContent = `${data.length} registros`;
  document.getElementById("padronVacio").hidden = data.length > 0;

  const tbody = document.getElementById("tablaPadronBody");
  tbody.innerHTML = "";
  slice.forEach(row => {
    const tr = document.createElement("tr");
    if (row.activo === false) tr.classList.add("row--inact");
    tr.innerHTML = def.cols.map(c => `<td>${c === "activo" ? (row[c] !== false ? "✅" : "❌") : String(row[c] ?? "")}</td>`).join("")
      + `<td><button class="btn btn--ghost btn--sm" data-edit="${row.id}">✎</button> `
      + (row.activo !== false ? `<button class="btn btn--danger btn--sm" data-baja="${row.id}">⊘</button>` : "<span class='stat-inact'>Baja</span>") + "</td>";
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", e => abrirModalPadron(+e.target.dataset.edit)));
  tbody.querySelectorAll("[data-baja]").forEach(b => b.addEventListener("click", e => {
    if (confirm("¿Confirmar baja lógica?")) {
      Store.bajaPadronItem(_padronActual, +e.target.dataset.baja);
      renderPadrones(_padronActual);
      showToast("Baja registrada", "warn");
    }
  }));

  const pagin = document.getElementById("padronPaginacion");
  pagin.innerHTML = "";
  if (pags > 1) {
    for (let i=1; i<=pags; i++) {
        const b = document.createElement("button");
        b.className = "page-btn" + (i === _padronPagina ? " page-btn--active" : "");
        b.textContent = i;
        b.addEventListener("click", () => { _padronPagina = i; renderPadrones(_padronActual); });
        pagin.appendChild(b);
    }
  }
}

function abrirModalPadron(id) {
  _padronEditId = id;
  const def    = PADRON_DEF[_padronActual];
  const item   = id ? Store.getPadron(_padronActual).find(x => x.id === id) : null;
  document.getElementById("modalPadronTitle").textContent = id ? `Editar — ${def.title}` : `Nuevo — ${def.title}`;
  const campos = document.getElementById("formPadronCampos");
  campos.innerHTML = def.cols.filter(c => c !== "activo").map(c => `
    <div class="form-group">
      <label class="form-label" for="padF_${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</label>
      <input type="text" id="padF_${c}" class="form-control" value="${item?.[c] ?? ""}" required />
    </div>`).join("");
  document.getElementById("padronError").hidden = true;
  document.getElementById("modalPadron").hidden = false;
  campos.querySelector("input")?.focus();
}

function guardarPadronItem() {
  const def   = PADRON_DEF[_padronActual];
  const datos = { id: _padronEditId || Store.nextPadronId(_padronActual), activo: true };
  def.cols.filter(c => c !== "activo").forEach(c => {
    const el = document.getElementById(`padF_${c}`);
    if (el) datos[c] = el.value.trim();
  });
  Store.savePadronItem(_padronActual, datos);
  document.getElementById("modalPadron").hidden = true;
  renderPadrones(_padronActual);
  showToast(_padronEditId ? "✅ Actualizado" : "✅ Creado", "ok");
}

function leerCSVImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;
    const sep    = lines[0].includes(";") ? ";" : ",";
    const headers= lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
    _importPendiente = lines.slice(1).filter(l => l.trim()).map(l => {
      const vals = l.split(sep).map(v => v.trim().replace(/['"]/g, ""));
      const obj  = { activo: true };
      headers.forEach((h,i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    document.getElementById("modalImportTitle").textContent = `📂 Importar — ${PADRON_DEF[_padronActual].title}`;
    document.getElementById("modalImportDesc").textContent = `${_importPendiente.length} registros detectados. Columnas: ${headers.join(", ")}`;
    const prev = document.getElementById("importPreview");
    prev.innerHTML = "<table class='data-table'><thead><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>" +
      _importPendiente.slice(0,5).map(r => "<tr>" + headers.map(h => `<td>${r[h]??""}</td>`).join("") + "</tr>").join("") + "</tbody></table>";
    document.getElementById("importError").hidden = true;
    document.getElementById("modalImportCSV").hidden = false;
    document.getElementById("importCSVInput").value = "";
  };
  reader.readAsText(file, "utf-8");
}

function confirmarImportCSV() {
  if (!_importPendiente.length) return;
  let ok = 0;
  _importPendiente.forEach(item => {
    const next = Store.nextPadronId(_padronActual);
    Store.savePadronItem(_padronActual, { ...item, id: next, activo: true });
    ok++;
  });
  document.getElementById("modalImportCSV").hidden = true;
  _importPendiente = [];
  renderPadrones(_padronActual);
  showToast(`📂 ${ok} registros importados`, "ok");
}

// ════════════════════════════════════════════════════════
// 13. AUDITORÍA
// ════════════════════════════════════════════════════════
function renderAudit() {
  const log = document.getElementById("auditLog");
  const data= Store.getAudit();
  if (!data.length) { log.innerHTML="<p class='empty-state'>No hay operaciones registradas.</p>"; return; }
  log.innerHTML = data.map(e => `
    <div class="audit-entry">
      <span class="audit-op audit-op--${(e.op||"").toLowerCase()}">${e.op}</span>
      <span class="audit-info"><strong>${e.apellido || e.nombre || ""}</strong> — DNI ${fmtDNI(e.dni)}</span>
      <span class="audit-user">${e.usuario||""}</span>
      <span class="audit-ts">${fmtFecha(e.ts)}</span>
    </div>`).join("");
}

// ════════════════════════════════════════════════════════
// 14. BOOTSTRAP
// ════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initNav();
  initABM();
  initConsulta();
  try { initPadrones(); } catch (e) {}
});
