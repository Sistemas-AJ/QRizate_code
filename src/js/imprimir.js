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

  // --- AGREGAR SELECTOR DE MODO DE IMPRESIÓN ---
  const printModeGroup = document.getElementById('print-mode-group');
  if (printModeGroup) {
    printModeGroup.innerHTML = `
      <label for="print-mode-select" style="color:#003cb3;font-weight:600;">Modo de impresión/exportación:</label>
      <select id="print-mode-select" style="width:100%;margin-bottom:12px;">
        <option value="por-hoja">Por hoja</option>
        <option value="por-qr">Por QR</option>
        <option value="todos">Todos</option>
      </select>
      <div id="print-mode-controls"></div>
    `;
    const printModeSelect = document.getElementById('print-mode-select');
    const printModeControls = document.getElementById('print-mode-controls');

    function renderPrintModeControls(mode) {
      if (!printModeControls) return;
      if (mode === 'por-hoja') {
        printModeControls.innerHTML = `
          <label for="page-range-input" style="font-weight:500;">Rango de páginas:</label>
          <input type="text" id="page-range-input" placeholder="Ej: 1-3" style="width:100%;margin-bottom:8px;">
        `;
      } else if (mode === 'por-qr') {
        printModeControls.innerHTML = `
          <label for="single-qr-input" style="font-weight:500;">Código QR único:</label>
          <input type="text" id="single-qr-input" placeholder="Ej: QR-123" style="width:100%;margin-bottom:8px;">
        `;
      } else {
        printModeControls.innerHTML = '';
      }
    }

    // Inicializar controles según el valor actual
    renderPrintModeControls(printModeSelect.value);
    printModeSelect.addEventListener('change', function() {
      renderPrintModeControls(this.value);
    });
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
            generarTodosLosQRs();
            aplicarGrilla();
            return;
          }
        } catch (e) {}
      }
    }
    // 2. Siempre intentar cargar desde la API
  const response = await fetch(`http://${ip}:${port}/activos/?skip=0&limit=100000`);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    console.log("Datos recibidos de la API:", data); // DEPURADOR
    qrRawData = data.filter(item => (item.id || item.codigo_activo || item.codigo) && (item.codigo_activo !== 'string' && item.codigo !== 'string'));
    console.log("Datos filtrados:", qrRawData); // DEPURADOR
    qrItems = qrRawData.map(renderQRCard);
    generarTodosLosQRs();
    aplicarGrilla();
  } catch (e) {
    console.error("Error al cargar QRs:", e); // DEPURADOR
    // Si la API falla, usar localStorage como último recurso
    var data = localStorage.getItem('qr_print_items');
    if (!data) return;
    const parsed = JSON.parse(data);
    qrRawData = parsed.filter(item => (item.id || item.codigo_activo || item.codigo) && (item.codigo_activo !== 'string' && item.codigo !== 'string'));
    qrItems = qrRawData.map(renderQRCard);
    generarTodosLosQRs();
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
  // --- PAGINATION STATE ---
  if (typeof window.qrCurrentPage === 'undefined') window.qrCurrentPage = 1;
  let actualPage = window.qrCurrentPage;
  // --- PAGINATION CONTROLS ---
  let pagControls = document.getElementById('qr-pagination-controls');
  if (!pagControls) {
    pagControls = document.createElement('div');
    pagControls.id = 'qr-pagination-controls';
    pagControls.style.textAlign = 'center';
    pagControls.style.margin = '10px 0';
    previewContainer.parentElement.insertBefore(pagControls, previewContainer);
  }
  pagControls.innerHTML = `
    <button id="qr-prev-page">&lt; Anterior</button>
    <span>Página <b id="qr-page-num">${actualPage}</b> de <b id="qr-page-total">${numPages}</b></span>
    <button id="qr-next-page">Siguiente &gt;</button>
    <input id="qr-go-page" type="number" min="1" max="${numPages}" value="${actualPage}" style="width:50px;">
    <button id="qr-go-page-btn">Ir</button>
  `;
  document.getElementById('qr-prev-page').onclick = function() {
    if (window.qrCurrentPage > 1) { window.qrCurrentPage--; aplicarGrilla(filtrado); }
  };
  document.getElementById('qr-next-page').onclick = function() {
    if (window.qrCurrentPage < numPages) { window.qrCurrentPage++; aplicarGrilla(filtrado); }
  };
  document.getElementById('qr-go-page-btn').onclick = function() {
    let val = parseInt(document.getElementById('qr-go-page').value);
    if (val >= 1 && val <= numPages) { window.qrCurrentPage = val; aplicarGrilla(filtrado); }
  };
  // --- RENDER ONLY CURRENT PAGE ---
  let idx = (actualPage - 1) * itemsPerPage;
  const endIdx = Math.min(idx + itemsPerPage, totalItems);
  const plantillaJSON = localStorage.getItem('editor_json_template');
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
  for (let cell = 0; cell < itemsPerPage; cell++) {
    const i = idx + cell;
    const div = document.createElement('div');
    div.className = 'qr-item';
    if (i < totalItems && items[i] && typeof items[i] === 'object') {
        if (plantillaJSON && window.fabric) {
          let plantillaObjOriginal;
          try {
            plantillaObjOriginal = JSON.parse(plantillaJSON);
            if (plantillaObjOriginal.objects) {
              plantillaObjOriginal.objects.forEach(obj => {
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
          // --- CLONAR la plantilla para cada celda ---
          let plantillaObj = JSON.parse(JSON.stringify(plantillaObjOriginal));
          let escalaX = cellWidth / 550;
          let escalaY = cellHeight / 600;
          if (plantillaObj.objects) {
            plantillaObj.objects.forEach(obj => {
              if (obj.type === 'textbox') {
                obj.padding = 0; // Fuerza padding 0 al cargar la plantilla
              }
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
          const itemActual = items[i];
          fabricCanvas.loadFromJSON(plantillaObj, function() {
            const objs = fabricCanvas.getObjects();
            let qrPromises = [];
            let imgPromises = [];
            for (let j = 0; j < objs.length; j++) {
              objs[j].set('visible', true);
              // Si es imagen, forzar recarga si es base64 o ruta relativa
              if (objs[j].type === 'image' && objs[j].src && typeof objs[j].setSrc === 'function') {
                let src = objs[j].src;
                // Si es base64 o ruta relativa, recargar
                if (src.startsWith('data:image') || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                  imgPromises.push(new Promise(resolveImg => {
                    objs[j].setSrc(src, () => {
                      resolveImg();
                    });
                  }));
                }
              }
              if (objs[j].type === 'textbox') {
                // Si contiene {{url}}, renderiza QR y borra el texto
                if (objs[j].text && objs[j].text.includes('{{url}}')) {
                  qrPromises.push(new Promise(resolve => {
                    let qrValue = '';
                    if (itemActual) {
                      qrValue = itemActual.url;
                    }
                    // Usa el ancho y alto del textbox escalado
                    let qrWidth = Math.abs((objs[j].width || 100) * (objs[j].scaleX || 1));
                    let qrHeight = Math.abs((objs[j].height || 100) * (objs[j].scaleY || 1));
                    const qrSize = Math.min(qrWidth, qrHeight); // Mantén el QR cuadrado
                    // Centra el QR en el área del textbox
                    const centerLeft = objs[j].left + ((qrWidth - qrSize) / 2);
                    const centerTop = objs[j].top + ((qrHeight - qrSize) / 2);
                    const qrCanvas = document.createElement('canvas');
                    qrCanvas.width = qrSize;
                    qrCanvas.height = qrSize;
                    window.generarQRCanvas(qrCanvas, qrValue, qrSize);
                    const qrImg = new window.fabric.Image(qrCanvas, {
                      left: centerLeft,
                      top: centerTop,
                      width: qrSize,
                      height: qrSize,
                      angle: objs[j].angle || 0,
                      scaleX: 1,
                      scaleY: 1,
                    });
                    fabricCanvas.remove(objs[j]);
                    fabricCanvas.add(qrImg);
                    resolve();
                  }));
                }
                // Reemplazo robusto usando itemActual
                const textoOriginal = objs[j].text;
                objs[j].set('text', objs[j].text.replace(/{{\s*(\w+)\s*}}/g, function(match, p1) {
                  const valor = (itemActual && itemActual[p1] !== undefined && itemActual[p1] !== null) ? itemActual[p1] : match;
                  return valor;
                }));
                // Solo centrar el textbox que originalmente tenía {{codigo_activo}}
                if (objs[j].type === 'textbox' && textoOriginal.includes('{{codigo_activo}}')) {
                  objs[j].set('textAlign', 'center');
                  if (objs[j].width < 250) {
                    objs[j].set('width', 250);
                  }
                }
              }
            }
            Promise.all([...qrPromises, ...imgPromises]).then(() => {
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
          qrDiv.style.width = cellWidth + 'px';
          qrDiv.style.height = cellHeight + 'px';
          div.appendChild(qrDiv);
          let qrValue = '';
          if (items[i]) {
            qrValue = items[i].url;
          }
          const c = document.createElement('canvas');
          qrDiv.appendChild(c);
          window.generarQRCanvas(c, qrValue, Math.min(cellWidth, cellHeight));
        }
        tieneQR = true;
      } else {
        div.innerHTML = '';
      }
    grid.appendChild(div);
  }
  if (!tieneQR) {
    previewContainer.removeChild(sheet);
  }
}

async function getSheetsForExport() {
  const rows = parseInt(document.getElementById('grid-rows').value) || 7;
  const cols = parseInt(document.getElementById('grid-cols').value) || 5;
  const itemsPerPage = rows * cols;
  const items = qrRawData;
  const totalItems = items.length;
  const numPages = Math.ceil(totalItems / itemsPerPage);

  let sheets = [];
  const plantillaJSON = localStorage.getItem('editor_json_template');

  for (let page = 0; page < numPages; page++) {
    const startIdx = page * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
    const pageItems = items.slice(startIdx, endIdx);

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

    const cellWidth = 180;
    const cellHeight = 180;

    // Esperar el renderizado de cada celda
    let cellPromises = [];
    for (let i = 0; i < itemsPerPage; i++) {
      cellPromises.push(new Promise(async (resolve) => {
        const div = document.createElement('div');
        div.className = 'qr-item';
        if (i < pageItems.length && pageItems[i] && typeof pageItems[i] === 'object') {
          if (plantillaJSON && window.fabric) {
            let plantillaObjOriginal;
            try {
              plantillaObjOriginal = JSON.parse(plantillaJSON);
              if (plantillaObjOriginal.objects) {
                plantillaObjOriginal.objects.forEach(obj => {
                  if (obj.textBaseline && obj.textBaseline === 'alphabetical') {
                    obj.textBaseline = 'alphabetic';
                  }
                });
              }
            } catch (e) {
              div.innerHTML = '<span style="color:red">Error en plantilla</span>';
              grid.appendChild(div);
              resolve();
              return;
            }
            let plantillaObj = JSON.parse(JSON.stringify(plantillaObjOriginal));
            let escalaX = cellWidth / 550;
            let escalaY = cellHeight / 600;
            if (plantillaObj.objects) {
              plantillaObj.objects.forEach(obj => {
                if (obj.type === 'textbox') obj.padding = 0;
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
            const itemActual = pageItems[i];
            fabricCanvas.loadFromJSON(plantillaObj, async function() {
              const objs = fabricCanvas.getObjects();
              let qrPromises = [];
              let imgPromises = [];
              for (let j = 0; j < objs.length; j++) {
                objs[j].set('visible', true);
                if (objs[j].type === 'image' && objs[j].src && typeof objs[j].setSrc === 'function') {
                  let src = objs[j].src;
                  if (src.startsWith('data:image') || src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                    imgPromises.push(new Promise(resolveImg => {
                      objs[j].setSrc(src, () => resolveImg());
                    }));
                  }
                }
                if (objs[j].type === 'textbox') {
                  if (objs[j].text && objs[j].text.includes('{{url}}')) {
                    qrPromises.push(new Promise(resolveQR => {
                      let qrValue = itemActual ? itemActual.url : '';
                      let qrWidth = Math.abs((objs[j].width || 100) * (objs[j].scaleX || 1));
                      let qrHeight = Math.abs((objs[j].height || 100) * (objs[j].scaleY || 1));
                      const qrSize = Math.min(qrWidth, qrHeight);
                      const centerLeft = objs[j].left + ((qrWidth - qrSize) / 2);
                      const centerTop = objs[j].top + ((qrHeight - qrSize) / 2);
                      const qrCanvas = document.createElement('canvas');
                      qrCanvas.width = qrSize;
                      qrCanvas.height = qrSize;
                      window.generarQRCanvas(qrCanvas, qrValue, qrSize);
                      const qrImg = new window.fabric.Image(qrCanvas, {
                        left: centerLeft,
                        top: centerTop,
                        width: qrSize,
                        height: qrSize,
                        angle: objs[j].angle || 0,
                        scaleX: 1,
                        scaleY: 1,
                      });
                      fabricCanvas.remove(objs[j]);
                      fabricCanvas.add(qrImg);
                      resolveQR();
                    }));
                  }
                  const textoOriginal = objs[j].text;
                  objs[j].set('text', objs[j].text.replace(/{{\s*(\w+)\s*}}/g, function(match, p1) {
                    const valor = (itemActual && itemActual[p1] !== undefined && itemActual[p1] !== null) ? itemActual[p1] : match;
                    return valor;
                  }));
                  if (objs[j].type === 'textbox' && textoOriginal.includes('{{codigo_activo}}')) {
                    objs[j].set('textAlign', 'center');
                    if (objs[j].width < 250) objs[j].set('width', 250);
                  }
                }
              }
              await Promise.all([...qrPromises, ...imgPromises]);
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
              resolve();
            });
          } else {
            // Si no hay plantilla, solo QR básico
            const qrDiv = document.createElement('div');
            qrDiv.style.display = 'block';
            qrDiv.style.margin = '0 auto';
            qrDiv.style.width = cellWidth + 'px';
            qrDiv.style.height = cellHeight + 'px';
            div.appendChild(qrDiv);
            let qrValue = pageItems[i].url || '';
            const c = document.createElement('canvas');
            qrDiv.appendChild(c);
            window.generarQRCanvas(c, qrValue, Math.min(cellWidth, cellHeight));
            resolve();
          }
        } else {
          resolve();
        }
        grid.appendChild(div);
      }));
    }
    await Promise.all(cellPromises);
    sheets.push(sheet);
    // Pausa entre hojas para evitar lag
    await new Promise(res => setTimeout(res, 50));
  }
  return sheets;
}

async function guardarComoPDF() {
  const btn = document.getElementById('btn-pdf');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Generando...';
  showLoader(true);

  const sheets = await getSheetsForExport();
  if (!Array.isArray(sheets) || sheets.length === 0) {
    showNotification("No hay QRs para generar el PDF.", 'error');
    btn.disabled = false;
    btn.innerHTML = originalText;
    showLoader(false);
    return;
  }

  // --- Selección de hojas según modo ---
  const printModeSelect = document.getElementById('print-mode-select');
  let sheetsToExport = [];
  let filename = 'codigos-qr.pdf';

  if (printModeSelect) {
    if (printModeSelect.value === 'por-hoja') {
      const rangeInput = document.getElementById('page-range-input');
      let start = 1, end = sheets.length;
      if (rangeInput && rangeInput.value) {
        const match = rangeInput.value.match(/^(\d+)\s*-\s*(\d+)$/);
        if (match) {
          start = Math.max(1, parseInt(match[1]));
          end = Math.min(sheets.length, parseInt(match[2]));
        }
      }
      if (start > end || start < 1 || end > sheets.length) {
        showNotification('El rango de hojas es inválido.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
        showLoader(false);
        return;
      }
      sheetsToExport = sheets.slice(start - 1, end);
      filename = `qr-hojas-${start}-a-${end}.pdf`;
    } else if (printModeSelect.value === 'por-qr') {
      const qrInput = document.getElementById('single-qr-input');
      let idx = -1;
      if (qrInput && qrInput.value) {
        idx = parseInt(qrInput.value) - 1;
      }
      if (isNaN(idx) || idx < 0 || idx >= sheets.length) {
        showNotification('Número de QR inválido.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
        showLoader(false);
        return;
      }
      sheetsToExport = [sheets[idx]];
      filename = `qr-hoja-${idx+1}.pdf`;
    } else {
      sheetsToExport = sheets;
      filename = 'codigos-qr-todos.pdf';
    }
  } else {
    sheetsToExport = sheets;
  }

  if (sheetsToExport.length === 0) {
    showNotification("No hay hojas para exportar en ese rango.", 'error');
    btn.disabled = false;
    btn.innerHTML = originalText;
    showLoader(false);
    return;
  }

  // --- BLOQUE PRINCIPAL: Exportar en bloques y unir PDFs ---
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '0';
  tempDiv.style.width = '210mm';
  tempDiv.style.height = '297mm';
  tempDiv.style.zIndex = '-1';
  document.body.appendChild(tempDiv);

  const blockSize = 40; // Puedes ajustar este valor según tu PC
  const totalBlocks = Math.ceil(sheetsToExport.length / blockSize);
  let pdfBlobs = [];

  for (let block = 0; block < totalBlocks; block++) {
    const start = block * blockSize;
    const end = Math.min(start + blockSize, sheetsToExport.length);
    const sheetsBlock = sheetsToExport.slice(start, end);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < sheetsBlock.length; i++) {
      updatePdfProgress(block, totalBlocks, i, sheetsBlock.length); // Actualiza barra por hoja
      pdf.addPage();
      const sheet = sheetsBlock[i];
      tempDiv.appendChild(sheet);
      await new Promise(res => setTimeout(res, 80));
      const canvas = await html2canvas(sheet, { scale: 1 }); // Usa scale 1 para menos peso
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      tempDiv.removeChild(sheet);
    }
    const blob = pdf.output('blob');
    pdfBlobs.push(blob);
  }
  document.body.removeChild(tempDiv);
  updatePdfProgress(totalBlocks, totalBlocks);

  // --- Unir los PDFs usando PDF-lib ---
  const { PDFDocument } = window['PDFLib'];
  const mergedPdf = await PDFDocument.create();
  for (const blob of pdfBlobs) {
    const pdfBytes = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  const mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(mergedBlob);

  // Descargar el PDF final
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);

  btn.disabled = false;
  btn.innerHTML = originalText;
  showLoader(false);
}

async function imprimirSegunModo() {
  const btn = document.getElementById('btn-print');
  btn.disabled = true;
  showPrintLoader(true); // Mostrar loader

  const sheets = await getSheetsForExport();
  const printMode = document.getElementById('print-mode');
  let sheetsToPrint = [];

  if (printMode) {
    if (printMode.value === 'single') {
      const idx = parseInt(document.getElementById('single-qr-index').value) - 1;
      if (isNaN(idx) || idx < 0 || idx >= sheets.length) {
        showNotification('Número de QR inválido.', 'error');
        btn.disabled = false;
        showPrintLoader(false);
        return;
      }
      sheetsToPrint = [sheets[idx]];
    } else if (printMode.value === 'range') {
      let start = parseInt(document.getElementById('pdf-page-start').value);
      let end = parseInt(document.getElementById('pdf-page-end').value);
      start = Math.max(1, start);
      end = Math.min(sheets.length, end);
      if (start > end || start < 1 || end > sheets.length) {
        showNotification('El rango de hojas es inválido.', 'error');
        btn.disabled = false;
        showPrintLoader(false);
        return;
      }
      sheetsToPrint = sheets.slice(start - 1, end);
    } else if (printMode.value === 'all') {
      sheetsToPrint = sheets;
    }
  } else {
    sheetsToPrint = sheets;
  }

  if (sheetsToPrint.length === 0) {
    showNotification("No hay hojas para imprimir en ese rango.", 'error');
    btn.disabled = false;
    showPrintLoader(false);
    return;
  }

  // Crear un contenedor temporal para imprimir solo los seleccionados
  const printContainer = document.createElement('div');
  printContainer.style.display = 'none';

  for (let i = 0; i < sheetsToPrint.length; i++) {
    updatePrintProgress(i, sheetsToPrint.length); // Actualiza barra
    printContainer.appendChild(sheetsToPrint[i].cloneNode(true));
    await new Promise(res => setTimeout(res, 50)); // Pequeña pausa por hoja
  }
  updatePrintProgress(sheetsToPrint.length, sheetsToPrint.length); // 100%

  document.body.appendChild(printContainer);
  const originalBody = document.body.innerHTML;
  document.body.innerHTML = printContainer.innerHTML;
  showPrintLoader(false); // Ocultar loader antes de imprimir
  window.print();
  setTimeout(() => {
    showPrintLoader(false); // Oculta el loader después de imprimir
    document.body.innerHTML = originalBody;
    printContainer.remove();
    btn.disabled = false;
  }, 1000); // 1 segundo, ajusta si lo necesitas
}

document.addEventListener('DOMContentLoaded', function() {
  // Asignar evento al botón de imprimir
  const btnPrint = document.getElementById('btn-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', imprimirSegunModo);
  }
  // Mostrar/ocultar controles según el modo seleccionado
  const printMode = document.getElementById('print-mode');
  const singleQrControls = document.getElementById('single-qr-controls');
  const rangeQrControls = document.getElementById('range-qr-controls');
  if (printMode && singleQrControls && rangeQrControls) {
    printMode.addEventListener('change', function() {
      if (printMode.value === 'single') {
        singleQrControls.style.display = '';
        rangeQrControls.style.display = 'none';
      } else if (printMode.value === 'range') {
        singleQrControls.style.display = 'none';
        rangeQrControls.style.display = '';
      } else {
        singleQrControls.style.display = 'none';
        rangeQrControls.style.display = 'none';
      }
    });
    printMode.dispatchEvent(new Event('change'));
  }
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

function showLoader(show) {
  const loader = document.getElementById('pdf-loader');
  if (loader) loader.style.display = show ? 'flex' : 'none';
  if (show) updatePdfProgress(0, 1);
}

function updatePdfProgress(current, total) {
  const bar = document.getElementById('pdf-progress-inner');
  const text = document.getElementById('pdf-progress-text');
  if (bar && text) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    bar.style.width = percent + '%';
    text.textContent = percent + '%';
  }
}

function showPrintLoader(show) {
  const loader = document.getElementById('print-loader');
  if (loader) loader.style.display = show ? 'flex' : 'none';
  if (show) updatePrintProgress(0, 1);
}

function updatePrintProgress(current, total) {
  const bar = document.getElementById('print-progress-inner');
  const text = document.getElementById('print-progress-text');
  if (bar && text) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    bar.style.width = percent + '%';
    text.textContent = percent + '%';
  }
}

function updatePdfProgress(block, totalBlocks, hoja, hojasEnBloque) {
  const bar = document.getElementById('pdf-progress-inner');
  const text = document.getElementById('pdf-progress-text');
  let percent = 0;
  if (totalBlocks > 0 && hojasEnBloque > 0) {
    percent = Math.round(((block + hoja / hojasEnBloque) / totalBlocks) * 100);
  } else if (totalBlocks > 0) {
    percent = Math.round((block / totalBlocks) * 100);
  }
  if (bar && text) {
    bar.style.width = percent + '%';
    text.textContent = percent + '%';
  }
}

if (!window.QRCode) {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js';
  script.onload = cargarQRs;
  document.head.appendChild(script);
} else {
  window.onload = cargarQRs;
}