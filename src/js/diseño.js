document.addEventListener('click', function(event) {
    const isDropdownButton = event.target.matches('.dropdown-toggle');
    const openDropdown = document.querySelector('.dropdown-menu.show');

    // Si se hace clic fuera de un menú abierto, se cierra.
    if (openDropdown && !event.target.closest('.dropdown')) {
        openDropdown.classList.remove('show');
    }

    // Si se hace clic en un botón de menú, se abre o se cierra.
    if (isDropdownButton) {
        const currentDropdown = event.target.nextElementSibling;
        // Cierra otros menús antes de abrir el nuevo
        if (openDropdown && openDropdown !== currentDropdown) {
            openDropdown.classList.remove('show');
        }
        currentDropdown.classList.toggle('show');
    }
});

// --- LÓGICA DEL BOTÓN INICIO (MODIFICADA) ---
document.addEventListener('DOMContentLoaded', function() {
    const btnInicio = document.querySelector('.btn-inicio');
    if (btnInicio) {
        // Quitamos el onclick del HTML para evitar conflictos
        btnInicio.removeAttribute('onclick');

        btnInicio.onclick = function() {
            // Comprobamos si hay cambios sin guardar (las variables vienen de qr.js)
            if (window.historyIndex !== window.savedHistoryIndex) {
                // Si hay cambios, preguntamos al usuario
                const userConfirmed = confirm("Tienes cambios sin guardar. ¿Seguro que quieres volver al inicio? Perderás tu trabajo.");
                if (userConfirmed) {
                    window.canLeavePage = true;
                    window.location.href = 'index.html';
                }
                // Si no confirma, no hacemos nada.
            } else {
                window.canLeavePage = true;
                window.location.href = 'index.html';
            }
        };
    }
});