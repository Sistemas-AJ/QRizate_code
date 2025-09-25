// ver-datos.js
// Conexión automática a IP y puerto desde Electron (igual que index)
let electronIp = null;
let electronPort = null;
let datosCargados = false;
function setElectronIp(ip) {
  if (ip && ip !== electronIp) {
    electronIp = ip;
    localStorage.setItem('qr_app_ip', ip);
    intentarCargarDatosElectron();
  }
}
function setElectronPort(port) {
  if (port && port !== electronPort) {
    electronPort = port;
    localStorage.setItem('qr_app_port', port);
    intentarCargarDatosElectron();
  }
}
function intentarCargarDatosElectron() {
  if (electronIp && electronPort && !datosCargados) {
    datosCargados = true;
    cargarDatos();
  }
}
window.addEventListener('DOMContentLoaded', function() {
  if (window.electronAPI && window.electronAPI.onSetApiPort) {
    window.electronAPI.onSetApiPort(setElectronPort);
  }
  if (window.electronAPI && window.electronAPI.onSetLocalIp) {
    window.electronAPI.onSetLocalIp(setElectronIp);
  }
  // Si no es Electron, cargar datos directamente
  if (!(window.electronAPI && (window.electronAPI.onSetApiPort || window.electronAPI.onSetLocalIp))) {
    cargarDatos();
  }
});

// --- LÓGICA DE TABLA Y FILTRO ---
let datosGlobal = [];

function getIpPort() {
  let ip = localStorage.getItem('qr_app_ip') || 'localhost';
  let port = localStorage.getItem('qr_app_port') || '8000';
  ip = ip.trim() || 'localhost';
  port = port.toString().trim() || '8000';
  return {ip, port};
}

function cargarDatos() {
  const {ip, port} = getIpPort();
  document.getElementById('tabla-datos').innerHTML = '<em>Cargando...</em>';
  fetch(`http://${ip}:${port}/activos/?skip=0&limit=100000`)
    .then(res => res.ok ? res.json() : res.text().then(t => {throw new Error(t)}))
    .then(data => {
      datosGlobal = Array.isArray(data) ? data : [];
      renderTabla(datosGlobal);
    })
    .catch(err => {
      document.getElementById('tabla-datos').innerHTML = `<span style='color:red;'>Error al obtener los datos: ${err.message}</span>`;
    });
}

function renderTabla(datos) {
  if (!Array.isArray(datos) || !datos.length) {
    document.getElementById('tabla-datos').innerHTML = '<em>No hay datos para mostrar.</em>';
    return;
  }
  let cols = Object.keys(datos[0]);
  let html = `<table class="mejorada">
    <thead><tr>`;
  cols.forEach(col => { html += `<th>${col}</th>`; });
  html += '<th>Acciones</th></tr></thead><tbody>';
  datos.forEach((row, i) => {
    html += `<tr>`;
    cols.forEach(col => {
      let val = row[col] ?? '';
      let safeVal = (val+'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += `<td>${safeVal}</td>`;
    });
    html += `<td>
      <button class='edit-btn app-bar-btn' data-idx='${i}' style="background:#003B67;color:#fff;border:none;padding:8px 18px;border-radius:10px;margin-right:8px;font-weight:600;transition:all 0.3s;">✏️ Editar</button>
      <button class='delete-btn app-bar-btn' data-idx='${i}' style="background:#FF6B00;color:#fff;border:none;padding:8px 18px;border-radius:10px;font-weight:600;transition:all 0.3s;">🗑️ Eliminar</button>
    </td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('tabla-datos').innerHTML = html;
  // Asignar eventos a los botones
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = function() {
      const idx = this.getAttribute('data-idx');
      eliminarRegistro(idx);
    };
  });
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = function() {
      const idx = this.getAttribute('data-idx');
      editarRegistro(idx);
    };
  });
}

// Notificación visual (no bloquea foco)
function showNotification(msg, type = 'info', timeout = 3000) {
  let area = document.getElementById('notification-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'notification-area';
    area.style.position = 'fixed';
    area.style.top = '16px';
    area.style.right = '16px';
    area.style.zIndex = '9999';
    document.body.appendChild(area);
  }
  const notif = document.createElement('div');
  notif.textContent = msg;
  notif.className = 'notif notif-' + type;
  notif.style.background = type === 'error' ? '#e74c3c' : (type === 'success' ? '#003B67' : '#FF6B00');
  notif.style.color = '#fff';
  notif.style.padding = '12px 24px';
  notif.style.marginBottom = '10px';
  notif.style.borderRadius = '10px';
  notif.style.boxShadow = '0 2px 8px #0002';
  notif.style.fontWeight = '600';
  notif.style.fontSize = '1rem';
  notif.style.opacity = '0.95';
  area.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 400);
  }, timeout);
}

// Eliminar registro
function eliminarRegistro(idx) {
  const row = datosGlobal[idx];
  if (!row || !row.id) return showNotification('No se puede eliminar: ID no encontrado', 'error');
  showConfirm('¿Seguro que deseas eliminar este registro?', () => {
    const {ip, port} = getIpPort();
    fetch(`http://${ip}:${port}/activos/${row.id}`, { method: 'DELETE' })
      .then(res => {
        if (res.status === 204) {
          showNotification('Registro eliminado correctamente', 'success');
          cargarDatos();
        } else {
          res.text().then(t => showNotification('Error al eliminar: ' + t, 'error'));
        }
      })
      .catch(err => showNotification('Error al eliminar: ' + err.message, 'error'));
  });
}

// Confirmación visual personalizada centrada con overlay
function showConfirm(msg, onConfirm, timeout = 0) {
  // Crear overlay
  let overlay = document.getElementById('confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.25)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    document.body.appendChild(overlay);
  }
  // Crear modal
  const modal = document.createElement('div');
  modal.className = 'notif notif-confirm';
  modal.style.background = '#003B67';
  modal.style.color = '#fff';
  modal.style.padding = '32px 38px';
  modal.style.borderRadius = '16px';
  modal.style.boxShadow = '0 8px 32px #0003';
  modal.style.fontWeight = '600';
  modal.style.fontSize = '1.1rem';
  modal.style.textAlign = 'center';
  modal.style.maxWidth = '90vw';
  modal.innerHTML = `<div style='margin-bottom:18px;font-size:1.1em;'>${msg}</div>
    <button id='btn-confirm-yes' style='background:#FF6B00;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-weight:600;margin-right:18px;cursor:pointer;font-size:1em;'>Sí, eliminar</button>
    <button id='btn-confirm-no' style='background:#64748b;color:#fff;border:none;padding:10px 28px;border-radius:10px;font-weight:600;cursor:pointer;font-size:1em;'>Cancelar</button>`;
  overlay.appendChild(modal);
  // Botones
  const btnConfirm = modal.querySelector('#btn-confirm-yes');
  const btnCancel = modal.querySelector('#btn-confirm-no');
  btnConfirm.onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };
  btnCancel.onclick = () => overlay.remove();
  // Cerrar con Escape
  window.addEventListener('keydown', function escListener(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', escListener);
    }
  });
  if (timeout > 0) setTimeout(() => overlay.remove(), timeout);
}

// Editar registro (formulario inline simple)
function editarRegistro(idx) {
  const row = datosGlobal[idx];
  if (!row || !row.id) return showNotification('No se puede editar: ID no encontrado', 'error');
  let cols = Object.keys(row);
  // Crear una nueva fila con inputs editables
  const table = document.querySelector('#tabla-datos table.mejorada');
  const tr = table && table.tBodies[0].rows[idx];
  if (!tr) return;
  // Construir los inputs, solo para campos editables (evitar editar id)
  let formHtml = '';
  cols.forEach(col => {
    let val = row[col] ?? '';
    if (col === 'id') {
      formHtml += `<td><input type='text' value='${(val+'').replace(/'/g,'&#39;')}' data-col='${col}' style='width:100px;' readonly></td>`;
    } else {
      formHtml += `<td><input type='text' value='${(val+'').replace(/'/g,'&#39;')}' data-col='${col}' style='width:100px;'></td>`;
    }
  });
  formHtml += `<td>
    <button class='save-edit-btn' data-idx='${idx}' style='background:#003B67;color:#fff;border:none;padding:6px 16px;border-radius:8px;'>Guardar</button>
    <button class='cancel-edit-btn' data-idx='${idx}' style='background:#FF6B00;color:#fff;border:none;padding:6px 16px;border-radius:8px;margin-left:8px;'>Cancelar</button>
  </td>`;
  tr.innerHTML = formHtml;
  // Asignar eventos
  tr.querySelector('.save-edit-btn').onclick = function() {
    const inputs = tr.querySelectorAll('input[data-col]');
    let nuevo = {...row};
    inputs.forEach(inp => {
      nuevo[inp.getAttribute('data-col')] = inp.value;
    });
    const {ip, port} = getIpPort();
    fetch(`http://${ip}:${port}/activos/${row.id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(nuevo)
    })
    .then(res => res.ok ? res.json() : res.text().then(t => {throw new Error(t)}))
    .then(data => {
      showNotification('Registro actualizado', 'success');
      cargarDatos();
    })
    .catch(err => showNotification('Error al actualizar: ' + err.message, 'error'));
  };
  tr.querySelector('.cancel-edit-btn').onclick = function() {
    renderTabla(datosGlobal);
  };
}

// Filtro en tiempo real
window.addEventListener('DOMContentLoaded', function() {
  const filtro = document.getElementById('filtro');
  if (filtro) {
    filtro.addEventListener('input', function() {
      const val = this.value.trim().toLowerCase();
      if (!val) {
        renderTabla(datosGlobal);
        return;
      }
      const filtrados = datosGlobal.filter(row =>
        Object.values(row).some(v => (v+'').toLowerCase().includes(val))
      );
      renderTabla(filtrados);
    });
  }
  const recargarBtn = document.getElementById('recargar-btn');
  if (recargarBtn) {
    recargarBtn.addEventListener('click', cargarDatos);
  }
});