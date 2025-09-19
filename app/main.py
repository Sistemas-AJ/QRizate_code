# backend/main.py
import socket
import sys
import os
import logging
import argparse # Importamos argparse para leer el puerto desde la línea de comandos
from contextlib import asynccontextmanager

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No importa si no hay conexión, solo queremos la IP local
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

local_hostname = get_local_ip()

# --- LEEMOS LOS ARGUMENTOS PRIMERO ---
# Esto es clave para que 'args' esté disponible globalmente en este script.
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000)
# Añadimos el nuevo argumento para la URL pública
parser.add_argument("--public-url", type=str, default="http://localhost:8000/asset.html")
args = parser.parse_args()

# --- Configuración (sin cambios) ---
APP_DATA_DIR = os.path.join(os.path.expanduser("~"), "AppData", "Local", "QRizate")
os.makedirs(APP_DATA_DIR, exist_ok=True)
LOG_FILE = os.path.join(APP_DATA_DIR, 'qrizate_backend.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

# Imports de FastAPI y dependencias
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from models.db import init_db
from routers.activos import router as activos_router
import uvicorn

DATABASE_PATH = os.path.join(APP_DATA_DIR, "QRizate.db")

# --- Lifespan ahora puede "ver" los args y funciona correctamente ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.hostname = local_hostname # Usamos la IP local obtenida
    app.state.port = args.port
    app.state.public_url_base = args.public_url

    logging.info(f"Configuración guardada: http://{app.state.hostname}:{app.state.port}")
    logging.info(f"Iniciando base de datos en: {DATABASE_PATH}")
    init_db(DATABASE_PATH)
    yield
    logging.info("Cerrando aplicación...")

app = FastAPI(
    title="QRizate Backend",
    description="Sistema de Gestión de Activos - UPAO",
    version="1.0.1",
    lifespan=lifespan
)

# --- CORS ---
# Permitimos todos los orígenes para máxima compatibilidad durante el desarrollo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cambiado a "*" para permitir pruebas desde el celular
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activos_router)

# --- Endpoints Generales ---
@app.get("/health", tags=["Utilities"])
def health_check():
    return {"status": "ok"}

# --- ¡NUEVO ENDPOINT PARA EMPAREJAMIENTO! ---
@app.get("/pair.html", response_class=HTMLResponse, include_in_schema=False)
def get_pairing_page():
    # Esta es la página que el celular abrirá al escanear el QR de Conexión.
    # Su única función es guardar la dirección de este servidor en el celular.
    return """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectando...</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
            .container { max-width: 500px; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            h1 { color: #28a745; font-size: 2em; }
            p { color: #606770; font-size: 1.1em; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>✅ ¡Dispositivo Emparejado!</h1>
            <p>Se ha guardado la dirección del servidor. Ya puedes cerrar esta ventana y escanear los códigos QR de los activos.</p>
        </div>
        <script>
            try {
                const serverUrl = new URL(window.location.href).origin;
                localStorage.setItem('qrizate_server_url', serverUrl);
            } catch (error) {
                document.querySelector('.container').innerHTML = '<h1>❌ Error</h1><p>La URL de emparejamiento no es válida.</p>';
            }
        </script>
    </body>
    </html>
    """

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def read_root():
    return "<h1>✅ Servidor QRizate funcionando</h1>"

# --- Inicio del Servidor Simplificado ---
if __name__ == "__main__":
    logging.info(f"Iniciando servidor FastAPI en http://{local_hostname}:{args.port}")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=args.port
    )