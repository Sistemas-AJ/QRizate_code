/**
 * Genera un QR en un canvas, permitiendo tamaño variable según contexto.
 * @param {HTMLCanvasElement} element - Canvas donde se dibuja el QR
 * @param {string} value - Valor a codificar
 * @param {number|object} sizeOrOptions - Tamaño (número) o {width, height}
 * @param {object} options - Opciones QRious extra
 */
function generarQRCanvas(element, value, sizeOrOptions = 120, options = {}) {
  let size = 120;
  if (typeof sizeOrOptions === 'number') {
    size = sizeOrOptions;
  } else if (typeof sizeOrOptions === 'object' && sizeOrOptions !== null) {
    // Si se pasa {width, height}, usar el menor para mantener cuadrado
    if ('width' in sizeOrOptions && 'height' in sizeOrOptions) {
      size = Math.min(sizeOrOptions.width, sizeOrOptions.height);
    } else if ('size' in sizeOrOptions) {
      size = sizeOrOptions.size;
    }
  }
  return new window.QRious({
    element,
    value,
    size,
    background: options.background || 'white',
    foreground: options.foreground || '#000000',
    level: options.level || 'M'
  });
}
window.generarQRCanvas = generarQRCanvas;
