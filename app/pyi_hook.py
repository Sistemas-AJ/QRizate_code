import sys
import uvicorn.logging

# Cuando se ejecuta en modo sin ventana (console=False), sys.stdout es None.
# Los formateadores de logs de Uvicorn (`DefaultFormatter` y `AccessFormatter`)
# intentan llamar a `sys.stdout.isatty()` para decidir si usar colores, lo que
# provoca un `AttributeError` y detiene la aplicación.

# Este hook reemplaza (monkey-patches) ambos formateadores problemáticos por
# versiones que siempre deshabilitan los colores, evitando así la llamada
# a `.isatty()` sobre un objeto `None`.
if sys.stdout is None:

    # Clase para el formateador 'default'
    class NoColorDefaultFormatter(uvicorn.logging.DefaultFormatter):
        def __init__(self, *args, **kwargs):
            kwargs.pop('use_colors', None)
            super().__init__(*args, use_colors=False, **kwargs)

    # Clase para el formateador 'access'
    class NoColorAccessFormatter(uvicorn.logging.AccessFormatter):
        def __init__(self, *args, **kwargs):
            kwargs.pop('use_colors', None)
            super().__init__(*args, use_colors=False, **kwargs)

    # Reemplazamos las clases originales en el módulo uvicorn.logging
    uvicorn.logging.DefaultFormatter = NoColorDefaultFormatter
    uvicorn.logging.AccessFormatter = NoColorAccessFormatter

