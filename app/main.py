import sys
import os
import threading
import time
import signal
import logging
from contextlib import asynccontextmanager

# --- Configuración de directorio AppData primero ---
APP_DATA_DIR = os.path.join(os.path.expanduser("~"), "AppData", "Local", "QRizate")
os.makedirs(APP_DATA_DIR, exist_ok=True)

# --- Configuración de logging para el ejecutable ---
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
import ip_and_port

# --- Determinar la ruta para recursos empaquetados (sin la DB) ---
if getattr(sys, 'frozen', False):
    BASE_DIR_RESOURCES = sys._MEIPASS
else:
    BASE_DIR_RESOURCES = os.path.dirname(os.path.abspath(__file__))

# --- Configuración de la base de datos SQLite en una ruta persistente ---
DATABASE_PATH = os.path.join(APP_DATA_DIR, "QRizate.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info(f"Iniciando base de datos en: {DATABASE_PATH}")
    init_db(DATABASE_PATH)
    yield
    # Shutdown
    logging.info("Cerrando aplicación...")

app = FastAPI(
    title="QRizate Backend",
    description="Sistema de Gestión de Activos - UPAO",
    version="1.0.0",
    lifespan=lifespan
)

# Permitir CORS para desarrollo local y frontend en otro puerto
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activos_router)

@app.get("/", response_class=HTMLResponse)
def read_root():
    return """
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QRizate - Sistema de Gestión de Activos</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            :root {
                --upao-blue: #003B67;
                --upao-orange: #FF6B00;
                --upao-light-blue: #E5EEF4;
                --upao-dark-blue: #002A4A;
                --background: #f8fafc;
                --white: #ffffff;
                --gray-600: #475569;
                --gray-700: #334155;
                --gray-800: #1e293b;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, var(--background) 0%, var(--upao-light-blue) 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--gray-700);
                line-height: 1.6;
            }
            
            .container {
                max-width: 900px;
                width: 90%;
                background: var(--white);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 59, 103, 0.1);
                overflow: hidden;
                position: relative;
            }
            
            .header {
                background: linear-gradient(135deg, var(--upao-blue) 0%, var(--upao-dark-blue) 100%);
                color: var(--white);
                padding: 60px 40px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: float 6s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(180deg); }
            }
            
            .logo {
                font-size: 3.5rem;
                margin-bottom: 10px;
                position: relative;
                z-index: 2;
            }
            
            .title {
                font-size: 2.8rem;
                font-weight: 700;
                margin-bottom: 15px;
                position: relative;
                z-index: 2;
                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .subtitle {
                font-size: 1.3rem;
                font-weight: 400;
                opacity: 0.9;
                position: relative;
                z-index: 2;
            }
            
            .content {
                padding: 50px 40px;
            }
            
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 30px;
                margin-bottom: 40px;
            }
            
            .feature-card {
                background: var(--background);
                padding: 30px 25px;
                border-radius: 15px;
                text-align: center;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 40px rgba(0, 59, 103, 0.15);
                border-color: var(--upao-orange);
            }
            
            .feature-icon {
                font-size: 3rem;
                margin-bottom: 15px;
                display: block;
            }
            
            .feature-title {
                font-size: 1.3rem;
                font-weight: 600;
                color: var(--upao-blue);
                margin-bottom: 10px;
            }
            
            .feature-desc {
                font-size: 1rem;
                color: var(--gray-600);
            }
            
            .cta-section {
                background: linear-gradient(135deg, var(--upao-light-blue) 0%, rgba(255, 107, 0, 0.1) 100%);
                padding: 40px;
                border-radius: 15px;
                text-align: center;
                margin-bottom: 40px;
            }
            
            .cta-title {
                font-size: 1.8rem;
                font-weight: 600;
                color: var(--upao-blue);
                margin-bottom: 20px;
            }
            
            .btn-primary {
                display: inline-block;
                background: linear-gradient(135deg, var(--upao-blue) 0%, var(--upao-dark-blue) 100%);
                color: var(--white);
                padding: 15px 35px;
                border-radius: 50px;
                text-decoration: none;
                font-weight: 600;
                font-size: 1.1rem;
                transition: all 0.3s ease;
                box-shadow: 0 5px 20px rgba(0, 59, 103, 0.3);
                margin: 0 10px;
            }
            
            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 30px rgba(0, 59, 103, 0.4);
                background: linear-gradient(135deg, var(--upao-orange) 0%, #e55a00 100%);
            }
            
            .btn-secondary {
                display: inline-block;
                background: var(--white);
                color: var(--upao-blue);
                padding: 15px 35px;
                border: 2px solid var(--upao-blue);
                border-radius: 50px;
                text-decoration: none;
                font-weight: 600;
                font-size: 1.1rem;
                transition: all 0.3s ease;
                margin: 0 10px;
            }
            
            .btn-secondary:hover {
                background: var(--upao-blue);
                color: var(--white);
                transform: translateY(-2px);
            }
            
            .footer {
                background: var(--gray-800);
                color: var(--white);
                padding: 30px 40px;
                text-align: center;
            }
            
            .developer-info {
                margin-bottom: 20px;
            }
            
            .developer-name {
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 5px;
            }
            
            .developer-link {
                color: var(--upao-orange);
                text-decoration: none;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .developer-link:hover {
                color: var(--white);
                text-decoration: underline;
            }
            
            .university-info {
                font-size: 0.9rem;
                opacity: 0.8;
                border-top: 1px solid rgba(255,255,255,0.1);
                padding-top: 20px;
            }
            
            @media (max-width: 768px) {
                .container {
                    width: 95%;
                    margin: 20px;
                }
                
                .header {
                    padding: 40px 20px;
                }
                
                .title {
                    font-size: 2.2rem;
                }
                
                .content {
                    padding: 30px 20px;
                }
                
                .features {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                .btn-primary, .btn-secondary {
                    display: block;
                    margin: 10px 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header class="header">
                <div class="logo">🏢</div>
                <h1 class="title">QRizate</h1>
                <p class="subtitle">Sistema Inteligente de Gestión de Activos</p>
            </header>
            
            <main class="content">
                <div class="features">
                    <div class="feature-card">
                        <span class="feature-icon">📱</span>
                        <h3 class="feature-title">Códigos QR</h3>
                        <p class="feature-desc">Genera códigos QR únicos para cada activo de manera automática</p>
                    </div>
                    
                    <div class="feature-card">
                        <span class="feature-icon">📊</span>
                        <h3 class="feature-title">Gestión Completa</h3>
                        <p class="feature-desc">Administra todos tus activos desde una interfaz moderna y fácil de usar</p>
                    </div>
                    
                    <div class="feature-card">
                        <span class="feature-icon">🔍</span>
                        <h3 class="feature-title">Búsqueda Avanzada</h3>
                        <p class="feature-desc">Encuentra activos rápidamente con filtros inteligentes</p>
                    </div>
                </div>
                
                <div class="cta-section">
                    <h2 class="cta-title">¡Comienza a gestionar tus activos ahora!</h2>
                    <a href="/docs" class="btn-primary">📚 Ver Documentación API</a>
                    <a href="/activos" class="btn-secondary">🔗 Explorar Activos</a>
                </div>
            </main>
            
        </div>
    </body>
    </html>
    """

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(BASE_DIR_RESOURCES, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")

if __name__ == "__main__":
    def start_server():
        logging.info("Iniciando servidor en http://0.0.0.0:543")
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=543,
            workers=1,
            log_level="info",
            access_log=True
        )

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(3) # Espera un poco más para asegurar que el servidor inicie

    if server_thread.is_alive():
        logging.info("El servidor ha iniciado correctamente.")
    else:
        logging.error("El servidor falló al iniciar. Terminando el programa.")
        sys.exit(1)

    try:
        logging.info("Mostrando información de red...")
        ip = ip_and_port.get_local_ip()
        logging.info(f"El servidor está disponible en http://{ip}:543")
        ip_and_port.show_network_info_fixed_port()
    except Exception as e:
        logging.error(f"Error en la GUI: {e}")
        # Si la GUI falla, mantenemos el hilo principal vivo de otra manera
        logging.info("La GUI ha fallado. El servidor seguirá corriendo en segundo plano.")

    # --- CAMBIO CRÍTICO: Mantener el hilo principal vivo ---
    # Esto asegura que el programa no se cierre, incluso si la GUI falla
    try:
        while threading.main_thread().is_alive():
            time.sleep(1)
    except KeyboardInterrupt:
        logging.info("Programa cerrado manualmente.")

    logging.info("Programa terminado.")