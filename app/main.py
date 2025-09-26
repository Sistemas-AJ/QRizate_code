# backend/main.py - VERSIÓN FINAL CON ICONO EN BANDEJA DE SISTEMA

import os
import sys
import socket
import logging
import argparse
from contextlib import asynccontextmanager
import asyncio
import websockets
import json
from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# NUEVOS IMPORTS para archivos estáticos
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

# Importaciones de tu proyecto
from models.db import init_db, get_db, Base, engine
from routers.activos import router as activos_router
from models.activo import Activo # Necesario para la consulta
import uvicorn

# --- NUEVOS IMPORTS PARA LA BANDEJA DEL SISTEMA ---
import threading
from pystray import MenuItem as item, Icon as icon
from PIL import Image
# =============================================================================


# =============================================================================
# ===== FUNCIÓN CLAVE PARA QUE PYINSTALLER ENCUENTRE TUS ARCHIVOS =========
# =============================================================================
def resource_path(relative_path):
    """
    Obtiene la ruta absoluta al recurso. Funciona tanto en modo de
    desarrollo como cuando está empaquetado con PyInstaller.
    """
    try:
        # PyInstaller crea una carpeta temporal y guarda su ruta en _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        # Si no está empaquetado, usa la ruta normal del script
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)
# =============================================================================

# --- 1. CONFIGURACIÓN (Tu código original) ---
VPS_WEBSOCKET_URL = "wss://qrizate.systempiura.com/ws/"
SEDE_ID = "Oficinas-AJ"

CONFIG_PATH = 'config.json'

def load_config():
    if not os.path.exists(CONFIG_PATH):
        return {}
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_config(config_data):
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=4)

config = load_config()
vps_connection_task = None

# --- CÓDIGO INICIAL (Tu código original) ---
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(0)
    try:
        s.connect(('10.255.255.255', 1)); ip = s.getsockname()[0]
    except Exception: ip = '127.0.0.1'
    finally: s.close()
    return ip

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000)
parser.add_argument("--public-url", type=str, default="http://qrizate.systempiura.com/asset.html")
args = parser.parse_args()
local_hostname = get_local_ip()

APP_DATA_DIR = os.path.join(os.path.expanduser("~"), "AppData", "Local", "QRizate")
os.makedirs(APP_DATA_DIR, exist_ok=True)
DATABASE_PATH = os.path.join(APP_DATA_DIR, "QRizate.db")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[logging.FileHandler(os.path.join(APP_DATA_DIR, 'qrizate_backend.log')),
                              logging.StreamHandler(sys.stdout)])

# --- 2. LÓGICA DEL CLIENTE WEBSOCKET (Tu código original) ---
def get_asset_html_from_db(asset_id: str) -> str:
    db_session: Session = next(get_db())
    try:
        activo = db_session.query(Activo).filter(Activo.id == asset_id).first()
        if not activo:
            return "<h2>Activo no encontrado</h2>"
        html = f"""
        <html>
        <head>
            <title>Detalle del Activo</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }}
                .container {{ max-width: 520px; margin: 40px auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px #003cb322; padding: 32px 28px; }}
                h2 {{ color: #003cb3; margin-bottom: 24px; font-size: 2rem; text-align: center; letter-spacing: 1px; }}
                table {{ border-collapse: collapse; width: 100%; background: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px #003cb312; }}
                th, td {{ padding: 12px 14px; text-align: left; font-size: 1rem; }}
                th {{ background-color: #e5eef4; color: #003cb3; font-weight: 600; width: 38%; border-bottom: 1.5px solid #dbe2ea; }}
                td {{ background: #fff; color: #222; border-bottom: 1px solid #f0f4f8; }}
                tr:last-child th, tr:last-child td {{ border-bottom: none; }}
                @media (max-width: 600px) {{
                    .container {{ padding: 16px 4px; }}
                    h2 {{ font-size: 1.3rem; }}
                    th, td {{ padding: 8px 6px; font-size: 0.95rem; }}
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Detalle del Activo</h2>
                <table>
                    <tr><th>ID</th><td>{activo.id}</td></tr>
                    <tr><th>Correlativo</th><td>{activo.correlativo}</td></tr>
                    <tr><th>Área</th><td>{activo.area}</td></tr>
                    <tr><th>Sede</th><td>{activo.sede}</td></tr>
                    <tr><th>Código Activo</th><td>{activo.codigo_activo}</td></tr>
                    <tr><th>Categoría</th><td>{activo.categoria}</td></tr>
                    <tr><th>Nombre Central de Costos</th><td>{activo.nombre_central_costos}</td></tr>
                    <tr><th>Cuenta Contable</th><td>{activo.cuenta_contable}</td></tr>
                    <tr><th>Estado</th><td>{activo.estado}</td></tr>
                    <tr><th>Descripción</th><td>{activo.descripcion}</td></tr>
                    <tr><th>Marca</th><td>{activo.marca}</td></tr>
                    <tr><th>Modelo</th><td>{activo.modelo}</td></tr>
                    <tr><th>Número Serie</th><td>{activo.numero_serie}</td></tr>
                    <tr><th>Número Central Costo</th><td>{activo.numero_central_costo}</td></tr>
                </table>
            </div>
        </body>
        </html>
        """
        return html
    finally:
        db_session.close()

async def connect_to_vps_and_listen(sede_id, vps_url):
    uri = f"{vps_url}{sede_id}"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                logging.info(f" Conectado al VPS como sede '{sede_id}'")
                async for message in websocket:
                    logging.info(f"<- Mensaje recibido del VPS: {message}")
                    try:
                        data = json.loads(message)
                        if data.get("action") == "get_asset":
                            asset_id = data.get("asset_id")
                            asset_html = get_asset_html_from_db(asset_id)
                            response = {
                                "request_id": data.get("request_id"),
                                "data": {"html": asset_html}
                            }
                            await websocket.send(json.dumps(response))
                            logging.info(f"-> Respuesta enviada al VPS: {response}")
                    except Exception as e:
                        logging.error(f"Error procesando mensaje: {e}")
        except Exception as e:
            logging.error(f" Desconectado del VPS. Error: {e}. Reintentando en 5 segundos...")
            await asyncio.sleep(5)

# --- 3. LIFESPAN (Tu código original) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global vps_connection_task
    logging.info(f"Iniciando base de datos en: {DATABASE_PATH}")
    init_db(DATABASE_PATH)
    
    saved_config = load_config()
    if saved_config.get("sede_id"):
        logging.info(f"Configuración encontrada. Conectando automáticamente como Sede: {saved_config['sede_id']}")
        app.state.SEDE_ID = saved_config['sede_id']
        app.state.PUBLIC_URL_BASE = "https://qrizate.systempiura.com/activo"
        vps_connection_task = asyncio.create_task(connect_to_vps_and_listen(saved_config['sede_id'], saved_config['vps_websocket_url']))
    else:
        logging.warning("No se encontró configuración de sede. Esperando configuración desde el frontend...")
    yield
    if vps_connection_task:
        logging.info("Cerrando conexión con VPS...")
        vps_connection_task.cancel()

# --- Aplicación FastAPI ---
app = FastAPI(
    title="QRizate Backend Local",
    description="Servidor local que se conecta al VPS para permitir consultas remotas",
    version="2.0.0",
    lifespan=lifespan
)

@app.post("/configure")
async def configure_sede(data: dict = Body(...)):
    global vps_connection_task
    sede_id = data.get("sede_id")
    vps_url = data.get("vps_websocket_url", VPS_WEBSOCKET_URL)
    if not sede_id:
        return {"detail": "Falta sede_id"}, 400
    config = load_config()
    config["sede_id"] = sede_id
    config["vps_websocket_url"] = vps_url
    save_config(config)
    app.state.SEDE_ID = sede_id
    app.state.PUBLIC_URL_BASE = "https://qrizate.systempiura.com/activo"
    if vps_connection_task:
        vps_connection_task.cancel()
    vps_connection_task = asyncio.create_task(connect_to_vps_and_listen(sede_id, vps_url))
    logging.info(f"Sede configurada desde frontend: {sede_id}. Conectando al VPS...")
    return {"sede_id_registrado": sede_id}

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.mount("/assets", StaticFiles(directory=resource_path("assets")), name="assets")

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    return FileResponse(resource_path('favicon.ico'))

app.include_router(activos_router)

@app.get("/", include_in_schema=False)
def read_root():
    return "<h1> Servidor Local QRizate funcionando</h1><p>Conectándose al VPS...</p>"

# =============================================================================
# ===== NUEVA LÓGICA DE INICIO CON HILOS E ÍCONO DE BANDEJA =================
# =============================================================================

def run_server():
    """Función que ejecuta el servidor uvicorn."""
    logging.info(f"Iniciando servidor FastAPI en http://{local_hostname}:{args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port, reload=False)

def setup_and_run_tray_icon():
    """Configura y ejecuta el ícono en la bandeja del sistema."""
    try:
        image = Image.open(resource_path("favicon.ico"))
    except Exception as e:
        logging.error(f"No se pudo cargar el ícono 'favicon.ico': {e}")
        return

    def quit_action(icon, item):
        logging.info("Saliendo de la aplicación a través del menú del ícono.")
        icon.stop()
        os._exit(0)

    menu = (item('Salir', quit_action),)
    icon_obj = icon("QRizateServer", image, "QRizate Server", menu)
    icon_obj.run()

if __name__ == "__main__":
    # 1. Creamos un hilo para el servidor. Lo marcamos como 'daemon' para
    #    que se cierre automáticamente cuando el programa principal (el ícono) termine.
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    
    # 2. Iniciamos el hilo del servidor en segundo plano.
    server_thread.start()
    
    # 3. Ejecutamos el ícono de la bandeja en el hilo principal.
    #    Este código se quedará esperando hasta que se haga clic en "Salir".
    logging.info("Mostrando ícono en la bandeja del sistema.")
    setup_and_run_tray_icon()