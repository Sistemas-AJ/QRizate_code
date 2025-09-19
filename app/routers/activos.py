from fastapi.responses import HTMLResponse 

import qrcode
import base64
from io import BytesIO
from typing import List, Optional, Dict, Set

from fastapi import APIRouter, Depends, HTTPException, Request
import socket

# --- API Router ---

router = APIRouter(
    prefix="/activos",
    tags=["Activos"]
)



from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from models.activo import Activo
from models.db import get_db

# --- Schemas (Modelos Pydantic) ---
# Adaptados a tu nuevo modelo de Activo

class ActivoBase(BaseModel):
    id: Optional[str] = None
    categoria: Optional[str] = None
    central_de_costos: Optional[str] = None
    area: Optional[str] = None
    correlativo: Optional[str] = None
    cuenta_contable: Optional[str] = None
    estado: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    codigo_activo: Optional[str] = None
    numero_central_costo: Optional[str] = None
    sede: Optional[str] = None
    url: Optional[str] = None

class ActivoCreate(ActivoBase):
    pass

class ActivoUpdate(BaseModel):
    # El 'id' no se puede actualizar, por eso no está aquí
    categoria: Optional[str] = None
    central_de_costos: Optional[str] = None
    area: Optional[str] = None
    correlativo: Optional[str] = None
    cuenta_contable: Optional[str] = None
    estado: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    codigo_activo: Optional[str] = None
    numero_central_costo: Optional[str] = None
    sede: Optional[str] = None
    responsable: Optional[str] = None
    url: Optional[str] = None

class ActivoResponse(ActivoBase):
    class Config:
        from_attributes = True

class ActivoSearch(BaseModel):
    # Schema para la búsqueda avanzada
    id: Optional[str] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    codigo_activo: Optional[str] = None
    sede: Optional[str] = None
    responsable: Optional[str] = None

class StatsResponse(BaseModel):
    total_activos: int
    activos_por_estado: Dict[str, int]

# --- API Router ---

# --- Funciones Auxiliares ---
def generar_qr_base64(texto: str):
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(texto)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

# --- Endpoints CRUD ---

@router.post("/", response_model=ActivoResponse, status_code=201)
def crear_activo(activo: ActivoCreate, request: Request, db: Session = Depends(get_db)):
    # Generar id si no viene
    data = activo.model_dump()
    if not data.get('id'):
        correlativo = data.get('correlativo', '')
        central = data.get('central_de_costos', '')
        area = data.get('area', '')
        data['id'] = f"{correlativo}{central}{area}"
    if db.query(Activo).filter(Activo.id == data['id']).first():
        raise HTTPException(status_code=400, detail="Ya existe un activo con este ID")
    
    # Validar que el correlativo sea único en toda la base de datos
    if data.get('correlativo') and db.query(Activo).filter(Activo.correlativo == data.get('correlativo')).first():
        raise HTTPException(status_code=400, detail="Ya existe un activo con este correlativo")
        
    # Validar que no exista otro activo con el mismo correlativo, central_de_costos y area
    if db.query(Activo).filter(
        Activo.correlativo == data.get('correlativo'),
        Activo.central_de_costos == data.get('central_de_costos'),
        Activo.area == data.get('area')
    ).first():
        raise HTTPException(status_code=400, detail="Ya existe un activo con el mismo correlativo, central_de_costos y área")
    # Generar codigo_activo si no viene
    if not data.get('codigo_activo'):
        data['codigo_activo'] = f"{correlativo}-{central}-{area}"
    # Generar url si no viene
    if not data.get('url'):
        # 'request.app.state.hostname' y 'request.app.state.port' los definiremos en main.py
        hostname = request.app.state.hostname
        port = request.app.state.port
        # Usamos el hostname dinámico en lugar de la IP
        data['url'] = f"http://{hostname}:{port}/activos/detalle/{data['id']}"
    db_activo = Activo(**data)
    db.add(db_activo)
    try:
        db.commit()
        db.refresh(db_activo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al crear el activo: {e}")
    return db_activo

@router.get("/", response_model=List[ActivoResponse])
def obtener_todos_los_activos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    print(f"DEBUG: Buscando activos con skip={skip}, limit={limit}")
    activos = db.query(Activo).offset(skip).limit(limit).all()
    print(f"DEBUG: Encontrados {len(activos)} activos")
    return activos

@router.get("/{activo_id}", response_model=ActivoResponse)
def obtener_activo(activo_id: str, db: Session = Depends(get_db)):
    activo = db.query(Activo).filter(Activo.id == activo_id).first()
    if not activo:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return activo

@router.put("/{activo_id}", response_model=ActivoResponse)
def actualizar_activo(activo_id: str, activo_update: ActivoUpdate, db: Session = Depends(get_db)):
    db_activo = db.query(Activo).filter(Activo.id == activo_id).first()
    if not db_activo:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    update_data = activo_update.model_dump(exclude_unset=True)
    
    # Validar que el correlativo sea único si se está actualizando
    if 'correlativo' in update_data and update_data['correlativo']:
        correlativo_existente = db.query(Activo).filter(
            Activo.correlativo == update_data['correlativo'],
            Activo.id != activo_id  # Excluir el activo actual
        ).first()
        if correlativo_existente:
            raise HTTPException(status_code=400, detail="Ya existe un activo con este correlativo")
    
    for key, value in update_data.items():
        setattr(db_activo, key, value)
        
    db.add(db_activo)
    try:
        db.commit()
        db.refresh(db_activo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar: {e}")
    return db_activo

@router.delete("/{activo_id}", status_code=204)
def eliminar_activo(activo_id: str, db: Session = Depends(get_db)):
    db_activo = db.query(Activo).filter(Activo.id == activo_id).first()
    if not db_activo:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    db.delete(db_activo)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar: {e}")
    return None

# --- Endpoints Avanzados ---

def detalle_activo_html(codigo: str, request: Request):
    # Ya no se necesita el endpoint /network-info.
    # El JavaScript ahora hará una petición relativa para obtener los datos.
    # Esto es mucho más simple y robusto.
    return f"""
    <html>
    <head>
      </head>
    <body>
      <div class="container" id="asset-details">
        </div>
      <script>
        window.onload = async function() {{
          const codigoActivo = "{codigo}";
          try {{
            // ¡Petición relativa! El navegador usará el host y puerto correctos automáticamente.
            const response = await fetch(`/activos/${{codigoActivo}}`); 
            if (!response.ok) {{ throw new Error('Activo no encontrado'); }}
            const data = await response.json();
            
            // Llenar los campos con los datos
            document.getElementById('id').textContent = data.id || '';
            // ... llenar todos los demás campos ...

          }} catch (error) {{
             // ... manejo de errores ...
          }}
        }};
      </script>
    </body>
    </html>
    """

@router.post("/bulk-create", status_code=201)
def crear_o_actualizar_activos_en_lote(activos: List[ActivoCreate], request: Request, db: Session = Depends(get_db)):
    creados = 0
    actualizados = 0
    errores = []
    hostname = request.app.state.hostname
    port = request.app.state.port

    required_fields = ['correlativo', 'central_de_costos', 'area']
    for activo_data in activos:
        data = activo_data.model_dump()
        # Limpiar: solo dejar campos válidos
        data = {k: v for k, v in data.items() if k in ActivoBase.model_fields}
        # Validar campos mínimos para generar id
        if not data.get('id'):
            missing = [f for f in required_fields if not data.get(f)]
            if missing:
                errores.append(f"Faltan campos requeridos para generar id: {', '.join(missing)}")
                continue
            correlativo = data.get('correlativo', '')
            central = data.get('central_de_costos', '')
            area = data.get('area', '')
            data['id'] = f"{correlativo}{central}{area}"
        # Generar codigo_activo si no viene
        if not data.get('codigo_activo'):
            data['codigo_activo'] = f"{correlativo}-{central}-{area}"
            
        # Validar que el correlativo sea único
        if data.get('correlativo'):
            correlativo_existente = db.query(Activo).filter(Activo.correlativo == data.get('correlativo')).first()
            if correlativo_existente and correlativo_existente.id != data['id']:
                errores.append(f"Ya existe un activo con el correlativo: {data.get('correlativo')}")
                continue
                
        db_activo = db.query(Activo).filter(Activo.id == data['id']).first()
        # Validar que no exista otro activo con el mismo correlativo, central_de_costos y area (si es nuevo)
        if not db_activo and db.query(Activo).filter(
            Activo.correlativo == data.get('correlativo'),
            Activo.central_de_costos == data.get('central_de_costos'),
            Activo.area == data.get('area')
        ).first():
            errores.append(f"Ya existe un activo con correlativo={data.get('correlativo')}, central_de_costos={data.get('central_de_costos')}, area={data.get('area')}")
            continue
        # Generar url si no viene
        if not data.get('url'):
             # Usamos las variables que obtuvimos al inicio
            data['url'] = f"http://{hostname}:{port}/activos/detalle/{data['id']}"
            db_activo = db.query(Activo).filter(Activo.id == data.get('id')).first()
        if db_activo:
            for key, value in data.items():
                setattr(db_activo, key, value)
            actualizados += 1
        else:
            db_activo = Activo(**data)
            db.add(db_activo)
            creados += 1
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        errores.append(str(e))
    return {
        "creados": creados,
        "actualizados": actualizados,
        "errores": errores
    }

@router.get("/stats/", response_model=StatsResponse)
def obtener_estadisticas(db: Session = Depends(get_db)):
    total_activos = db.query(func.count(Activo.id)).scalar()
    
    query_estado = db.query(Activo.estado, func.count(Activo.estado)).group_by(Activo.estado).all()
    activos_por_estado = {estado if estado else "No definido": count for estado, count in query_estado}
    
    return {
        "total_activos": total_activos,
        "activos_por_estado": activos_por_estado
    }

@router.post("/{activo_id}/regenerate-qr", response_model=ActivoResponse)
def regenerar_y_guardar_qr(activo_id: str, db: Session = Depends(get_db)):
    db_activo = db.query(Activo).filter(Activo.id == activo_id).first()
    if not db_activo:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    try:
        db.commit()
        db.refresh(db_activo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al regenerar y guardar el QR: {e}")

    return db_activo