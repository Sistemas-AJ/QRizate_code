# backend/main.py - VERSIÓN FINAL CON CLIENTE WEBSOCKET INTEGRADO

import socket
import sys
import os
import logging
import argparse
from contextlib import asynccontextmanager
import asyncio
import websockets
import json

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Importaciones de tu proyecto
from models.db import init_db, get_db, Base, engine
from routers.activos import router as activos_router
from models.activo import Activo # Necesario para la consulta
import uvicorn

# --- 1. CONFIGURACIÓN ---
# ¡IMPORTANTE! Edita estos valores según tu configuración
VPS_WEBSOCKET_URL = "wss://qrizate.systempiura.com/ws/" # Tu dominio seguro con wss://
SEDE_ID = "Oficinas-AJ" # ¡IDENTIFICADOR ÚNICO PARA ESTA MÁQUINA!

# --- CÓDIGO INICIAL (sin cambios) ---
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

# --- 2. LÓGICA DEL CLIENTE WEBSOCKET ---
def get_asset_html_from_db(asset_id: str) -> str:
    # Crea una sesión de DB manualmente
    db_session: Session = next(get_db())
    try:
        # Usa la misma lógica que el endpoint HTML
        activo = db_session.query(Activo).filter(Activo.id == asset_id).first()
        if not activo:
            return "<h2>Activo no encontrado</h2>"
        html = f"""
        <html>
        <head>
            <title>Detalle del Activo</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 2em; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h2>Detalle del Activo</h2>
            <table>
                <tr><th>ID</th><td>{activo.id}</td></tr>
                <tr><th>Correlativo</th><td>{activo.correlativo}</td></tr>
                <tr><th>Área</th><td>{activo.area}</td></tr>
                <tr><th>Sede</th><td>{activo.sede}</td></tr>
                <tr><th>Código Activo</th><td>{activo.codigo_activo}</td></tr>
                <tr><th>URL</th><td><a href="{activo.url}" target="_blank">{activo.url}</a></td></tr>
                <tr><th>Categoría</th><td>{activo.categoria}</td></tr>
                <tr><th>Central de Costos</th><td>{activo.central_de_costos}</td></tr>
                <tr><th>Cuenta Contable</th><td>{activo.cuenta_contable}</td></tr>
                <tr><th>Estado</th><td>{activo.estado}</td></tr>
                <tr><th>Descripción</th><td>{activo.descripcion}</td></tr>
                <tr><th>Marca</th><td>{activo.marca}</td></tr>
                <tr><th>Modelo</th><td>{activo.modelo}</td></tr>
                <tr><th>Número Serie</th><td>{activo.numero_serie}</td></tr>
                <tr><th>Número Central Costo</th><td>{activo.numero_central_costo}</td></tr>
            </table>
        </body>
        </html>
        """
        return html
    finally:
        db_session.close()

async def connect_to_vps_and_listen():
    uri = f"{VPS_WEBSOCKET_URL}{SEDE_ID}"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                logging.info(f" Conectado al VPS como sede '{SEDE_ID}'")
                async for message in websocket:
                    logging.info(f"<- Mensaje recibido del VPS: {message}")
                    try:
                        data = json.loads(message)
                        if data.get("action") == "get_asset":
                            asset_id = data.get("asset_id")
                            asset_html = get_asset_html_from_db(asset_id)
                            response = {
                                "request_id": data.get("request_id"),
                                "data": {
                                    "html": asset_html
                                }
                            }
                            await websocket.send(json.dumps(response))
                            logging.info(f"-> Respuesta enviada al VPS: {response}")
                    except Exception as e:
                        logging.error(f"Error procesando mensaje: {e}")
        except Exception as e:
            logging.error(f" Desconectado del VPS. Error: {e}. Reintentando en 5 segundos...")
            await asyncio.sleep(5)

# --- 3. LIFESPAN MODIFICADO ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info(f"Iniciando base de datos en: {DATABASE_PATH}")
    init_db(DATABASE_PATH)
    
    # Pasamos la configuración a la app para que los routers la puedan usar
    app.state.SEDE_ID = SEDE_ID
    app.state.PUBLIC_URL_BASE = f"https://qrizate.systempiura.com/activo"

    logging.info("Iniciando cliente WebSocket para conectar con el VPS...")
    app.state.websocket_client_task = asyncio.create_task(connect_to_vps_and_listen())
    
    yield
    
    logging.info("Cerrando aplicación y cliente WebSocket...")
    app.state.websocket_client_task.cancel()

# --- Aplicación FastAPI (Limpia y actualizada) ---
app = FastAPI(
    title="QRizate Backend Local",
    description="Servidor local que se conecta al VPS para permitir consultas remotas",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(activos_router)

@app.get("/", include_in_schema=False)
def read_root():
    return "<h1> Servidor Local QRizate funcionando</h1><p>Conectándose al VPS...</p>"

# --- Inicio del Servidor ---
if __name__ == "__main__":
    logging.info(f"Iniciando servidor local en http://{local_hostname}:{args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
