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