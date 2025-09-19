import sys
import os
import logging
import argparse # Importamos argparse para leer el puerto desde la línea de comandos
from contextlib import asynccontextmanager

# --- Configuración de directorio AppData (sin cambios, es perfecto) ---
APP_DATA_DIR = os.path.join(os.path.expanduser("~"), "AppData", "Local", "QRizate")
os.makedirs(APP_DATA_DIR, exist_ok=True)

# --- Configuración de logging (sin cambios, es perfecto) ---
LOG_FILE = os.path.join(APP_DATA_DIR, 'qrizate_backend.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout) # Imprime también en la consola de Electron
    ]
)

# Imports de FastAPI y dependencias
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from models.db import init_db
from routers.activos import router as activos_router
import uvicorn

# --- Determinar la ruta para recursos (sin cambios, es perfecto) ---
if getattr(sys, 'frozen', False):
    BASE_DIR_RESOURCES = sys._MEIPASS
else:
    BASE_DIR_RESOURCES = os.path.dirname(os.path.abspath(__file__))

# --- Configuración de la base de datos (sin cambios, es perfecto) ---
DATABASE_PATH = os.path.join(APP_DATA_DIR, "QRizate.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lógica de inicio
    app.state.hostname = args.hostname # Guardamos el hostname para que los routers lo usen
    app.state.port = args.port         # Guardamos el puerto
    
    logging.info(f"Iniciando base de datos en: {DATABASE_PATH}")
    init_db(DATABASE_PATH)
    yield
    # Lógica de apagado
    logging.info("Cerrando aplicación...")

app = FastAPI(
    title="QRizate Backend",
    description="Sistema de Gestión de Activos - UPAO",
    version="1.0.1",
    lifespan=lifespan
)

# --- AJUSTE DE CORS ---
# Hacemos el CORS un poco más específico para mayor seguridad.
# "app://." es el origen que usan las aplicaciones de Electron por defecto.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["app://."],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activos_router)

@app.get("/health", tags=["Utilities"])
def health_check():
    """
    Endpoint simple para verificar que el servidor está funcionando.
    """
    return {"status": "ok"}

# --- El HTML de bienvenida y el favicon se mantienen, ¡están geniales! ---
@app.get("/", response_class=HTMLResponse)
def read_root():
    # ... (tu hermoso HTML aquí, no es necesario cambiarlo) ...
    return """ Hola este es el servidor de activos """

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(BASE_DIR_RESOURCES, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")


# --- CAMBIO PRINCIPAL: SIMPLIFICACIÓN DEL INICIO ---
# Ahora el script es un simple servidor que se inicia y espera
# a que Electron le diga en qué puerto correr.
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    # Leemos ambos argumentos pasados por Electron
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--hostname", type=str, default="localhost")
    args = parser.parse_args()

    logging.info(f"Iniciando servidor FastAPI en http://{args.hostname}:{args.port}")
    
    uvicorn.run(
        app,
        host="0.0.0.0", # Escuchamos en todas las interfaces
        port=args.port
    )