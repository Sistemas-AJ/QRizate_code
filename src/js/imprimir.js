// --- INTEGRACIÓN CON ELECTRON PARA IP Y PUERTO ---
let electronIp = null;
let electronPort = null;
let datosCargados = false;
function setElectronIp(ip) {
  if (ip && ip !== electronIp) {
    electronIp = ip;
    localStorage.setItem('qr_app_ip', ip);
    intentarCargarQRsElectron();
  }
}
function setElectronPort(port) {
  if (port && port !== electronPort) {
    electronPort = port;
    localStorage.setItem('qr_app_port', port);
    intentarCargarQRsElectron();
  }
}
function intentarCargarQRsElectron() {
  if (electronIp && electronPort && !datosCargados) {
    datosCargados = true;
    if (typeof cargarQRs === 'function') cargarQRs();
  }
}
window.addEventListener('DOMContentLoaded', function() {
  if (window.electronAPI && window.electronAPI.onSetApiPort) {
    window.electronAPI.onSetApiPort(setElectronPort);
  }
  if (window.electronAPI && window.electronAPI.onSetLocalIp) {
    window.electronAPI.onSetLocalIp(setElectronIp);
  }
  // Si no es Electron, cargar QRs directamente
  if (!(window.electronAPI && (window.electronAPI.onSetApiPort || window.electronAPI.onSetLocalIp))) {
    if (typeof cargarQRs === 'function') cargarQRs();
  }
});

function getIpPort() {
  let ip = localStorage.getItem('qr_app_ip') || '127.0.0.1';
  let port = localStorage.getItem('qr_app_port') || '8000';
  ip = ip.trim() || '127.0.0.1';
  port = port.toString().trim() || '8000';
  return {ip, port};
}
let qrItems = [];
let qrRawData = [];

function renderQRCard(item) {
  const {ip, port} = getIpPort();
  const id = item.id || item.codigo_activo || item.codigo || '';
  const codigo = item.codigo_activo || item.codigo || item.id || '';
  const url = item.url;
  const qrDivId = `qrgen_${id}`;
  return `<div class='qr-card'>
    <div id='${qrDivId}' class='qr-canvas-holder' style='width:100px;height:100px;margin:0 auto 2px auto; margin-bottom: 0px;'></div>
    <a href='${url}' target='_blank' style='color:#000000;text-decoration:none; font-size:10px;'>${codigo}</a><br>
  </div>`;
}

function generarTodosLosQRs() {
  const {ip, port} = getIpPort();
  qrRawData.forEach(item => {
    const id = item.id || item.codigo_activo || item.codigo || '';
    const qrDivId = `qrgen_${id}`;
    const qrDiv = document.getElementById(qrDivId);
    if (qrDiv) {
      qrDiv.innerHTML = '';
      const c = document.createElement('canvas');
      qrDiv.appendChild(c);
      window.generarQRCanvas(c, item.url, 120);
    }
  });
}

window.makeQrCanvas = function(divId, text) {
  var qrDiv = document.getElementById(divId);
  if (qrDiv) {
    qrDiv.style.display = 'block';
    qrDiv.innerHTML = '';
    var canvas = document.createElement('canvas');
    qrDiv.appendChild(canvas);
    // Tamaño fijo para index, pero aquí podrías calcular según contexto si lo necesitas
    window.generarQRCanvas(canvas, text, 120);
  }
}

window.addEventListener('DOMContentLoaded', function() {
  // Siempre cargar los QRs desde la API al iniciar
  if (typeof cargarQRs === 'function') cargarQRs(true);
});

async function cargarQRs(forceApi = false) {
  const {ip, port} = getIpPort();
  try {
    // 1. Si forceApi, ignora localStorage y usa solo la API
    if (!forceApi) {
      let localData = localStorage.getItem('editor_data_rows');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            qrRawData = parsed.filter(item => (item.id || item.codigo_activo || item.codigo));
            qrItems = qrRawData.map(renderQRCard);
            aplicarGrilla();
            return;
          }
        } catch (e) {}
      }
    }
    // 2. Siempre intentar cargar desde la API
    const response = await fetch(`http://${ip}:${port}/activos/`);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    console.log("Datos recibidos de la API:", data); // DEPURADOR
    qrRawData = data.filter(item => (item.id || item.codigo_activo || item.codigo) && (item.codigo_activo !== 'string' && item.codigo !== 'string'));
    console.log("Datos filtrados:", qrRawData); // DEPURADOR
    qrItems = qrRawData.map(renderQRCard);
    aplicarGrilla();
  } catch (e) {
    console.error("Error al cargar QRs:", e); // DEPURADOR
    // Si la API falla, usar localStorage como último recurso
    var data = localStorage.getItem('qr_print_items');
    if (!data) return;
    const parsed = JSON.parse(data);
    qrRawData = parsed.filter(item => (item.id || item.codigo_activo || item.codigo) && (item.codigo_activo !== 'string' && item.codigo !== 'string'));
    qrItems = qrRawData.map(renderQRCard);
    aplicarGrilla();
  }
}

function aplicarGrilla(filtrado = null) {
  const {ip, port} = getIpPort();
  const previewContainer = document.getElementById('preview-container');
  previewContainer.innerHTML = '';
  const rows = parseInt(document.getElementById('grid-rows').value) || 2;
  const cols = parseInt(document.getElementById('grid-cols').value) || 3;
  const itemsPerPage = rows * cols;
  const items = filtrado || qrRawData;
  const totalItems = items.length;
  const numPages = Math.ceil(totalItems / itemsPerPage);
  let actualPage = 0;
  let idx = 0;
  const plantillaJSON = localStorage.getItem('editor_json_template');
  while (idx < totalItems) {
    const sheet = document.createElement('div');
    sheet.className = 'a4-sheet';
    const grid = document.createElement('div');
    grid.className = 'qr-grid';
    grid.style.height = '100%';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gap = '0';
    sheet.appendChild(grid);
    previewContainer.appendChild(sheet);
    const gridRect = grid.getBoundingClientRect();
    const cellWidth = gridRect.width / cols || 180;
    const cellHeight = gridRect.height / rows || 180;
    let tieneQR = false;
    for (let i = 0; i < itemsPerPage; i++) {
      const div = document.createElement('div');
      div.className = 'qr-item';
      if (idx < totalItems && items[idx] && typeof items[idx] === 'object') {
        if (plantillaJSON && window.fabric) {
          let plantillaObj;
          try {
            plantillaObj = JSON.parse(plantillaJSON);
            if (plantillaObj.objects) {
              plantillaObj.objects.forEach(obj => {
                if (obj.textBaseline && obj.textBaseline === 'alphabetical') {
                  obj.textBaseline = 'alphabetic';
                }
              });
            }
          } catch (e) {
            div.innerHTML = '<span style="color:red">Error en plantilla</span>';
            grid.appendChild(div);
            idx++;
            continue;
          }
          let escalaX = cellWidth / 550;
          let escalaY = cellHeight / 600;
          if (plantillaObj.objects) {
            plantillaObj.objects.forEach(obj => {
              obj.left = (obj.left || 0) * escalaX;
              obj.top = (obj.top || 0) * escalaY;
              obj.width = (obj.width || 0) * escalaX;
              obj.height = (obj.height || 0) * escalaY;
              obj.scaleX = (obj.scaleX || 1) * escalaX;
              obj.scaleY = (obj.scaleY || 1) * escalaY;
            });
          }
          const canvasTmp = document.createElement('canvas');
          canvasTmp.width = cellWidth;
          canvasTmp.height = cellHeight;
          const fabricCanvas = new window.fabric.Canvas(canvasTmp, { width: cellWidth, height: cellHeight });
          const itemActual = items[idx];
          fabricCanvas.loadFromJSON(plantillaObj, function() {
            const objs = fabricCanvas.getObjects();
            let qrPromises = [];
            for (let j = 0; j < objs.length; j++) {
              objs[j].set('visible', true);
              if (objs[j].type === 'textbox') {
                // Si contiene {{url}}, renderiza QR y borra el texto
                if (objs[j].text && objs[j].text.includes('{{url}}')) {
                  qrPromises.push(new Promise(resolve => {
                    let qrValue = '';
                    if (itemActual) {
                      qrValue = itemActual.url;
                    }
                    let qrWidth = Math.max(40, Math.abs((objs[j].width || 100) * (objs[j].scaleX || 1)));
                    let qrHeight = Math.max(40, Math.abs((objs[j].height || 100) * (objs[j].scaleY || 1)));
                    if (qrWidth < 5) qrWidth = cellWidth;
                    if (qrHeight < 5) qrHeight = cellHeight;
                    // Renderiza el QR
                    const qrCanvas = document.createElement('canvas');
                    const qrSize = Math.min(qrWidth, qrHeight);
                    qrCanvas.width = qrSize;
                    qrCanvas.height = qrSize;
                    window.generarQRCanvas(qrCanvas, qrValue, qrSize);
                    const qrImg = new window.fabric.Image(qrCanvas, {
                      left: objs[j].left,
                      top: objs[j].top,
                      width: qrWidth,
                      height: qrHeight,
                      angle: objs[j].angle || 0,
                      scaleX: 1,
                      scaleY: 1
                    });
                    qrImg.height = qrHeight;
                    objs[j].set('text', '');
                    fabricCanvas.add(qrImg);
                    resolve();
                  }));
                }
                // Reemplazo robusto usando itemActual
                const textoOriginal = objs[j].text;
                objs[j].set('text', objs[j].text.replace(/{{\s*(\w+)\s*}}/g, function(match, p1) {
                  const valor = (itemActual && itemActual[p1] !== undefined && itemActual[p1] !== null) ? itemActual[p1] : match;
                  console.log(`Reemplazando ${match} por`, valor, 'en', textoOriginal, 'del item', itemActual); // DEPURADOR
                  return valor;
                }));
              }
            }
            Promise.all(qrPromises).then(() => {
              fabricCanvas.getObjects().forEach(obj => obj.set('visible', true));
              fabricCanvas.renderAll();
              const svg = fabricCanvas.toSVG();
              div.innerHTML = svg;
              const svgEl = div.querySelector('svg');
              if (svgEl) {
                svgEl.style.display = 'block';
                svgEl.style.margin = 'auto';
                svgEl.style.width = '100%';
                svgEl.style.height = '100%';
                svgEl.style.maxWidth = 'none';
                svgEl.style.maxHeight = 'none';
                svgEl.removeAttribute('width');
                svgEl.removeAttribute('height');
              }
            });
          });
        } else {
          const qrDiv = document.createElement('div');
          qrDiv.style.display = 'block';
          qrDiv.style.margin = '0 auto';
          qrDiv.style.width = '120px';
          qrDiv.style.height = '120px';
          div.appendChild(qrDiv);
          let qrValue = '';
          if (items[idx]) {
            qrValue = items[idx].url;
          }
          const c = document.createElement('canvas');
          qrDiv.appendChild(c);
          window.generarQRCanvas(c, qrValue, 120);
        }
        tieneQR = true;
      } else {
        div.innerHTML = '';
      }
      grid.appendChild(div);
      idx++;
    }
    if (!tieneQR) {
      previewContainer.removeChild(sheet);
    }
    actualPage++;
  }
}

async function guardarComoPDF() {
  const btn = document.getElementById('btn-pdf');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Generando...';
  const sheets = Array.from(document.querySelectorAll('.a4-sheet'));
  if (sheets.length === 0) {
    alert("No hay QRs para generar el PDF.");
    btn.disabled = false;
    btn.innerHTML = originalText;
    return;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    await new Promise(res => setTimeout(res, 200));
    const canvas = await html2canvas(sheet, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }
  pdf.save(`codigos-qr (${sheets.length} hojas).pdf`);
  btn.disabled = false;
  btn.innerHTML = originalText;
}

document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('qr-id-input');
  if (input) {
    input.addEventListener('input', function() {
      const val = input.value.trim().toLowerCase();
      const filtrados = qrRawData.filter(item => {
        const codigo = (item.codigo_activo || item.codigo || item.id || '').toLowerCase();
        return codigo.includes(val);
      });
      aplicarGrilla(filtrados);
    });
  }
});

if (!window.QRCode) {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js';
  script.onload = cargarQRs;
  document.head.appendChild(script);
} else {
  window.onload = cargarQRs;
}