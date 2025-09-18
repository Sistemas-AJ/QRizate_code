from fastapi.responses import HTMLResponse
import qrcode
import base64
from io import BytesIO
from typing import List, Optional, Dict, Set

from fastapi import APIRouter, Depends, HTTPException
import socket

# --- API Router ---

router = APIRouter(
    prefix="/activos",
    tags=["Activos"]
)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = "0.0.0.0"
    finally:
        s.close()
    return IP

FIXED_PORT = 543

# --- Endpoint para exponer IP y puerto fijo ---
@router.get("/network-info", tags=["Red"])
def obtener_info_red():
    
    
    
    ip = get_local_ip()
    port = FIXED_PORT
    return {"ip": ip, "port": port}
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
def crear_activo(activo: ActivoCreate, db: Session = Depends(get_db)):
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
        # Obtener ip y puerto locales
        ip = get_local_ip()
        port = FIXED_PORT
        data['url'] = f"http://{ip}:{port}/activos/detalle/{data['id']}"
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

@router.get("/detalle/{codigo}", response_class=HTMLResponse)
def detalle_activo_html(codigo: str):
    return """
    <html>
<head>
  <meta charset=\"UTF-8\">
  <title>Detalle del Activo</title>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 40px auto; padding: 20px 30px; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
    h1 { color: #1c1e21; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .detail-grid { display: grid; grid-template-columns: 150px 1fr; gap: 15px; }
    .detail-grid strong { color: #606770; }
    .error { color: red; font-weight: bold; text-align: center; }
  </style>
</head>
<body>

  <div class=\"container\" id=\"asset-details\">
    <h1 id=\"nombre-activo\">Cargando información del activo...</h1>
    <div class=\"detail-grid\">
      <strong>Nombre Central de Costos:</strong> <span id=\"nombre_central_costos\"></span>
      <strong>ID:</strong> <span id=\"id\"></span>
      <strong>Categoría:</strong> <span id=\"categoria\"></span>
      <strong>Central de Costos:</strong> <span id=\"central_de_costos\"></span>
      <strong>Área:</strong> <span id=\"area\"></span>
      <strong>Correlativo:</strong> <span id=\"correlativo\"></span>
      <strong>Cuenta Contable:</strong> <span id=\"cuenta_contable\"></span>
      <strong>Estado:</strong> <span id=\"estado\"></span>
      <strong>Descripción:</strong> <span id=\"descripcion\"></span>
      <strong>Marca:</strong> <span id=\"marca\"></span>
      <strong>Modelo:</strong> <span id=\"modelo\"></span>
      <strong>Número de Serie:</strong> <span id=\"numero_serie\"></span>
      <strong>Código Activo:</strong> <span id=\"codigo_activo\"></span>
      <strong>Número Central Costo:</strong> <span id=\"numero_central_costo\"></span>
      <strong>Sede:</strong> <span id=\"sede\"></span>
    </div>
  </div>

  <div class=\"container\" id=\"error-message\" style=\"display:none;\">
    <p class=\"error\">No se encontró el activo o el código es inválido.</p>
  </div>

  <script>
    window.onload = async function() {
      // Usar el parámetro de la ruta como código
      const codigoActivo = window.location.pathname.split('/').pop();

      const detailsContainer = document.getElementById('asset-details');
      const errorContainer = document.getElementById('error-message');

      if (!codigoActivo) {
        detailsContainer.style.display = 'none';
        errorContainer.style.display = 'block';
        return;
      }

      try {
        // 2. Obtener ip y port dinámicamente
        const netInfoResp = await fetch('/activos/network-info');
        if (!netInfoResp.ok) throw new Error('No se pudo obtener la red');
        const netInfo = await netInfoResp.json();
        const ip = netInfo.ip;
        const port = netInfo.port;

        // 3. Consultar al backend para obtener los datos del activo (endpoint correcto)
        const response = await fetch(`http://${ip}:${port}/activos/${codigoActivo}`);
        if (!response.ok) {
          throw new Error('Activo no encontrado');
        }

        const data = await response.json();
        // Mostrar todos los campos recibidos en consola
        console.log('Datos completos del activo:', data);

        // 4. Mostrar todos los campos del modelo Activo
        document.getElementById('nombre_central_costos').textContent = data.nombre_central_costos || '';
        document.title = `Activo: ${data.descripcion || data.id}`;
        document.getElementById('nombre-activo').textContent = data.descripcion || data.id;
        document.getElementById('id').textContent = data.id || '';
        document.getElementById('categoria').textContent = data.categoria || '';
        document.getElementById('central_de_costos').textContent = data.central_de_costos || '';
        document.getElementById('area').textContent = data.area || '';
        document.getElementById('correlativo').textContent = data.correlativo || '';
        document.getElementById('cuenta_contable').textContent = data.cuenta_contable || '';
        document.getElementById('estado').textContent = data.estado || '';
        document.getElementById('descripcion').textContent = data.descripcion || '';
        document.getElementById('marca').textContent = data.marca || '';
        document.getElementById('modelo').textContent = data.modelo || '';
        document.getElementById('numero_serie').textContent = data.numero_serie || '';
        document.getElementById('codigo_activo').textContent = data.codigo_activo || '';
        document.getElementById('numero_central_costo').textContent = data.numero_central_costo || '';
        document.getElementById('sede').textContent = data.sede || '';


      } catch (error) {
        detailsContainer.style.display = 'none';
        errorContainer.style.display = 'block';
      }
    };
  </script>

</body>
</html>
"""

@router.post("/bulk-create", status_code=201)
def crear_o_actualizar_activos_en_lote(activos: List[ActivoCreate], db: Session = Depends(get_db)):
    creados = 0
    actualizados = 0
    errores = []
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
            ip = get_local_ip()
            port = FIXED_PORT
            data['url'] = f"http://{ip}:{port}/activos/detalle/{data['id']}"
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