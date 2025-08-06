// component-loader.js
document.addEventListener('DOMContentLoaded', function() {
    loadComponent('header-container', 'frontend/components/header.html');
    loadComponent('navbar-container', 'frontend/components/navbar.html');
});

async function loadComponent(containerId, componentPath) {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = html;
            
            // Si es el navbar, inicializar la función de navegación
            if (containerId === 'navbar-container') {
                initializeNavigation();
            }
            
            // Si es el header, inicializar dropdowns de Bootstrap
            if (containerId === 'header-container') {
                initializeHeader();
            }
        }
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
        // Fallback: mostrar mensaje de error o contenido alternativo
    }
}

function initializeNavigation() {
    // Función para manejar la navegación
    window.navigateTo = function(path) {
        // Obtener la URL base actual
        const currentPath = window.location.pathname;
        const basePath = currentPath.includes('/frontend/') ? '../..' : '.';
        
        // Construir la URL completa
        const fullPath = basePath + path;
        window.location.href = fullPath;
    };
    
    // Marcar el enlace activo basado en la URL actual
    setActiveNavLink();
}

function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        link.style.backgroundColor = '';
    });
    
    // Determinar qué enlace debe estar activo
    if (currentPath.includes('dulceria.html')) {
        document.getElementById('nav-dulceria')?.classList.add('active');
    } else if (currentPath.includes('galleteria.html')) {
        document.getElementById('nav-galleteria')?.classList.add('active');
    } else if (currentPath.includes('chocolates.html')) {
        document.getElementById('nav-chocolates')?.classList.add('active');
    } else if (currentPath.includes('contacto.html')) {
        document.getElementById('nav-contacto')?.classList.add('active');
    } else {
        document.getElementById('nav-inicio')?.classList.add('active');
    }
    
    // Aplicar estilo al enlace activo
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        activeLink.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    }
}

function initializeHeader() {
    // Inicializar dropdowns de Bootstrap
    const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    const dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });
    
    // Función para cerrar sesión
    window.cerrarSesion = function() {
        localStorage.removeItem('user');
        sessionStorage.clear();
        window.location.href = '/index.html';
    };
}