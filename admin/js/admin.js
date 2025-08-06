// Variables globales
let categorias = [];
let productos = [];
let productoActual = null;

// Inicialización cuando el documento esté listo
$(document).ready(function() {
    // Verificar autenticación
    verificarAutenticacion();
    
    // Cargar datos iniciales
    cargarCategorias();
    cargarProductos();
    
    // Configurar eventos
    configurarEventos();
});

// Función para verificar autenticación
function verificarAutenticacion() {
    // Aquí iría la lógica para verificar si el usuario está autenticado
    // Por ahora, asumimos que el usuario está autenticado
}

// Función para configurar eventos
function configurarEventos() {
    // Navegación
    $('#dashboard-link').on('click', function(e) {
        e.preventDefault();
        mostrarSeccion('dashboard');
    });
    
    $('#productos-link, #ver-productos-link').on('click', function(e) {
        e.preventDefault();
        mostrarSeccion('productos');
    });
    
    $('#categorias-link, #ver-categorias-link').on('click', function(e) {
        e.preventDefault();
        mostrarSeccion('categorias');
    });
    
    $('#pedidos-link, #ver-pedidos-link').on('click', function(e) {
        e.preventDefault();
        mostrarSeccion('pedidos');
    });
    
    $('#configuracion-link').on('click', function(e) {
        e.preventDefault();
        mostrarSeccion('configuracion');
    });
    
    // Botón nuevo producto
    $('#btn-nuevo-producto').on('click', function() {
        nuevoProducto();
    });
    
    // Botón volver
    $('#btn-volver').on('click', function() {
        mostrarSeccion('productos');
    });
    
    // Botón cancelar
    $('#btn-cancelar').on('click', function() {
        mostrarSeccion('productos');
    });
    
    // Subida de imagen
    $('#imagen').on('change', function(e) {
        subirImagen(e);
    });
    
    // Envío del formulario
    $('#producto-form').on('submit', function(e) {
        e.preventDefault();
        guardarProducto();
    });
    
    // Confirmación de eliminación
    $('#confirm-delete').on('click', function() {
        if (productoActual) {
            eliminarProducto(productoActual);
            $('#confirmModal').modal('hide');
        }
    });
}

// Función para mostrar una sección específica
function mostrarSeccion(seccion) {
    // Ocultar todas las secciones
    $('#dashboard-content, #productos-content, #categorias-content, #pedidos-content, #configuracion-content, #formulario-producto').hide();
    
    // Mostrar la sección correspondiente
    switch(seccion) {
        case 'dashboard':
            $('#dashboard-content').show();
            actualizarEstadisticas();
            break;
        case 'productos':
            $('#productos-content').show();
            break;
        case 'categorias':
            $('#categorias-content').show();
            break;
        case 'pedidos':
            $('#pedidos-content').show();
            break;
        case 'configuracion':
            $('#configuracion-content').show();
            break;
        case 'formulario-producto':
            $('#formulario-producto').show();
            break;
    }
    
    // Actualizar navegación activa
    $('.nav-link').removeClass('active');
    $('#' + seccion + '-link').addClass('active');
}

// Función para cargar las categorías
function cargarCategorias() {
    $.ajax({
        url: '../api/categorias.php',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            categorias = response;
            actualizarSelectCategorias();
        },
        error: function(xhr, status, error) {
            console.error('Error al cargar categorías:', error);
            mostrarError('No se pudieron cargar las categorías');
        }
    });
}

// Función para actualizar el select de categorías
function actualizarSelectCategorias() {
    const $select = $('#categoria');
    $select.empty().append('<option value="">Seleccione una categoría</option>');
    
    categorias.forEach(function(categoria) {
        $select.append(`<option value="${categoria.id}">${categoria.nombre}</option>`);
    });
}

// Función para cargar los productos
function cargarProductos() {
    $.ajax({
        url: '../api/productos.php',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            productos = response;
            actualizarTablaProductos();
            actualizarEstadisticas();
        },
        error: function(xhr, status, error) {
            console.error('Error al cargar productos:', error);
            mostrarError('No se pudieron cargar los productos');
        }
    });
}

// Función para actualizar la tabla de productos
function actualizarTablaProductos() {
    const $tbody = $('#productos-body');
    $tbody.empty();
    
    if (productos.length === 0) {
        $tbody.append('<tr><td colspan="7" class="text-center">No hay productos registrados</td></tr>');
        return;
    }
    
    productos.forEach(function(producto) {
        const categoria = categorias.find(c => c.id == producto.categoria_id) || { nombre: 'Sin categoría' };
        const precioAnterior = producto.precio_anterior ? 
            `<del class="text-muted">$${parseFloat(producto.precio_anterior).toLocaleString()}</del><br>` : '';
        
        $tbody.append(`
            <tr>
                <td>${producto.id}</td>
                <td>
                    <img src="../frontend/assets/img/imagen/${producto.imagen_url}" alt="${producto.nombre}" class="img-thumbnail product-image">
                </td>
                <td>${producto.nombre}</td>
                <td>${categoria.nombre}</td>
                <td>
                    ${precioAnterior}
                    <strong>$${parseFloat(producto.precio).toLocaleString()}</strong>
                </td>
                <td>${producto.stock}</td>
                <td>
                    <button class="btn btn-sm btn-primary btn-editar" data-id="${producto.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-eliminar" data-id="${producto.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `);
    });
    
    // Configurar eventos de los botones
    $('.btn-editar').on('click', function() {
        const id = $(this).data('id');
        editarProducto(id);
    });
    
    $('.btn-eliminar').on('click', function() {
        const id = $(this).data('id');
        confirmarEliminacion(id);
    });
}

// Función para actualizar las estadísticas del dashboard
function actualizarEstadisticas() {
    $('#total-productos').text(productos.length);
    $('#total-categorias').text(categorias.length);
    // Aquí podrías cargar el total de pedidos cuando implementes esa funcionalidad
}

// Función para preparar el formulario para un nuevo producto
function nuevoProducto() {
    // Limpiar el formulario
    $('#producto-form')[0].reset();
    $('#producto-id').val('');
    $('#imagen-preview').hide();
    $('#imagen-url').val('');
    $('#titulo-formulario').text('Nuevo Producto');
    
    // Mostrar el formulario
    mostrarSeccion('formulario-producto');
}

// Función para cargar un producto en el formulario para edición
function editarProducto(id) {
    const producto = productos.find(p => p.id == id);
    
    if (!producto) {
        mostrarError('Producto no encontrado');
        return;
    }
    
    // Llenar el formulario con los datos del producto
    $('#producto-id').val(producto.id);
    $('#nombre').val(producto.nombre);
    $('#categoria').val(producto.categoria_id);
    $('#precio').val(producto.precio);
    $('#precio-anterior').val(producto.precio_anterior || '');
    $('#stock').val(producto.stock);
    $('#descripcion').val(producto.descripcion || '');
    $('#destacado').prop('checked', producto.destacado);
    
    // Mostrar la imagen actual si existe
    if (producto.imagen_url) {
        $('#imagen-url').val(producto.imagen_url);
        $('#imagen-preview')
            .attr('src', `../frontend/assets/img/imagen/${producto.imagen_url}`)
            .show();
    } else {
        $('#imagen-preview').hide();
    }
    
    // Actualizar el título del formulario
    $('#titulo-formulario').text('Editar Producto');
    
    // Mostrar el formulario
    mostrarSeccion('formulario-producto');
}

// Función para subir una imagen
function subirImagen(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    // Validar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif'];
    if (!tiposPermitidos.includes(file.type)) {
        mostrarError('Solo se permiten archivos de imagen (JPEG, PNG, GIF)');
        return;
    }
    
    // Mostrar barra de progreso
    const $progressBar = $('#progress-bar');
    const $progressContainer = $('#progress-bar-container');
    const $uploadStatus = $('#upload-status');
    
    $progressContainer.show();
    $uploadStatus.html('Subiendo imagen...');
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('imagen', file);
    
    // Configurar AJAX para subir la imagen
    $.ajax({
        url: '../api/productos.php',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        xhr: function() {
            const xhr = new window.XMLHttpRequest();
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    $progressBar.css('width', percentComplete + '%');
                }
            }, false);
            return xhr;
        },
        success: function(response) {
            if (response.success) {
                // Actualizar la vista previa de la imagen
                $('#imagen-preview')
                    .attr('src', `../frontend/assets/img/imagen/${response.filename}`)
                    .show();
                
                // Guardar el nombre del archivo en un campo oculto
                $('#imagen-url').val(response.filename);
                
                $uploadStatus.html('<span class="text-success">Imagen subida correctamente</span>');
            } else {
                $uploadStatus.html(`<span class="text-danger">${response.message || 'Error al subir la imagen'}</span>`);
            }
        },
        error: function(xhr, status, error) {
            console.error('Error al subir la imagen:', error);
            $uploadStatus.html('<span class="text-danger">Error al subir la imagen</span>');
        },
        complete: function() {
            // Ocultar la barra de progreso después de un tiempo
            setTimeout(function() {
                $progressContainer.hide();
                $progressBar.css('width', '0%');
            }, 1500);
        }
    });
}

// Función para guardar un producto (crear o actualizar)
function guardarProducto() {
    const id = $('#producto-id').val();
    const esNuevo = !id;
    
    // Validar que se haya subido una imagen para productos nuevos
    const imagenUrl = $('#imagen-url').val();
    if (esNuevo && !imagenUrl) {
        mostrarError('Por favor, suba una imagen para el producto');
        return;
    }
    
    // Obtener los datos del formulario
    const producto = {
        categoria_id: $('#categoria').val(),
        nombre: $('#nombre').val(),
        descripcion: $('#descripcion').val(),
        precio: parseFloat($('#precio').val()),
        precio_anterior: $('#precio-anterior').val() ? parseFloat($('#precio-anterior').val()) : null,
        imagen_url: imagenUrl,
        destacado: $('#destacado').is(':checked'),
        stock: parseInt($('#stock').val())
    };
    
    // Validaciones básicas
    if (!producto.nombre || !producto.categoria_id || isNaN(producto.precio) || isNaN(producto.stock)) {
        mostrarError('Por favor complete todos los campos requeridos');
        return;
    }
    
    // Mostrar indicador de carga
    const $btnGuardar = $('#btn-guardar');
    const btnOriginalText = $btnGuardar.html();
    $btnGuardar.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...');
    
    // Determinar la URL y el método según si es nuevo o edición
    const url = `../api/productos.php${!esNuevo ? `?id=${id}` : ''}`;
    const method = esNuevo ? 'POST' : 'PUT';
    
    // Enviar la solicitud al servidor
    $.ajax({
        url: url,
        type: method,
        contentType: 'application/json',
        data: JSON.stringify(producto),
        success: function(response) {
            if (response.success) {
                mostrarExito(esNuevo ? 'Producto creado correctamente' : 'Producto actualizado correctamente');
                // Recargar la lista de productos
                cargarProductos();
                // Volver a la lista de productos
                mostrarSeccion('productos');
            } else {
                mostrarError(response.message || 'Error al guardar el producto');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error al guardar el producto:', error);
            mostrarError('Error al guardar el producto. Por favor, intente de nuevo.');
        },
        complete: function() {
            // Restaurar el botón
            $btnGuardar.prop('disabled', false).html(btnOriginalText);
        }
    });
}

// Función para confirmar la eliminación de un producto
function confirmarEliminacion(id) {
    productoActual = id;
    $('#confirmModal').modal('show');
}

// Función para eliminar un producto
function eliminarProducto(id) {
    $.ajax({
        url: `../api/productos.php?id=${id}`,
        type: 'DELETE',
        success: function(response) {
            if (response.success) {
                mostrarExito('Producto eliminado correctamente');
                // Recargar la lista de productos
                cargarProductos();
            } else {
                mostrarError(response.message || 'Error al eliminar el producto');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error al eliminar el producto:', error);
            mostrarError('Error al eliminar el producto. Por favor, intente de nuevo.');
        }
    });
}

// Funciones de utilidad para mostrar mensajes
function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: '¡Éxito!',
        text: mensaje,
        timer: 3000,
        showConfirmButton: false
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        timer: 5000
    });
}

function mostrarConfirmacion(mensaje, callback) {
    Swal.fire({
        title: '¿Está seguro?',
        text: mensaje,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            callback();
        }
    });
}
