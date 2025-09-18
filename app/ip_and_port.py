import socket
import tkinter as tk
from tkinter import ttk, messagebox 
import webbrowser

def get_local_ip():
    """
    Intenta obtener la dirección IP local de la máquina.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = "127.0.0.1"  
    finally:
        s.close()
    return IP

def check_port_status(desired_port):
    """
    Verifica el estado del puerto especificado.
    Retorna un diccionario con 'available' (bool) y 'message' (str).
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("", desired_port)) 
        s.close() 
        return {"available": True, "message": "Disponible"}
    except OSError as e:
        # El puerto está en uso, probablemente por nuestro servidor
        if "10048" in str(e) or "Address already in use" in str(e):
            return {"available": False, "message": "En uso por el servidor"}
        else:
            return {"available": False, "message": f"Error: {e}"}
    finally:
        s.close() 

def copy_to_clipboard(text, root):
    """
    Copia texto al portapapeles y muestra una notificación
    """
    root.clipboard_clear()
    root.clipboard_append(text)
    messagebox.showinfo("📋 Copiado", f"'{text}' copiado al portapapeles")

def open_web_interface(ip, port):
    """
    Abre la interfaz web en el navegador predeterminado
    """
    url = f"http://{ip}:{port}"
    try:
        webbrowser.open(url)
        messagebox.showinfo("🌐 Navegador", f"Abriendo {url} en tu navegador...")
    except Exception as e:
        messagebox.showerror("❌ Error", f"No se pudo abrir el navegador: {e}")

FIXED_PORT = 543  # Puerto fijo para verificar

def show_network_info_fixed_port():
    """
    Crea y muestra la ventana de información de red con diseño UPAO mejorado
    """
    # Crear la ventana principal
    root = tk.Tk()
    root.title("QRizate - Información de Red")
    root.geometry("650x550")
    root.resizable(False, False)
    
    # Colores UPAO mejorados
    upao_blue = "#003B67"
    upao_orange = "#FF6B00"
    upao_light_blue = "#E5EEF4"
    upao_dark_blue = "#002A4A"
    background_color = "#f8fafc"
    card_background = "#ffffff"
    
    # Configurar el color de fondo de la ventana
    root.configure(bg=background_color)

    # Configurar estilos con colores UPAO
    style = ttk.Style()
    
    # Configurar tema
    style.theme_use('clam')
    
    # Frame principal
    style.configure("Main.TFrame", 
                   background=card_background,
                   relief="flat",
                   borderwidth=0)
    
    # Card estilo
    style.configure("Card.TFrame",
                   background=card_background,
                   relief="solid",
                   borderwidth=1,
                   bordercolor="#e2e8f0")
    
    # Labels principales
    style.configure("Title.TLabel", 
                   background=card_background,
                   foreground=upao_blue,
                   font=("Segoe UI", 18, "bold"))
    
    style.configure("Info.TLabel", 
                   background=card_background,
                   foreground="#334155",
                   font=("Segoe UI", 11))
    
    style.configure("Value.TLabel", 
                   background=card_background,
                   foreground=upao_blue,
                   font=("Segoe UI", 12, "bold"))
    
    # Botón principal estilo UPAO mejorado
    style.configure("Primary.TButton",
                   background=upao_blue,
                   foreground="white",
                   font=("Segoe UI", 11, "bold"),
                   padding=(25, 12),
                   relief="flat",
                   borderwidth=0,
                   focuscolor="none")
    
    style.map("Primary.TButton",
             background=[('active', upao_dark_blue),
                        ('pressed', upao_dark_blue)])
    
    # Botón secundario estilo mejorado
    style.configure("Secondary.TButton",
                   background="#f1f5f9",
                   foreground=upao_blue,
                   font=("Segoe UI", 10, "bold"),
                   padding=(20, 10),
                   relief="flat",
                   borderwidth=1,
                   focuscolor="none")
    
    style.map("Secondary.TButton",
             background=[('active', upao_light_blue),
                        ('pressed', "#cbd5e1")],
             foreground=[('active', upao_dark_blue)])

    # Container principal
    container = tk.Frame(root, bg=background_color)
    container.pack(fill="both", expand=True, padx=25, pady=25)
    
    # Card principal
    main_card = ttk.Frame(container, style="Card.TFrame", padding="30 25 30 25")
    main_card.pack(fill="both", expand=True)
    
    # Header con título
    header_frame = ttk.Frame(main_card, style="Main.TFrame")
    header_frame.pack(fill="x", pady=(0, 20))
    
    title_label = ttk.Label(header_frame, 
                           text="🌐 Información de Red",
                           style="Title.TLabel")
    title_label.pack()
    
# Primer Label con un nombre de variable único
    subtitle_label = ttk.Label(header_frame,
                               text="QRizate - Sistema de Gestión de Activos",
                               style="Info.TLabel")
    subtitle_label.pack(pady=(5, 0)) # Coloca el primer Label

    # Segundo Label con un nombre de variable único
    developer_label = ttk.Label(header_frame,
                                text="Desarrollador: Adrian Ruiz Carreño",
                                style="Info.TLabel")
    developer_label.pack(pady=(0, 5)) # Coloca el segundo Label
    
    # Separador
    separator = ttk.Separator(main_card, orient="horizontal")
    separator.pack(fill="x", pady=(20, 25))
    
    # Contenido principal
    content_frame = ttk.Frame(main_card, style="Main.TFrame")
    content_frame.pack(fill="x", pady=(0, 20))

    # IP Information Card
    ip_card = tk.Frame(content_frame, bg="#f8fafc", relief="solid", bd=1)
    ip_card.pack(fill="x", pady=(0, 12))
    
    ip_inner = tk.Frame(ip_card, bg="#f8fafc")
    ip_inner.pack(fill="x", padx=15, pady=12)
    
    ip_title = tk.Label(ip_inner, text="🖥️ Dirección IP Local", 
                       bg="#f8fafc", fg=upao_blue, 
                       font=("Segoe UI", 11, "bold"))
    ip_title.pack(anchor="w")
    
    ip_label = tk.Label(ip_inner, text="Verificando...", 
                       bg="#f8fafc", fg="#64748b",
                       font=("Segoe UI", 11))
    ip_label.pack(anchor="w", pady=(4, 0))

    # Port Information Card
    port_card = tk.Frame(content_frame, bg="#f8fafc", relief="solid", bd=1)
    port_card.pack(fill="x", pady=(0, 0))
    
    port_inner = tk.Frame(port_card, bg="#f8fafc")
    port_inner.pack(fill="x", padx=15, pady=12)
    
    port_title = tk.Label(port_inner, text="🔌 Estado del Puerto", 
                         bg="#f8fafc", fg=upao_blue,
                         font=("Segoe UI", 11, "bold"))
    port_title.pack(anchor="w")
    
    port_label = tk.Label(port_inner, text=f"Puerto {FIXED_PORT}: Verificando...", 
                         bg="#f8fafc", fg="#64748b",
                         font=("Segoe UI", 11))
    port_label.pack(anchor="w", pady=(4, 0))

    def actualizar_info():
        """Función interna para actualizar la información con mejor UX"""
        # Mostrar mensaje de carga
        ip_label.config(text="🔄 Obteniendo IP local...", fg="#64748b")
        port_label.config(text="🔄 Verificando puerto...", fg="#64748b")
        root.update()
        
        # Obtener IP
        ip = get_local_ip()
        ip_label.config(text=f"{ip}", fg=upao_blue, font=("Segoe UI", 12, "bold"))

        # Verificar puerto
        port_status = check_port_status(FIXED_PORT)
        
        # Actualizar información con iconos y colores
        if not port_status['available'] and "servidor" in port_status['message']:
            port_label.config(text=f"Puerto {FIXED_PORT}: ✅ Servidor activo", 
                             fg="#10b981", font=("Segoe UI", 11, "bold"))
            port_card.config(bg="#ecfdf5", relief="solid", bd=2)
            port_inner.config(bg="#ecfdf5")
            port_title.config(bg="#ecfdf5")
            port_label.config(bg="#ecfdf5")
        elif port_status['available']:
            port_label.config(text=f"Puerto {FIXED_PORT}: ⚠️ Disponible (servidor no iniciado)", 
                             fg=upao_orange, font=("Segoe UI", 11, "bold"))
            port_card.config(bg="#fff7ed", relief="solid", bd=2)
            port_inner.config(bg="#fff7ed")
            port_title.config(bg="#fff7ed")
            port_label.config(bg="#fff7ed")
        else:
            port_label.config(text=f"Puerto {FIXED_PORT}: ❌ Error en la verificación", 
                             fg="#ef4444", font=("Segoe UI", 11, "bold"))
            port_card.config(bg="#fef2f2", relief="solid", bd=2)
            port_inner.config(bg="#fef2f2")
            port_title.config(bg="#fef2f2")
            port_label.config(bg="#fef2f2")

    # Botones
    button_frame = ttk.Frame(main_card, style="Main.TFrame")
    button_frame.pack(fill="x", pady=(20, 15))

    # Botón principal
    refresh_button = ttk.Button(button_frame, 
                               text="🔄 Actualizar Información",
                               style="Primary.TButton",
                               command=actualizar_info)
    refresh_button.pack(pady=(0, 12))
    
    # Frame para botones secundarios
    secondary_buttons = ttk.Frame(button_frame, style="Main.TFrame")
    secondary_buttons.pack()
    
    # Botón para copiar IP
    copy_ip_button = ttk.Button(secondary_buttons,
                               text="📋 Copiar IP",
                               style="Secondary.TButton",
                               command=lambda: copy_to_clipboard(get_local_ip(), root))
    copy_ip_button.pack(side="left", padx=(0, 12))
    
    # Botón para abrir interfaz web
    web_button = ttk.Button(secondary_buttons,
                           text="🌐 Abrir Web",
                           style="Secondary.TButton",
                           command=lambda: open_web_interface(get_local_ip(), FIXED_PORT))
    web_button.pack(side="left")
    
    # Footer
    footer_frame = ttk.Frame(main_card, style="Main.TFrame")
    footer_frame.pack(fill="x", pady=(15, 0))
    
    footer_separator = ttk.Separator(footer_frame, orient="horizontal")
    footer_separator.pack(fill="x", pady=(0, 12))
    
    help_label = ttk.Label(footer_frame,
                          text="💡 El servidor debe estar ejecutándose para acceder a la interfaz web",
                          style="Info.TLabel")
    help_label.pack()
    
    version_label = ttk.Label(footer_frame,
                             text="QRizate v1.0 - Universidad Privada Antenor Orrego",
                             style="Info.TLabel")
    version_label.pack(pady=(6, 0))

    # Ejecutar la verificación inicial automáticamente
    root.after(800, actualizar_info)

    # Centrar la ventana en la pantalla
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f"{width}x{height}+{x}+{y}")

    # Iniciar el loop principal de la GUI
    root.mainloop()
