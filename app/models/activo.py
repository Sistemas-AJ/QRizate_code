from sqlalchemy import Column, String, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Activo(Base):
    __tablename__ = 'activos'
    id = Column(String(30), primary_key=True, index=True)
    categoria = Column(Text, nullable=True)
    central_de_costos = Column(Text, nullable=True)
    nombre_central_costos = Column(Text, nullable=True)  # <-- AGREGADO
    area = Column(Text, nullable=True)
    correlativo = Column(Text, nullable=True, unique=True, index=True)
    cuenta_contable = Column(Text, nullable=True)
    estado = Column(Text, nullable=True)
    descripcion = Column(Text, nullable=True)
    marca = Column(Text, nullable=True)
    modelo = Column(Text, nullable=True)
    numero_serie = Column(Text, nullable=True)
    codigo_activo = Column(Text, nullable=True)
    numero_central_costo = Column(Text, nullable=True)
    sede = Column(Text, nullable=True)
    url = Column(Text, nullable=True)