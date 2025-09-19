// =======================================================================
// qr.js - VERSIÓN FINAL Y ORDENADA
// =======================================================================

// --- 1. INICIALIZACIÓN DE VARIABLES GLOBALES ---
const canvas = new fabric.Canvas('canvas', {
  hoverCursor: 'pointer',
  selection: true,
  selectionBorderColor: '#007bff',
  selectionLineWidth: 2
});
// Aumenta el área de sensibilidad de los controles
fabric.Object.prototype.padding = 8;
fabric.Object.prototype.cornerSize = 14;
fabric.Object.prototype.hoverCursor = 'pointer';
let dataRows = [];
let zip = new JSZip();
let fileNameCounts = {};
let history = [];
let historyIndex = -1;
let savedHistoryIndex = -1;
let historyLock = false;

// --- 2. FUNCIONES DE MANEJO DEL LIENZO Y PLANTILLAS ---

function addText() {
  const text = new fabric.Textbox('Ingrese texto...', {
    left: 100, top: 100, fontSize: 20, fill: '#000000',
    textAlign: 'left', fontFamily: 'Arial', width: 300
  });
  canvas.add(text);
}

function addQrPlaceholder() {
  const qrPlaceholder = new fabric.Textbox('{{qr}}', {
    left: 150, top: 150, fontSize: 30, fill: '#007bff',
    fontFamily: 'Courier New', width: 150, textAlign: 'center',
  });
  canvas.add(qrPlaceholder);
}

function triggerImageUpload() {
  document.getElementById('input-image').click();
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
    dataRows = XLSX.utils.sheet_to_json(sheet);
    alert('Datos de Excel cargados.');
    populateColumnSelectors();
    document.getElementById('columns-menu').disabled = false;
  };
  reader.readAsBinaryString(file);
}

function populateColumnSelectors() {
  const columnsMenu = document.getElementById("columns-menu");
  const qrColumnSelect = document.getElementById("qr-column-select");
  const filenameColumnSelect = document.getElementById("filename-column-select");
  columnsMenu.innerHTML = '<option value="">(seleccionar)</option>';
  qrColumnSelect.innerHTML = "<option value=''>Por defecto ('qr')</option>";
  filenameColumnSelect.innerHTML = "<option value=''>Por defecto ('nombre')</option>";
  if (dataRows.length > 0) {
    const columns = Object.keys(dataRows[0]);
    columns.forEach(col => {
      const option = document.createElement("option");
      option.value = col;
      option.text = col;
      columnsMenu.appendChild(option.cloneNode(true));
      qrColumnSelect.appendChild(option.cloneNode(true));
      filenameColumnSelect.appendChild(option.cloneNode(true));
    });
  }
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
    alert("Por favor, carga un archivo de Excel antes de generar los certificados.");
    return;
  }
  zip = new JSZip();
  fileNameCounts = {};
  const total = dataRows.length;
  const qrColumn = document.getElementById('qr-column-select').value;
  const filenameColumn = document.getElementById('filename-column-select').value;

  // 1. Mostramos la barra de progreso inmediatamente.
  showProgress("qr", total);

  // 2. Usamos setTimeout para darle al navegador un instante para renderizar la barra.
  setTimeout(async () => {
    // --- FASE 1: Preparar todos los lienzos (Canvas) con sus datos y QR ---
    const canvasProcessingPromises = dataRows.map((row, index) => {
      return new Promise(resolveCanvas => {
        const clonedCanvas = new fabric.Canvas(null, { width: canvas.width, height: canvas.height });
        clonedCanvas.loadFromJSON(canvas.toJSON(), () => {
          const qrPromise = processQrForCanvas(clonedCanvas, row, qrColumn);
          clonedCanvas.getObjects().forEach(obj => {
            if ((obj.type === 'textbox' || obj.type === 'i-text') && !obj.text.includes('{{qr}}')) {
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

    // --- FASE 2: Convertir cada lienzo preparado a PDF ---
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

    // --- FINALIZACIÓN ---
    hideProgress();
    downloadAll();
    alert("¡Certificados generados y listos para descargar!");

  }, 50); // Una pequeña pausa de 50 milisegundos es suficiente.
}

function processQrForCanvas(canvasInstance, rowData, qrColumn) {
  return new Promise(resolve => {
    const qrPlaceholder = canvasInstance.getObjects().find(o => o.text && o.text.includes('{{qr}}'));
    if (!qrPlaceholder) return resolve();

    let qrData = qrColumn ? rowData[qrColumn] : (rowData['qr'] || rowData['QR'] || rowData['Qr']);
    if (qrData) {
      QRCode.toDataURL(qrData, { width: qrPlaceholder.getScaledWidth(), margin: 1 }, (err, url) => {
        if (url) {
          fabric.Image.fromURL(url, qrImg => {
            qrImg.set({ left: qrPlaceholder.left, top: qrPlaceholder.top, angle: qrPlaceholder.angle });
            canvasInstance.remove(qrPlaceholder);
            canvasInstance.add(qrImg);
            resolve();
          });
        } else {
          canvasInstance.remove(qrPlaceholder);
          resolve();
        }
      });
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

    // --- LA SOLUCIÓN ESTÁ AQUÍ ---
    // 1. Crear un intérprete (parser)
    const parser = new DOMParser();
    // 2. Interpretar el texto SVG para crear un documento SVG
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    // 3. Obtener el elemento raíz <svg> del documento
    const svgElement = svgDoc.documentElement;

    const pdf = new window.jspdf.jsPDF({ 
        orientation: 'landscape', 
        unit: 'px', 
        format: [canvasInstance.width, canvasInstance.height] 
    });

    // 4. Pasamos el ELEMENTO SVG, no el texto
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
      alert("Hubo un error al generar el PDF. Revisa la consola para más detalles.");
    });

  } catch (error) {
    console.error("Error general al exportar PDF único:", error);
    alert("Hubo un error al generar el PDF. Revisa la consola para más detalles.");
  }
}

function downloadAll() {
  if (Object.keys(zip.files).length === 0) {
    alert("No hay certificados generados para descargar. Usa 'Generar Certificados' primero.");
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

function generatePreview() {
  if (window.previewFabricCanvas) {
    window.previewFabricCanvas.dispose();
  }
  const previewCanvas = new fabric.Canvas('preview-canvas');
  window.previewFabricCanvas = previewCanvas;

  previewCanvas.loadFromJSON(canvas.toJSON(), () => {
    const promises = [];

    if (dataRows.length > 0 && dataRows[0]) {
      const row = dataRows[0];
      const qrColumn = document.getElementById('qr-column-select').value;

      previewCanvas.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
          if (obj.text.includes('{{qr}}')) {
            const qrPromise = new Promise(resolve => {
              let qrData = qrColumn ? row[qrColumn] : (row['qr'] || row['QR'] || row['Qr']);
              if (qrData) {
                QRCode.toDataURL(qrData, { width: obj.getScaledWidth(), margin: 1 }, (err, url) => {
                  if (url) {
                    fabric.Image.fromURL(url, qrImg => {
                      qrImg.set({ left: obj.left, top: obj.top, angle: obj.angle });
                      previewCanvas.remove(obj);
                      previewCanvas.add(qrImg);
                      resolve();
                    });
                  } else {
                    resolve();
                  }
                });
              } else {
                previewCanvas.remove(obj);
                resolve();
              }
            });
            promises.push(qrPromise);
          } else {
            // Se llama a la función de reemplazo de texto para las demás etiquetas
            replaceTextWithStyles(obj, row);
          }
        }
      });
    }

    Promise.all(promises).then(() => {
      previewCanvas.renderAll();
    });
  });
}

const debouncedGeneratePreview = debounce(generatePreview, 300);

/**
 * Actualiza los valores de la barra de herramientas para que coincidan con el objeto seleccionado.
 * NO añade listeners de eventos.
 */
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

function changeCase(targetCase) {
    const activeObject = canvas.getActiveObject();
    if (!activeObject || !['textbox', 'i-text', 'text'].includes(activeObject.type)) return;

    // Si hay texto seleccionado, se aplica el cambio solo a la selección
    if (activeObject.isEditing && activeObject.selectionStart !== activeObject.selectionEnd) {
        const start = activeObject.selectionStart;
        const end = activeObject.selectionEnd;
        const selectedText = activeObject.getSelectedText();
        const newSelectedText = (targetCase === 'upper') ? selectedText.toUpperCase() : selectedText.toLowerCase();
        
        // Reemplazamos el texto seleccionado de forma manual y segura
        const originalText = activeObject.text;
        const newFullText = originalText.slice(0, start) + newSelectedText + originalText.slice(end);
        activeObject.set('text', newFullText);

        // Mantenemos la selección sobre el texto modificado
        activeObject.selectionStart = start;
        activeObject.selectionEnd = end;

    } else { // Si no, se aplica a todo el objeto
        const newText = (targetCase === 'upper') ? activeObject.text.toUpperCase() : activeObject.text.toLowerCase();
        activeObject.set('text', newText);
    }
    canvas.renderAll();
}

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  // El área de arrastre será el encabezado o, si no existe, el propio elemento.
  const header = document.getElementById(elmnt.id + "-header") || elmnt;
  
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    // Si el clic se hizo sobre un control interactivo, no iniciar el arrastre.
    const target = e.target;
    if (['SELECT', 'INPUT', 'BUTTON', 'OPTION', 'LABEL', 'I'].includes(target.tagName)) {
        return;
    }
    
    e.preventDefault();
    
    // Posición inicial del cursor
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Asignamos los eventos de movimiento y soltado al documento entero
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    
    // Calculamos el desplazamiento del cursor
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Aplicamos la nueva posición al elemento
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Limpiamos los eventos cuando se suelta el clic
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/**
 * Función de reemplazo de texto mejorada.
 * Encuentra todos los placeholders en un objeto de texto y los reemplaza con los datos de la fila.
 */
function replaceTextWithStyles(obj, rowData) {
  let text = obj.text;
  if (!text) return;
  const placeholders = text.match(/\{\{.*?\}\}/g);
  if (placeholders) {
    placeholders.forEach(placeholder => {
      const key = placeholder.replace(/[{}]/g, '');
      if (rowData.hasOwnProperty(key)) {
        const replacement = rowData[key] || '';
        text = text.split(placeholder).join(replacement);
      }
    });
  }
  obj.set('text', text);
}


function openTemplateModal() { document.getElementById('template-modal').style.display = 'flex'; }
function closeTemplateModal() { document.getElementById('template-modal').style.display = 'none'; }
function showProgress(phase) { /* ... */ }
function hideProgress() { /* ... */ }
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// --- 7. INICIALIZACIÓN Y LISTENERS DE EVENTOS ---

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de la app
  inicializarAtajos(canvas, { undo, redo, deleteSelected, saveTemplate, saveState, debouncedGeneratePreview });
  history = [JSON.stringify(canvas.toJSON())];
  historyIndex = 0;
  savedHistoryIndex = 0;
  dragElement(document.getElementById("floating-toolbar"));
  closeTemplateModal();

  // --- BLOQUE DE LISTENERS CENTRALIZADO Y ÚNICO ---

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
      // --- LÓGICA FINAL Y ROBUSTA PARA INSERTAR ---

      const start = activeObject.selectionStart;
      const end = activeObject.selectionEnd;
      const originalText = activeObject.text;

      // 1. Construimos el nuevo texto manualmente
      const newText = originalText.slice(0, start) + placeholder + originalText.slice(end);
      activeObject.set('text', newText);

      // 2. Salimos del modo de edición para "confirmar" el cambio en el objeto
      activeObject.exitEditing();

      // 3. Forzamos el guardado en nuestro historial y actualizamos la vista previa
      saveState();
      debouncedGeneratePreview();

      // 4. Volvemos a seleccionar y a entrar en modo edición para que el usuario pueda seguir escribiendo
      canvas.setActiveObject(activeObject);
      activeObject.enterEditing();

      // 5. Movemos el cursor al final del texto insertado
      const newCursorPos = start + placeholder.length;
      activeObject.setSelectionRange(newCursorPos, newCursorPos);

      // 6. Finalmente, renderizamos el lienzo
      canvas.renderAll();

    } else {
      // Si no hay nada seleccionado, crea un nuevo cuadro de texto.
      const newText = new fabric.Textbox(placeholder, {
        left: 100, top: 100, fontSize: 25, fontFamily: 'Arial'
      });
      canvas.add(newText);
      canvas.setActiveObject(newText);
    }

    // Limpiamos el valor del menú desplegable.
    this.value = "";
  });

  // Listeners para la barra de herramientas de texto
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

  // Listeners para checkboxes y botones de la barra de herramientas
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
});

// Listener consolidado para los eventos del lienzo
canvas.on({
  'object:added': () => { saveState(); debouncedGeneratePreview(); },
  'object:removed': () => { saveState(); debouncedGeneratePreview(); },
  'object:modified': () => { saveState(); debouncedGeneratePreview(); },
  'selection:created': updateFloatingToolbar,
  'selection:updated': updateFloatingToolbar,
  'selection:cleared': () => { document.getElementById("floating-toolbar").style.display = "none"; }
});