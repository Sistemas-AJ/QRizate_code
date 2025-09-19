function inicializarAtajos(canvas, fns) {
  let clipboard = null;
  let isInternalCopy = false;

  const copyObject = () => {
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.clone(cloned => {
        clipboard = cloned;
        isInternalCopy = true;
        console.log("Objeto interno copiado. Pegado interno activado.");
      });
    }
  };

  async function paste() {
    if (isInternalCopy && clipboard) {
      clipboard.clone(clonedObj => {
        canvas.discardActiveObject();
        clonedObj.set({ left: clonedObj.left + 15, top: clonedObj.top + 15, evented: true });
        if (clonedObj.type === 'activeSelection') {
          clonedObj.canvas = canvas;
          clonedObj.forEachObject(obj => canvas.add(obj));
          clonedObj.setCoords();
        } else {
          canvas.add(clonedObj);
        }
        clipboard.top += 15;
        clipboard.left += 15;
        canvas.setActiveObject(clonedObj);
        canvas.renderAll();
        
        fns.saveState();
        fns.debouncedGeneratePreview();
      });
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        // Lógica para pegar imágenes
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onloadend = function() {
            fabric.Image.fromURL(reader.result, function(img) {
              img.set({ left: 100, top: 100, scaleX: 0.5, scaleY: 0.5 });
              canvas.add(img);
              canvas.setActiveObject(img);
              canvas.renderAll();
              fns.saveState();
              fns.debouncedGeneratePreview();
            });
          };
          reader.readAsDataURL(blob);
          isInternalCopy = false;
          return;
        }

        // Lógica para pegar texto
        const textType = item.types.find(type => type === "text/plain");
        if (textType) {
          const blob = await item.getType(textType);
          const text = await blob.text();
          const newText = new fabric.Textbox(text, {
            left: 100, top: 100, fontSize: 20, fill: '#000000', fontFamily: 'Arial', width: 300
          });
          canvas.add(newText);
          canvas.setActiveObject(newText);
          canvas.renderAll();
          fns.saveState();
          fns.debouncedGeneratePreview();
          isInternalCopy = false;
          return;
        }
      }
    } catch (err) {
      console.warn("No se pudo leer el portapapeles del sistema.", err);
    }
  }

  // --- LÓGICA CORREGIDA PARA RESETEAR LA BANDERA ---
  const resetInternalCopyFlag = () => {
    if (isInternalCopy) {
      console.log("Estado de copiado interno reseteado.");
      isInternalCopy = false;
    }
  };

  // Eliminamos el listener 'mouse:down' que causaba el problema
  canvas.on({
    'selection:created': resetInternalCopyFlag,
    'selection:updated': resetInternalCopyFlag, // Añadido para más robustez
    'selection:cleared': resetInternalCopyFlag
  });
  // ------------------------------------------------

  // Listener de teclado
  document.addEventListener('keydown', (e) => {
    const activeElement = document.activeElement.tagName;
    if (['INPUT', 'TEXTAREA'].includes(activeElement)) {
      if (!(e.ctrlKey && (e.key === 'z' || e.key === 'y'))) { return; }
    }
    if (canvas.getActiveObject() && canvas.getActiveObject().isEditing && !(e.ctrlKey && e.key === 's')) {
      return;
    }

    if (e.ctrlKey) {
      e.preventDefault();
      switch (e.key.toLowerCase()) {
        case 'z': fns.undo(); break;
        case 'y': fns.redo(); break;
        case 'c': copyObject(); break;
        case 'v': paste(); break;
        case 's': fns.saveTemplate(); break;
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      fns.deleteSelected();
    }
  });

  // Listener para salir de la página
  window.addEventListener('beforeunload', (event) => {
    if (historyIndex !== savedHistoryIndex) {
      event.preventDefault();
      event.returnValue = 'Hay cambios sin guardar. ¿Estás seguro de que quieres salir?';
      return event.returnValue;
    }
  });

  console.log("✅ Atajos de teclado inicializados.");
}