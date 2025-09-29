// =======================================================================
// qr.js - VERSIÓN FINAL CORREGIDA
// =======================================================================

// --- 1. INICIALIZACIÓN DE VARIABLES GLOBALES ---

// CAMBIO: La función checkForAutoSave está completamente corregida para manejar el foco.
function showModal(message, buttons) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    const messageEl = document.getElementById('modal-message');
    const buttonsEl = document.getElementById('modal-buttons');

    messageEl.textContent = message;
    buttonsEl.innerHTML = ''; // Limpiar botones anteriores

    buttons.forEach(btnInfo => {
      const button = document.createElement('button');
      button.textContent = btnInfo.text;
      button.className = btnInfo.class;
      button.onclick = () => {
        overlay.style.display = 'none';
        resolve(btnInfo.value);
      };
      buttonsEl.appendChild(button);
    });

    overlay.style.display = 'flex';
  });
}

// --- Versión MODIFICADA de checkForAutoSave ---
async function checkForAutoSave() {
  const autoSave = localStorage.getItem('editor_autosave');
  console.log('[AutoSave] checkForAutoSave called.');
  if (!autoSave) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(autoSave);
  } catch (e) {
    localStorage.removeItem('editor_autosave');
    return;
  }

  if (canvas && canvas.getObjects().length === 0) {
    if (window.sessionRestored) return;
    window.sessionRestored = false;

    // 1. Reemplazamos confirm() con nuestro modal
    const userConfirmed = await showModal('¿Deseas restaurar tu sesión anterior?', [
      { text: 'Restaurar', value: true, class: 'primary' },
      { text: 'No, gracias', value: false, class: 'secondary' }
    ]);

    // YA NO NECESITAMOS window.focus() aquí

    if (userConfirmed) {
      try {
        if (parsed.dataRows) window.dataRows = parsed.dataRows;
        if (typeof populateColumnSelectors === 'function') populateColumnSelectors();
        if (parsed.qrColumn) {
          const qrColSelect = document.getElementById('qr-column-select');
          if (qrColSelect) qrColSelect.value = parsed.qrColumn;
        }
        if (parsed.filenameColumn) {
          const filenameColSelect = document.getElementById('filename-column-select');
          if (filenameColSelect) filenameColSelect.value = parsed.filenameColumn;
        }

        setTimeout(async () => { // Hacemos el callback async
          if (parsed.canvas) {
            canvas.loadFromJSON(parsed.canvas, async () => {
              canvas.renderAll();
              history = [JSON.stringify(canvas.toJSON())];
              historyIndex = 0;
              savedHistoryIndex = 0;
              if (typeof generatePreview === 'function') generatePreview();
              window.sessionRestored = true;

              // 2. Reemplazamos alert() con nuestro modal
              await showModal('¡Sesión restaurada!', [{ text: 'Aceptar', value: 'ok', class: 'primary' }]);
              // YA NO NECESITAMOS window.focus() aquí tampoco
              localStorage.removeItem('editor_autosave');
            });
          }
        }, 200);
      } catch (e) {
        console.error('[AutoSave] Error al restaurar sesión:', e);
      }
    } else {
      localStorage.removeItem('editor_autosave');
    }
  }
}

const canvas = new fabric.Canvas('canvas', {
  hoverCursor: 'pointer',
  selection: true,
  selectionBorderColor: '#007bff',
  selectionLineWidth: 2
});
window.canvas = canvas;
fabric.Object.prototype.padding = 0;
fabric.Textbox.prototype.padding = 0;
fabric.Object.prototype.cornerSize = 14;
fabric.Object.prototype.hoverCursor = 'pointer';
let dataRows = [];
window.dataRows = dataRows;

// --- GUARDADO AUTOMÁTICO EN LOCALSTORAGE ---
function saveDataRowsToLocalStorage() {
  try {
    localStorage.setItem('editor_data_rows', JSON.stringify(window.dataRows));
  } catch (e) {
    console.error('[Editor] Error guardando dataRows en localStorage:', e);
  }
}

function loadDataRowsFromLocalStorage() {
  try {
    const stored = localStorage.getItem('editor_data_rows');
    if (stored) {
      window.dataRows = JSON.parse(stored);
      dataRows = window.dataRows;
    }
  } catch (e) {
    console.error('[Editor] Error cargando dataRows de localStorage:', e);
  }
}

let zip = new JSZip();
let fileNameCounts = {};
let history = [];
let historyIndex = -1;
let savedHistoryIndex = -1;
let historyLock = false;

function addText() {
  const text = new fabric.Textbox('Ingrese texto...', {
    left: 100, top: 100, fontSize: 20, fill: '#000000',
    textAlign: 'left', fontFamily: 'Arial', width: 300
  });
  canvas.add(text);
}

function addQrPlaceholder() {
  // Agrega un textbox dinámico igual que el menú de campos dinámicos
  const qrPlaceholder = new fabric.Textbox('{{url}}', {
    left: 150,
    top: 150,
    fontSize: 30,
    fill: '#007bff',
    fontFamily: 'Courier New',
    width: 200,
    textAlign: 'center',
    fontWeight: 'bold',
    editable: true,
    lockScalingFlip: true, // Permite escalar libremente pero no voltear
    lockUniScaling: false, // Permite escalar en X/Y de forma independiente
    minWidth: 40,
    minHeight: 40,
    padding: 0
  });
  qrPlaceholder.setControlsVisibility({
    mt: true, mb: true, ml: true, mr: true, // Permite escalar en todos los lados
    bl: true, br: true, tl: true, tr: true, // Permite escalar en las esquinas
    mtr: true // Permite rotar
  });
  canvas.add(qrPlaceholder);
  canvas.setActiveObject(qrPlaceholder);
  canvas.requestRenderAll();
}

function triggerImageUpload() {
  document.getElementById('input-image').click();
  // El listener para el input-image ya está en el DOMContentLoaded, pero aseguramos que siempre convierta a base64
  document.getElementById('input-image').onchange = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Insertar imagen como base64 en el canvas
      fabric.Image.fromURL(e.target.result, (img) => {
        img.set({ left: 100, top: 100, scaleX: 0.5, scaleY: 0.5 });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
        debouncedGeneratePreview();
      });
    };
    reader.readAsDataURL(file);
  };
}

function loadTemplateFromData(jsonData) {
  canvas.loadFromJSON(jsonData, function () {
    canvas.renderAll();
    history = [];
    historyIndex = -1;
    saveState();
    savedHistoryIndex = historyIndex;
  });
}

function loadTemplate(event) {
  if (!checkForUnsavedChanges()) {
    event.target.value = '';
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => loadTemplateFromData(e.target.result);
  reader.readAsText(file);
}

function saveTemplate() {
  const json = JSON.stringify(canvas.toJSON());
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla.json";
  a.click();
  URL.revokeObjectURL(url);
  // Guardar JSON y SVG en localStorage para impresión
  try {
    localStorage.setItem('editor_json_template', json);
    const svgString = canvas.toSVG();
    localStorage.setItem('editor_svg_template', svgString);
    console.log('[Editor] Plantilla JSON y SVG guardados en localStorage');
  } catch (e) {
    console.error('[Editor] Error al guardar plantilla en localStorage:', e);
  }
  savedHistoryIndex = historyIndex;
}

// --- 3. FUNCIONES DE MANEJO DE DATOS (EXCEL) ---

function loadExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = e.target.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // ===== CAMBIO: USA LA VARIABLE GLOBAL =====
    // Generar QR SVG y guardarlo en la variable QR de cada registro
    const rows = XLSX.utils.sheet_to_json(sheet);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Generar QR SVG desde la columna 'url' (no se guarda en la base de datos)
      const url = row.url || '';
      if (window.QRCode && url) {
        const tempDiv = document.createElement('div');
        new window.QRCode(tempDiv, {
          text: url,
          width: 180,
          height: 180,
          correctLevel: window.QRCode.CorrectLevel.M,
          render: 'svg'
        });
        const svgEl = tempDiv.querySelector('svg');
        row.QR = svgEl ? svgEl.outerHTML : '';
      } else {
        row.QR = '';
      }
    }
    window.dataRows = rows;
    saveDataRowsToLocalStorage();
    alert('Datos de Excel cargados.');
    populateColumnSelectors();
    document.getElementById('columns-menu').disabled = false;
    // Al cargar desde Excel, también refrescamos la vista previa
    generatePreview(); 
  };
  reader.readAsBinaryString(file);
}

async function loadDataFromAPI() {
  const apiUrl = 'http://localhost:8000/activos/';
  showModal('Cargando datos desde la API...', []);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Error en la red: ${response.status} - ${response.statusText}`);
    }
    const apiData = await response.json();
    console.log("Datos recibidos de la API:", apiData);
    if (Array.isArray(apiData) && apiData.length > 0) {
      window.dataRows = apiData;
      saveDataRowsToLocalStorage();
      populateColumnSelectors();
      document.getElementById('columns-menu').disabled = false;
      // ===============================================================
      // ===== LÍNEA CLAVE AÑADIDA: Forzamos el refresco del preview =====
      console.log('Datos cargados, forzando actualización de la Vista Previa...');
      generatePreview();
      // ===============================================================
      showModal('¡Datos cargados correctamente desde la API!', [
        { text: 'Aceptar', value: 'ok', class: 'primary' }
      ]);
    } else {
      throw new Error("La API no devolvió datos válidos o la lista está vacía.");
    }
  } catch (error) {
    console.error('Falló la carga de datos desde la API:', error);
    showModal(`Error al cargar los datos: ${error.message}`, [
      { text: 'Cerrar', value: 'ok', class: 'secondary' }
    ]);
  }
}


function populateColumnSelectors() {
  // Solo poblar el menú de campos dinámicos (columns-menu) si existe y hay datos
  // Solo poblar el menú de campos dinámicos (columns-menu) si existe y hay datos
  const columnsMenu = document.getElementById('columns-menu');
  if (!columnsMenu) return;
  // Limpiar todas las opciones
  columnsMenu.innerHTML = '';
  // Agregar opción placeholder
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '(seleccionar)';
  columnsMenu.appendChild(placeholder);
  if (!window.dataRows || !window.dataRows.length) return;
  const cols = Object.keys(window.dataRows[0]);
  cols.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = col;
    columnsMenu.appendChild(opt);
  });
}

// --- 4. FUNCIONES DE HISTORIAL Y SEGURIDAD ---

function saveState() {
  if (historyLock) return;
  history = history.slice(0, historyIndex + 1);
  history.push(JSON.stringify(canvas.toJSON()));
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex > 0) {
    historyLock = true;
    historyIndex--;
    canvas.loadFromJSON(history[historyIndex], () => {
      canvas.renderAll();
      historyLock = false;
    });
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyLock = true;
    historyIndex++;
    canvas.loadFromJSON(history[historyIndex], () => {
      canvas.renderAll();
      historyLock = false;
    });
  }
}

function deleteSelected() {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length) {
    activeObjects.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject().renderAll();
  }
}

function checkForUnsavedChanges() {
  if (historyIndex !== savedHistoryIndex) {
    return confirm("Advertencia: Tienes cambios sin guardar que se perderán. ¿Deseas continuar?");
  }
  return true;
}

// --- 5. FUNCIONES DE GENERACIÓN Y EXPORTACIÓN ---

function showProgress(phase, total) {
  const container = document.getElementById("progress-container");
  if (!container) {
    console.error("¡ERROR! No se encuentra el elemento #progress-container en el HTML.");
    return;
  }
  
  container.style.display = "block";
  const label = document.getElementById("progress-label");

  if (phase === "qr") {
    label.innerText = "Fase 1 de 2: Preparando lienzos y QR...";
  } else if (phase === "pdf") {
    label.innerText = "Fase 2 de 2: Creando archivos PDF...";
  }
  updateProgress(0, total);
}

function updateProgress(current, total) {
  const percent = total > 0 ? Math.floor((current / total) * 100) : 0;
  document.getElementById("progress-bar").value = percent;
  document.getElementById("progress-percent").innerText = `${percent}%`;
}

function hideProgress() {
  document.getElementById("progress-container").style.display = "none";
}

async function generateCertificates() {
  if (dataRows.length === 0) {
    showNotification('No hay datos disponibles para generar certificados.', 'error');
    return;
  }
  zip = new JSZip();
  fileNameCounts = {};
  const total = dataRows.length;
  const qrColumn = document.getElementById('qr-column-select').value;
  const filenameColumn = document.getElementById('filename-column-select').value;

  showProgress("qr", total);

  setTimeout(async () => {
    const canvasProcessingPromises = dataRows.map((row, index) => {
      return new Promise(resolveCanvas => {
        const clonedCanvas = new fabric.Canvas(null, { width: canvas.width, height: canvas.height });
        clonedCanvas.loadFromJSON(canvas.toJSON(), () => {
          const qrPromise = processQrForCanvas(clonedCanvas, row, qrColumn);
          clonedCanvas.getObjects().forEach(obj => {
            if ((obj.type === 'textbox' || obj.type === 'i-text') && !obj.text.includes('{{url}}')) {
              replaceTextWithStyles(obj, row);
            }
          });
          qrPromise.then(() => {
            updateProgress(index + 1, total);
            resolveCanvas({ canvas: clonedCanvas, row: row });
          });
        });
      });
    });

    const processedCertificates = await Promise.all(canvasProcessingPromises);

    showProgress("pdf", total);

    const pdfCreationPromises = processedCertificates.map((cert, index) => {
      return new Promise(resolvePdf => {
        const uniqueFileName = generateUniqueFileName(cert.row, index, filenameColumn);
        exportToPDF(cert.canvas, uniqueFileName, () => {
          updateProgress(index + 1, total);
          resolvePdf();
        });
      });
    });

    await Promise.all(pdfCreationPromises);

    hideProgress();
    downloadAll();
    showNotification("¡Certificados generados y listos para descargar!", 'success');

  }, 50);
}

function processQrForCanvas(canvasInstance, rowData, qrColumn) {
  return new Promise(resolve => {
    const qrPlaceholder = canvasInstance.getObjects().find(o => o.text && o.text.includes('{{url}}'));
    if (!qrPlaceholder) return resolve();

    let qrData = qrColumn ? rowData[qrColumn] : (rowData['url'] || rowData['URL'] || rowData['Url']);
    if (qrData) {
      // Usar generarQRCanvas para tamaño cuadrado máximo del objeto
      const qrCanvas = document.createElement('canvas');
      const qrSize = Math.min(
        Math.abs((qrPlaceholder.width || 100) * (qrPlaceholder.scaleX || 1)),
        Math.abs((qrPlaceholder.height || 100) * (qrPlaceholder.scaleY || 1))
      );
      qrCanvas.width = qrSize;
      qrCanvas.height = qrSize;
      window.generarQRCanvas(qrCanvas, qrData, qrSize);
      const qrImg = new window.fabric.Image(qrCanvas, {
        left: qrPlaceholder.left,
        top: qrPlaceholder.top,
        width: qrPlaceholder.width,
        height: qrPlaceholder.height,
        angle: qrPlaceholder.angle || 0,
        scaleX: 1,
        scaleY: 1
      });
      canvasInstance.remove(qrPlaceholder);
      canvasInstance.add(qrImg);
      resolve();
          // ...existing code para clonar el canvas y renderizar la vista previa...
          // Suponiendo que el canvas de preview tiene id 'preview-canvas'
          // y que el valor de la URL a codificar está en una variable rowData.url o similar
    } else {
      canvasInstance.remove(qrPlaceholder);
      resolve();
    }
  });
}

function generateUniqueFileName(row, index, selectedColumn) {
  let name = '';
  if (selectedColumn && row[selectedColumn] && String(row[selectedColumn]).trim() !== '') {
    name = String(row[selectedColumn]);
  } else if (row['nombre'] || row['nombres'] || row['NOMBRE'] || row['NOMBRES']) {
    name = row['nombre'] || row['nombres'] || row['NOMBRE'] || row['NOMBRES'];
  }
  if (!name.toString().trim()) {
    name = `certificado_${index + 1}`;
  }
  const baseName = String(name).replace(/\s+/g, '_');
  if (!fileNameCounts[baseName]) {
    fileNameCounts[baseName] = 1;
    return baseName;
  } else {
    fileNameCounts[baseName]++;
    return `${baseName}(${fileNameCounts[baseName] - 1})`;
  }
}

function exportToPDF(canvasInstance, fileName, callback) {
  try {
    const svgString = canvasInstance.toSVG();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = svgDoc.documentElement;
    const pdf = new window.jspdf.jsPDF({ 
        orientation: 'landscape', 
        unit: 'px', 
        format: [canvasInstance.width, canvasInstance.height] 
    });
    pdf.svg(svgElement).then(() => {
      zip.file(`${fileName}.pdf`, pdf.output('blob'));
      callback(true);
    });
  } catch (error) {
    console.error("Error al exportar a PDF:", error);
    callback(false);
  }
}

function exportSinglePDF() {
  try {
    const svgString = canvas.toSVG();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = svgDoc.documentElement;

    const pdf = new window.jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });

    pdf.svg(svgElement).then(() => {
      pdf.save('Certificado_Unico.pdf');
    }).catch((error) => {
      console.error("Error al renderizar el SVG en el PDF:", error);
      showNotification("Hubo un error al generar el PDF. Revisa la consola para más detalles.", 'error');
    });
  } catch (error) {
    console.error("Error general al exportar PDF único:", error);
    showNotification("Hubo un error al generar el PDF. Revisa la consola para más detalles.", 'error');
  }
}

function downloadAll() {
  if (Object.keys(zip.files).length === 0) {
    showNotification("No hay certificados generados para descargar. Usa 'Generar Certificados' primero.", 'error');
    return;
  }
  zip.generateAsync({ type: 'blob' }).then(function (content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "certificados.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// --- 6. FUNCIONES DE UI Y LÓGICA DE LA BARRA DE HERRAMIENTAS ---

function generatePreview() {
  if (window.previewFabricCanvas) {
    window.previewFabricCanvas.dispose();
  }
  const previewCanvas = new fabric.Canvas('preview-canvas');
  window.previewFabricCanvas = previewCanvas;

  previewCanvas.loadFromJSON(canvas.toJSON(), () => {
    let qrRendered = false;
    if (window.dataRows && window.dataRows.length > 0) {
      const row = window.dataRows[0];
      const qrColumn = 'url'; // Siempre usar la columna 'url' para el QR
      // Si existe el select, forzar su valor a 'url' para la UI
      const qrColSelect = document.getElementById('qr-column-select');
      if (qrColSelect) qrColSelect.value = 'url';

      previewCanvas.getObjects().forEach(obj => {
        // Si el texto contiene el placeholder {{url}}, genera el QR
        if (
          (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') &&
          obj.text.includes(`{{url}}`)
        ) {
          let qrData = row[qrColumn];
          if (qrData) {
            const qrCanvas = document.createElement('canvas');
            // Usar el tamaño real de la caja en el editor
            const qrWidth = Math.abs((obj.width || 100) * (obj.scaleX || 1));
            const qrHeight = Math.abs((obj.height || 100) * (obj.scaleY || 1));
            qrCanvas.width = qrWidth;
            qrCanvas.height = qrHeight;
            window.generarQRCanvas(qrCanvas, qrData, { width: qrWidth, height: qrHeight });
            const qrImg = new window.fabric.Image(qrCanvas, {
              left: obj.left,
              top: obj.top,
              width: qrWidth,
              height: qrHeight,
              angle: obj.angle || 0,
              scaleX: 1,
              scaleY: 1
            });
            previewCanvas.remove(obj);
            previewCanvas.add(qrImg);
            qrRendered = true;
          } else {
            previewCanvas.remove(obj);
          }
        } else if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
          replaceTextWithStyles(obj, row);
        }
      });
    }
    // Solo mostrar el QR si existe un objeto con {{url}} y hay datos con url
    // Si no, no mostrar ningún QR extra
    previewCanvas.renderAll();
  });
}

const debouncedGeneratePreview = debounce(generatePreview, 300);

function updateFloatingToolbar() {
  const activeObject = canvas.getActiveObject();
  const toolbar = document.getElementById("floating-toolbar");
  const textControls = document.getElementById("text-controls");

  if (!activeObject) {
    toolbar.style.display = "none";
    return;
  }
  toolbar.style.display = "block";

  const isText = ['textbox', 'i-text', 'text'].includes(activeObject.type);
  textControls.style.display = isText ? "block" : "none";

  if (isText) {
    document.getElementById("text-align").value = activeObject.textAlign || "left";
    document.getElementById("text-color").value = activeObject.fill || "#000000";
    document.getElementById("font-family").value = activeObject.fontFamily || "Arial";
    document.getElementById("font-size").value = activeObject.fontSize || 30;
    document.getElementById("text-bold").checked = activeObject.fontWeight === 'bold';
    document.getElementById("text-italic").checked = activeObject.fontStyle === 'italic';
  }
}

document.getElementById("text-align").addEventListener("change", function () {
  const activeObject = canvas.getActiveObject();
  if (activeObject && ['textbox', 'i-text', 'text'].includes(activeObject.type)) {
    // Forzar un ancho mínimo para que la alineación se note
    if (activeObject.width < 250) {
      activeObject.set("width", 250);
    }
    activeObject.set("textAlign", this.value);
    canvas.renderAll();
  }
});

function changeCase(targetCase) {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || !['textbox', 'i-text', 'text'].includes(activeObject.type)) return;

    if (activeObject.isEditing && activeObject.selectionStart !== activeObject.selectionEnd) {
        const start = activeObject.selectionStart;
        const end = activeObject.selectionEnd;
        const selectedText = activeObject.getSelectedText();
  const newSelectedText = (targetCase === 'upper') ? selectedText.toUpperCase() : selectedText.toLowerCase();
        
        const originalText = activeObject.text;
        const newFullText = originalText.slice(0, start) + newSelectedText + originalText.slice(end);
        activeObject.set('text', newFullText);

        activeObject.selectionStart = start;
        activeObject.selectionEnd = end;
    } else {
        const newText = (targetCase === 'upper') ? activeObject.text.toUpperCase() : activeObject.text.toLowerCase();
        activeObject.set('text', newText);
    }
    canvas.renderAll();
}

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const header = document.getElementById(elmnt.id + "-header") || elmnt;
  
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    const target = e.target;
    if (['SELECT', 'INPUT', 'BUTTON', 'OPTION', 'LABEL', 'I'].includes(target.tagName)) {
        return;
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function replaceTextWithStyles(obj, rowData) {
  let text = obj.text;
  if (!text) return;
  const placeholders = text.match(/\{\{.*?\}\}/g);
  if (placeholders) {
    placeholders.forEach(placeholder => {
      const key = placeholder.replace(/[{}]/g, '');
      if (rowData.hasOwnProperty(key)) {
        const replacement = rowData[key] || '';
        
        // --- Añade este log para ver la magia en acción ---
        console.log(`Reemplazando '${placeholder}' con el valor: '${replacement}'`);
        
        text = text.split(placeholder).join(replacement);
      } else {
        // --- Y este para ver si no encuentra una clave ---
        console.warn(`El placeholder '${placeholder}' no corresponde a ninguna clave en los datos.`);
      }
    });
  }
  obj.set('text', text);
}

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- 7. INICIALIZACIÓN Y LISTENERS DE EVENTOS ---

document.addEventListener('DOMContentLoaded', async () => {
  await checkForAutoSave();
  // No cargar datos automáticamente desde la API al abrir el editor
  // Solo restaurar si el usuario lo decide, sin alertas ni notificaciones extra
  loadDataRowsFromLocalStorage();
  inicializarAtajos(canvas, { undo, redo, deleteSelected, saveTemplate, saveState, debouncedGeneratePreview });
  history = [JSON.stringify(canvas.toJSON())];
  historyIndex = 0;
  savedHistoryIndex = 0;
  dragElement(document.getElementById("floating-toolbar"));

  document.getElementById('input-image').addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => fabric.Image.fromURL(e.target.result, (img) => {
      img.set({ left: 100, top: 100, scaleX: 0.5, scaleY: 0.5 });
      canvas.add(img);
    });
    reader.readAsDataURL(file);
  });

  document.getElementById("columns-menu").addEventListener("change", function () {
    const col = this.value;
    if (!col) return;

    const placeholder = `{{${col}}}`;
    const activeObject = canvas.getActiveObject();

    if (activeObject && activeObject.isEditing) {
      const start = activeObject.selectionStart;
      const end = activeObject.selectionEnd;
      const originalText = activeObject.text;
      const newText = originalText.slice(0, start) + placeholder + originalText.slice(end);
      activeObject.set('text', newText);
      activeObject.exitEditing();
      saveState();
      debouncedGeneratePreview();
      canvas.setActiveObject(activeObject);
      activeObject.enterEditing();
      const newCursorPos = start + placeholder.length;
      activeObject.setSelectionRange(newCursorPos, newCursorPos);
      canvas.renderAll();
    } else {
      const newText = new fabric.Textbox(placeholder, {
        left: 100, top: 100, fontSize: 25, fontFamily: 'Arial'
      });
      canvas.add(newText);
      canvas.setActiveObject(newText);
    }
    this.value = "";
  });

  const toolbarControls = {
    "text-align": "textAlign", "font-family": "fontFamily",
    "text-color": "fill", "font-size": "fontSize"
  };
  Object.keys(toolbarControls).forEach(id => {
    const eventType = id === 'text-color' ? 'input' : 'change';
    document.getElementById(id).addEventListener(eventType, function () {
      const prop = toolbarControls[id];
      const value = this.id === 'font-size' ? parseInt(this.value, 10) : this.value;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        if (activeObject.isEditing && activeObject.getSelectionStyles()) {
          activeObject.setSelectionStyles({ [prop]: value });
        } else {
          activeObject.set(prop, value);
        }
        canvas.renderAll();
      }
    });
  });

document.getElementById("text-bold").addEventListener("change", (e) => {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  const style = { fontWeight: e.target.checked ? 'bold' : 'normal' };
  if (activeObject.isEditing && activeObject.selectionStart !== activeObject.selectionEnd) {
    activeObject.setSelectionStyles(style);
  } else {
    activeObject.set(style);
  }
  canvas.renderAll();
});
document.getElementById("text-italic").addEventListener("change", (e) => {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) return;
  const style = { fontStyle: e.target.checked ? 'italic' : 'normal' };
  if (activeObject.isEditing && activeObject.selectionStart !== activeObject.selectionEnd) {
    activeObject.setSelectionStyles(style);
  } else {
    activeObject.set(style);
  }
  canvas.renderAll();
});
  document.getElementById("text-uppercase").addEventListener("click", () => changeCase('upper'));
  document.getElementById("text-lowercase").addEventListener("click", () => changeCase('lower'));
  document.getElementById("bring-to-front").addEventListener("click", () => canvas.getActiveObject()?.bringToFront());
  document.getElementById("send-to-back").addEventListener("click", () => canvas.getActiveObject()?.sendToBack());

  // Listener consolidado para los eventos del lienzo
  canvas.on({
    'object:added': () => { saveState(); debouncedGeneratePreview(); },
    'object:removed': () => { saveState(); debouncedGeneratePreview(); },
    'object:modified': () => { saveState(); debouncedGeneratePreview(); },
    'selection:created': updateFloatingToolbar,
    'selection:updated': updateFloatingToolbar,
    'selection:cleared': () => { document.getElementById("floating-toolbar").style.display = "none"; },
    // CAMBIO: Se mueve el código de devtools-flash a un evento más lógico.
    'text:editing:entered': (e) => {
        if (window.require && window.require('electron')) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('devtools-flash');
            } catch (err) {
                console.warn('No se pudo enviar devtools-flash:', err);
            }
        }
    }
  });

  // CAMBIO: Se añade el plan B de "foco agresivo" para garantizar que funcione.
  console.log('Iniciando intento agresivo de foco...');
  let focusAttempts = 0;
  const canvasElement = document.querySelector('#canvas-container canvas');
  const focusInterval = setInterval(() => {
      console.log(`Intento de foco #${focusAttempts + 1}`);
      window.focus(); // 1. Enfocar la ventana
      if (canvasElement) {
        canvasElement.focus(); // 2. Enfocar el canvas directamente
      }
      
      focusAttempts++;
      if (focusAttempts >= 12 || document.hasFocus()) { 
          if (document.hasFocus()) {
              console.log('Éxito: La ventana ahora tiene el foco.');
          }
          console.log('Finalizando intento de foco agresivo.');
          clearInterval(focusInterval);
      }
  }, 250);
});




function showNotification(message, type = 'info') {
  let area = document.getElementById('notification-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'notification-area';
    area.style.position = 'fixed';
    area.style.top = '24px';
    area.style.right = '24px';
    area.style.zIndex = '9999';
    document.body.appendChild(area);
  }
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.textContent = message;
  notif.style.cssText = `
    background:#1976d2;color:#fff;padding:12px 24px;border-radius:8px;
    margin-bottom:10px;box-shadow:0 2px 8px #0002;font-weight:500;min-width:220px;
    font-size:1em;opacity:0;transform:scale(0.7);transition:none;
  `;
  area.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '1';
    notif.style.transform = 'scale(1)';
    notif.style.transition = 'all 0.3s cubic-bezier(.68,-0.55,.27,1.55)';
  }, 50);
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'scale(0.7)';
    notif.style.transition = 'all 0.4s';
    setTimeout(() => notif.remove(), 400);
  }, 3200);
}

document.getElementById('guardar-sede-btn').addEventListener('click', async () => {
    let sedeId = document.getElementById('input-sede-id').value;
    sedeId = limpiarSedeId(sedeId);
    if (!sedeId) {
        showNotification('Ingresa un ID de sede válido (solo letras, números, guiones y guiones bajos).', 'error');
        return;
    }
    document.getElementById('input-sede-id').value = sedeId; // Actualiza el campo con el formato limpio
    localStorage.setItem('qr_app_sede_id', sedeId);
    window.electronAPI.setSedeId(sedeId);
    await guardarConfiguracion();
    showNotification(`Sede guardada: ${sedeId}`, 'success');
    // --- ¡AGREGA ESTA LÍNEA PARA LIMPIAR EL INPUT! ---
    document.getElementById('input-sede-id').value = '';
});

