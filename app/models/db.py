import os
import sys
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.activo import Base

# Variables globales para la configuración de base de datos
engine = None
SessionLocal = None
DB_PATH = None
DATABASE_URL = None

def get_default_db_path():
    """Obtiene la ruta por defecto de la base de datos"""
    if getattr(sys, 'frozen', False):
        # Si está empaquetado con PyInstaller
        application_path = os.path.dirname(sys.executable)
    else:
        # Si está en desarrollo
        application_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    return os.path.join(application_path, "QRizate.db")

def init_db(db_path=None):
    """
    Inicializa la base de datos con la ruta especificada
    Args:
        db_path: Ruta personalizada para la base de datos. Si es None, usa la ruta por defecto.
    """
    global engine, SessionLocal, DB_PATH, DATABASE_URL
    
    # Usar ruta personalizada o la por defecto
    if db_path is None:
        DB_PATH = get_default_db_path()
    else:
        DB_PATH = db_path
    
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    
    logging.info(f"Inicializando base de datos en: {DB_PATH}")
    
    # Crear el directorio si no existe
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    # Crear engine y sessionmaker
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Crear las tablas
    try:
        # Siempre intentar crear las tablas (no falla si ya existen)
        Base.metadata.create_all(bind=engine)
        
        if not os.path.exists(DB_PATH):
            logging.info(f"Base de datos '{DB_PATH}' creada exitosamente.")
        else:
            logging.info(f"Base de datos '{DB_PATH}' ya existe.")
            
        # Verificar que las tablas existen
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logging.info(f"Tablas disponibles en la base de datos: {tables}")
        
    except Exception as e:
        logging.error(f"Error al inicializar la base de datos: {e}")
        # Intentar crear la base de datos de todas maneras
        Base.metadata.create_all(bind=engine)
        logging.info("Base de datos creada con éxito después del error.")

def get_db():
    """Dependencias para obtener una sesión de base de datos para cada solicitud."""
    if SessionLocal is None:
        raise RuntimeError("Base de datos no inicializada. Llama a init_db() primero.")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        logging.debug("Sesión de base de datos cerrada correctamente.")
