"""
Script de migración para hacer el campo correlativo único
Ejecutar este script después de los cambios en el modelo
"""

from sqlalchemy import create_engine, text
from models.db import DATABASE_URL
import sqlite3

def migrate_correlativo_unique():
    """
    Migración para agregar restricción de unicidad al campo correlativo
    """
    try:
        # Crear conexión directa a SQLite
        conn = sqlite3.connect('QRizate.db')
        cursor = conn.cursor()
        
        print("Iniciando migración para correlativo único...")
        
        # 1. Verificar si hay correlativos duplicados
        cursor.execute("""
            SELECT correlativo, COUNT(*) 
            FROM activos 
            WHERE correlativo IS NOT NULL AND correlativo != ''
            GROUP BY correlativo 
            HAVING COUNT(*) > 1
        """)
        
        duplicados = cursor.fetchall()
        
        if duplicados:
            print(f"¡ATENCIÓN! Se encontraron {len(duplicados)} correlativos duplicados:")
            for correlativo, count in duplicados:
                print(f"  - Correlativo '{correlativo}': {count} activos")
            
            # Mostrar los activos duplicados para que el usuario decida qué hacer
            for correlativo, count in duplicados:
                cursor.execute("""
                    SELECT id, descripcion, correlativo 
                    FROM activos 
                    WHERE correlativo = ?
                """, (correlativo,))
                activos_dup = cursor.fetchall()
                print(f"\nActivos con correlativo '{correlativo}':")
                for activo in activos_dup:
                    print(f"  - ID: {activo[0]}, Descripción: {activo[1]}")
            
            print("\nPor favor, resuelve los duplicados manualmente antes de continuar.")
            print("Puedes:")
            print("1. Cambiar el correlativo de algunos activos")
            print("2. Eliminar activos duplicados")
            print("3. Fusionar la información de activos duplicados")
            
            return False
        
        # 2. Si no hay duplicados, crear una nueva tabla con la restricción
        print("No se encontraron correlativos duplicados. Aplicando migración...")
        
        # Crear tabla temporal con la nueva estructura
        cursor.execute("""
            CREATE TABLE activos_new (
                id TEXT PRIMARY KEY,
                categoria TEXT,
                central_de_costos TEXT,
                area TEXT,
                correlativo TEXT UNIQUE,
                cuenta_contable TEXT,
                estado TEXT,
                descripcion TEXT,
                marca TEXT,
                modelo TEXT,
                numero_serie TEXT,
                codigo_activo TEXT,
                numero_central_costo TEXT,
                sede TEXT,
                url TEXT
            )
        """)
        
        # Copiar datos a la nueva tabla
        cursor.execute("""
            INSERT INTO activos_new 
            SELECT * FROM activos
        """)
        
        # Eliminar tabla original y renombrar la nueva
        cursor.execute("DROP TABLE activos")
        cursor.execute("ALTER TABLE activos_new RENAME TO activos")
        
        # Crear índices
        cursor.execute("CREATE INDEX idx_activos_correlativo ON activos(correlativo)")
        cursor.execute("CREATE INDEX idx_activos_id ON activos(id)")
        
        conn.commit()
        print("✅ Migración completada exitosamente!")
        print("El campo correlativo ahora es único en la base de datos.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def verificar_correlativos_duplicados():
    """
    Función para verificar si existen correlativos duplicados
    """
    try:
        conn = sqlite3.connect('QRizate.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT correlativo, COUNT(*) 
            FROM activos 
            WHERE correlativo IS NOT NULL AND correlativo != ''
            GROUP BY correlativo 
            HAVING COUNT(*) > 1
        """)
        
        duplicados = cursor.fetchall()
        
        if duplicados:
            print(f"Se encontraron {len(duplicados)} correlativos duplicados:")
            for correlativo, count in duplicados:
                print(f"  - '{correlativo}': {count} activos")
            return False
        else:
            print("✅ No se encontraron correlativos duplicados.")
            return True
            
    except Exception as e:
        print(f"Error al verificar duplicados: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("=== MIGRACIÓN: CORRELATIVO ÚNICO ===")
    print("Este script hará que el campo 'correlativo' sea único en la base de datos.")
    print()
    
    # Primero verificar duplicados
    if verificar_correlativos_duplicados():
        # Si no hay duplicados, proceder con la migración
        migrate_correlativo_unique()
    else:
        print("\nPor favor, resuelve los correlativos duplicados antes de continuar.")
