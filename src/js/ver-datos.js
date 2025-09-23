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
  fetch(`http://${ip}:${port}/activos/`)
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
  html += '</tr></thead><tbody>';
  datos.forEach((row, i) => {
    html += `<tr>`;
    cols.forEach(col => {
      let val = row[col] ?? '';
      let safeVal = (val+'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += `<td>${safeVal}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('tabla-datos').innerHTML = html;
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