async function generateQR() {
    // Usar el div fijo para el QR
    let qrcodecontainer = document.getElementById('qrcode');
    if (!qrcodecontainer) {
        // Si no existe, créalo y agrégalo al DOM (esto no debería pasar)
        qrcodecontainer = document.createElement('div');
        qrcodecontainer.id = 'qrcode';
        document.body.appendChild(qrcodecontainer);
    }
    // Limpiar el contenido antes de mostrar el nuevo QR
    qrcodecontainer.innerHTML = '';

    const categoria = document.getElementById("categoria").value.trim();
    const central_de_costos = document.getElementById("central_de_costos").value.trim();
    const nombre_central_costos = document.getElementById("nombre_central_costos").value.trim();
    const area = document.getElementById("area").value.trim();
    const correlativo = document.getElementById("correlativo").value.trim();
    const cuenta_contable = document.getElementById("cuenta_contable").value.trim();
    const estado = document.getElementById("estado").value.trim();
    const descripcion = document.getElementById("descripcion").value.trim();
    const marca = document.getElementById("marca").value.trim();
    const modelo = document.getElementById("modelo").value.trim();
    const numero_serie = document.getElementById("numero_serie").value.trim();
    const sede = document.getElementById("sede").value.trim();

    if (!correlativo || !sede || !area) {
        alert("Correlativo, Sede y Área son obligatorios.");
        return;
    }

    // Generar automáticamente el código y colocarlo en el input correspondiente
    const codigo = correlativo + '-' + sede + '-' + area;
    const id = correlativo + sede + area;
    const codigoInput = document.getElementById("codigo");
    if (codigoInput) {
        codigoInput.value = codigo;
    }

    // Configuración manual de IP y puerto
    let ip = document.getElementById('manual_ip').value.trim() || 'localhost';
    let port = document.getElementById('manual_port').value.trim() || '543';
    
    // Guardar los valores en localStorage para mantenerlos
    localStorage.setItem('qr_app_ip', ip);
    localStorage.setItem('qr_app_port', port);

    const qrtext = `https://qrizate.systempiura.com/activo?sede=${sede}&id=${id}`;
    const url = qrtext;

    // Usar QRious para generar el QR
    try {
        const codeDiv = document.createElement('div');
        codeDiv.style.fontWeight = 'bold';
        codeDiv.style.marginBottom = '5px';
        codeDiv.textContent = 'Código QR generado: ' + id;
        qrcodecontainer.appendChild(codeDiv);

        // Crear un elemento canvas para el QR
        const canvas = document.createElement('canvas');
        qrcodecontainer.appendChild(canvas);
        
        const qr = new QRious({
            element: canvas,
            value: qrtext,
            size: 230,
            background: 'white',
            foreground: 'black',
            level: 'H'
        });

        // Agregar la URL debajo del QR
        const urlDiv = document.createElement('div');
        urlDiv.style.marginTop = '10px';
        urlDiv.style.wordBreak = 'break-all';
        urlDiv.textContent = 'URL: ' + qrtext;
        qrcodecontainer.appendChild(urlDiv);
    } catch (error) {
        console.error('Error al generar QR:', error);
        qrcodecontainer.innerHTML = '<div style="color: red;">Error al generar el código QR: ' + error.message + '</div>';
        return;
    }

    (async function(){
        try {
            const response = await fetch(`http://${ip}:${port}/activos/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id,
                    categoria,
                    central_de_costos,
                    nombre_central_costos,
                    area,
                    correlativo,
                    cuenta_contable,
                    estado,
                    descripcion,
                    marca,
                    modelo,
                    numero_serie,
                    codigo_activo: codigo,
                    sede,
                    url
                })
            });
            let msgDiv = document.createElement('div');
            msgDiv.style.marginTop = '10px';
            let data = {};
            try {
                data = await response.json();
            } catch (e) {}
            if(response.ok){
                msgDiv.style.color = 'green';
                msgDiv.textContent = 'Activo guardado correctamente en la base de datos.';
            } else {
                msgDiv.style.color = 'red';
                msgDiv.textContent = 'Error al guardar el activo en la base de datos: ' + (data.detail || response.statusText);
            }
            qrcodecontainer.appendChild(msgDiv);
        } catch(err) {
            let msgDiv = document.createElement('div');
            msgDiv.style.color = 'red';
            msgDiv.style.marginTop = '10px';
            msgDiv.textContent = 'Error al enviar los datos al servidor: ' + err.message;
            qrcodecontainer.appendChild(msgDiv);
        }
    })();
}


