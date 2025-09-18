"""
QRizate Backend - Ejecutable Principal
Versión optimizada para PyInstaller con GUI como interfaz principal
"""

import sys
import os
import threading
import time
import signal
import logging
from contextlib import asynccontextmanager

# Configurar logging para el ejecutable
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('qrizate_backend.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Imports de FastAPI y dependencias
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn

# Imports locales
from models.db import init_db
from routers.activos import router as activos_router
import ip_and_port

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    logging.info("Base de datos inicializada")
    yield
    # Shutdown
    logging.info("Cerrando aplicación")

# Crear aplicación FastAPI
app = FastAPI(
    title="QRizate Backend",
    description="Sistema de Gestión de Activos - UPAO",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(activos_router)

@app.get("/", response_class=HTMLResponse)
def read_root():
    return """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QRizate Backend</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; padding: 40px; 
                background: linear-gradient(135deg, #003B67, #FF6B00);
                color: white; text-align: center; 
            }
            .container { 
                max-width: 800px; margin: 0 auto; 
                background: rgba(255,255,255,0.1); 
                padding: 40px; border-radius: 15px; 
                backdrop-filter: blur(10px);
            }
            h1 { font-size: 3em; margin-bottom: 20px; }
            h2 { color: #FFD700; }
            a { color: #FFD700; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .version { margin-top: 30px; opacity: 0.8; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🌐 QRizate Backend</h1>
            <p>✅ Servidor funcionando correctamente</p>
            <p>📊 <a href="/docs">Documentación de la API</a></p>
            <p>🏢 <a href="/activos/">Gestión de Activos</a></p>
            <h2>🎓 Universidad Privada Antenor Orrego</h2>
            <h3>👨‍💻 Desarrollador: Adrian Ruiz Carreño</h3>
            <p>🔗 GitHub: <a href="https://github.com/AdrianRuizC">AdrianRuizC</a></p>
            <div class="version">QRizate v1.0 - Sistema de Gestión de Activos</div>
        </div>
    </body>
    </html>
    """

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Favicon not found")

class QRizateServer:
    def __init__(self):
        self.server_thread = None
        self.server_running = False
        
    def start_server(self):
        """Inicia el servidor FastAPI en un hilo separado"""
        try:
            logging.info("Iniciando servidor QRizate en puerto 543...")
            self.server_running = True
            uvicorn.run(
                app, 
                host="0.0.0.0", 
                port=543,
                log_level="warning",  # Reducir verbosidad en el ejecutable
                access_log=False
            )
        except Exception as e:
            logging.error(f"Error al iniciar servidor: {e}")
            self.server_running = False
    
    def start_background_server(self):
        """Inicia el servidor en segundo plano"""
        self.server_thread = threading.Thread(target=self.start_server, daemon=True)
        self.server_thread.start()
        
        # Esperar a que el servidor inicie
        time.sleep(2)
        
        if self.server_running:
            ip = ip_and_port.get_local_ip()
            logging.info(f"✅ Servidor QRizate iniciado en http://{ip}:543")
            return True
        else:
            logging.error("❌ Error al iniciar el servidor")
            return False
    
    def show_gui(self):
        """Muestra la GUI de información de red"""
        try:
            ip_and_port.show_network_info_fixed_port()
        except Exception as e:
            logging.error(f"Error en la GUI: {e}")
    
    def run(self):
        """Ejecuta la aplicación completa"""
        logging.info("=== QRizate Backend v1.0 ===")
        logging.info("Sistema de Gestión de Activos - UPAO")
        
        # Configurar manejo de señales
        def signal_handler(sig, frame):
            logging.info("Cerrando QRizate Backend...")
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        
        # Iniciar servidor en segundo plano
        if self.start_background_server():
            # Mostrar GUI (esto mantiene la aplicación viva)
            self.show_gui()
        else:
            logging.error("No se pudo iniciar el servidor. Cerrando aplicación.")
            input("Presiona Enter para cerrar...")
        
        logging.info("Aplicación cerrada")

def main():
    """Función principal para el ejecutable"""
    server = QRizateServer()
    server.run()

if __name__ == "__main__":
    main()
