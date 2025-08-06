// =====================================================
// SISTEMA DE CARRITO DE COMPRAS - DISTRIBUIDORA LA VICTORIA
// Archivo: shopping-cart.js
// =====================================================

class ShoppingCart {
    constructor() {
        this.cart = [];
        this.isLoading = false;
        this.cartCount = 0;
        this.cartTotal = 0;
        this.init();
    }

    async init() {
        try {
            // Cargar carrito del usuario desde la base de datos
            await this.loadCartFromDB();
            
            // Actualizar UI
            this.updateCartUI();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            console.log('🛒 Sistema de carrito inicializado');
        } catch (error) {
            console.error('Error inicializando carrito:', error);
        }
    }

    // Verificar si el usuario está logueado
    isUserLoggedIn() {
        try {
            if (window.authManager && window.authManager.isAuthenticated) {
                return window.authManager.isAuthenticated();
            }
            return false;
        } catch (error) {
            console.log('No se pudo verificar autenticación:', error);
            return false;
        }
    }

    // Cargar carrito desde la base de datos
    async loadCartFromDB() {
        if (!this.isUserLoggedIn()) {
            this.cart = [];
            return;
        }

        try {
            const { data: cartItems, error } = await supabase
                .from('cart')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        price,
                        image_url,
                        stock,
                        unit,
                        active
                    )
                `)
                .eq('user_id', (await supabase.auth.getUser()).data.user.id);

            if (error) throw error;

            this.cart = cartItems?.map(item => ({
                id: item.product_id,
                name: item.products.name,
                price: parseFloat(item.products.price),
                image: item.products.image_url,
                quantity: item.quantity,
                stock: item.products.stock,
                unit: item.products.unit || 'UND',
                active: item.products.active
            })) || [];

            this.calculateTotals();

        } catch (error) {
            console.error('Error cargando carrito:', error);
            this.cart = [];
        }
    }

    // Agregar producto al carrito
    async addToCart(productId, productName, productPrice, productImage, quantity = 1) {
        if (!this.isUserLoggedIn()) {
            this.showLoginAlert();
            return false;
        }

        try {
            this.setLoading(true);

            // Verificar stock del producto
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('stock, active, name, price, image_url, unit')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                throw new Error('Producto no encontrado');
            }

            if (!product.active) {
                throw new Error('Producto no disponible');
            }

            // Verificar stock disponible
            const existingItem = this.cart.find(item => item.id === productId);
            const currentQuantity = existingItem ? existingItem.quantity : 0;
            const newTotalQuantity = currentQuantity + quantity;

            if (newTotalQuantity > product.stock) {
                throw new Error(`Stock insuficiente. Disponible: ${product.stock} ${product.unit || 'UND'}`);
            }

            // Agregar o actualizar en la base de datos
            const { data, error } = await supabase
                .from('cart')
                .upsert({
                    user_id: (await supabase.auth.getUser()).data.user.id,
                    product_id: productId,
                    quantity: newTotalQuantity
                }, {
                    onConflict: 'user_id,product_id'
                });

            if (error) throw error;

            // Actualizar carrito local
            if (existingItem) {
                existingItem.quantity = newTotalQuantity;
            } else {
                this.cart.push({
                    id: productId,
                    name: product.name,
                    price: parseFloat(product.price),
                    image: product.image_url,
                    quantity: quantity,
                    stock: product.stock,
                    unit: product.unit || 'UND',
                    active: product.active
                });
            }

            this.calculateTotals();
            this.updateCartUI();
            this.showNotification(`${productName} agregado al carrito`, 'success');
            
            return true;

        } catch (error) {
            console.error('Error agregando al carrito:', error);
            this.showNotification(error.message, 'error');
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    // Actualizar cantidad de un producto
    async updateQuantity(productId, newQuantity) {
        if (!this.isUserLoggedIn()) return false;

        try {
            this.setLoading(true);

            if (newQuantity <= 0) {
                return await this.removeFromCart(productId);
            }

            // Verificar stock
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('stock, name')
                .eq('id', productId)
                .single();

            if (productError) throw productError;

            if (newQuantity > product.stock) {
                throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
            }

            // Actualizar en la base de datos
            const { error } = await supabase
                .from('cart')
                .update({ quantity: newQuantity })
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .eq('product_id', productId);

            if (error) throw error;

            // Actualizar carrito local
            const item = this.cart.find(item => item.id === productId);
            if (item) {
                item.quantity = newQuantity;
            }

            this.calculateTotals();
            this.updateCartUI();
            
            return true;

        } catch (error) {
            console.error('Error actualizando cantidad:', error);
            this.showNotification(error.message, 'error');
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    // Remover producto del carrito
    async removeFromCart(productId) {
        if (!this.isUserLoggedIn()) return false;

        try {
            this.setLoading(true);

            // Remover de la base de datos
            const { error } = await supabase
                .from('cart')
                .delete()
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .eq('product_id', productId);

            if (error) throw error;

            // Remover del carrito local
            this.cart = this.cart.filter(item => item.id !== productId);

            this.calculateTotals();
            this.updateCartUI();
            this.showNotification('Producto removido del carrito', 'success');
            
            return true;

        } catch (error) {
            console.error('Error removiendo del carrito:', error);
            this.showNotification(error.message, 'error');
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    // Vaciar carrito completo
    async clearCart() {
        if (!this.isUserLoggedIn()) return false;

        if (!confirm('¿Estás seguro de que quieres vaciar el carrito?')) return false;

        try {
            this.setLoading(true);

            // Vaciar carrito en la base de datos
            const { error } = await supabase
                .from('cart')
                .delete()
                .eq('user_id', (await supabase.auth.getUser()).data.user.id);

            if (error) throw error;

            this.cart = [];
            this.calculateTotals();
            this.updateCartUI();
            this.showNotification('Carrito vaciado', 'success');
            
            return true;

        } catch (error) {
            console.error('Error vaciando carrito:', error);
            this.showNotification(error.message, 'error');
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    // Procesar compra (crear pedido)
    async checkout(shippingData) {
        if (!this.isUserLoggedIn()) {
            this.showLoginAlert();
            return false;
        }

        if (this.cart.length === 0) {
            this.showNotification('El carrito está vacío', 'error');
            return false;
        }

        try {
            this.setLoading(true);

            const user = (await supabase.auth.getUser()).data.user;

            // Crear el pedido
            const orderData = {
                user_id: user.id,
                total_amount: this.cartTotal,
                shipping_address: shippingData.address,
                phone: shippingData.phone,
                notes: shippingData.notes || null,
                status: 'pending'
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // Crear los items del pedido
            const orderItems = this.cart.map(item => ({
                order_id: order.id,
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Vaciar carrito después de compra exitosa
            await this.clearCart();

            this.showNotification('¡Pedido realizado exitosamente!', 'success');
            
            // Redirigir a página de confirmación o pedidos
            setTimeout(() => {
                window.location.href = '/pedidos.html';
            }, 2000);

            return {
                success: true,
                orderNumber: order.order_number,
                orderId: order.id
            };

        } catch (error) {
            console.error('Error procesando compra:', error);
            this.showNotification('Error al procesar la compra: ' + error.message, 'error');
            return { success: false, error: error.message };
        } finally {
            this.setLoading(false);
        }
    }

    // Calcular totales
    calculateTotals() {
        this.cartCount = this.cart.reduce((total, item) => total + item.quantity, 0);
        this.cartTotal = this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Actualizar UI del carrito
    updateCartUI() {
        // Actualizar contador en el header
        const cartBadge = document.getElementById('cart-badge');
        if (cartBadge) {
            cartBadge.textContent = this.cartCount;
            cartBadge.style.display = this.cartCount > 0 ? 'inline' : 'none';
        }

        // Actualizar mini carrito en dropdown (si existe)
        this.updateMiniCart();

        // Actualizar página de carrito (si estamos en ella)
        this.updateCartPage();
    }

    // Actualizar mini carrito
    updateMiniCart() {
        const miniCartContainer = document.getElementById('mini-cart-items');
        const miniCartTotal = document.getElementById('mini-cart-total');
        
        if (!miniCartContainer) return;

        if (this.cart.length === 0) {
            miniCartContainer.innerHTML = '<p class="text-muted text-center">Tu carrito está vacío</p>';
            if (miniCartTotal) miniCartTotal.textContent = '$0';
            return;
        }

        miniCartContainer.innerHTML = this.cart.map(item => `
            <div class="mini-cart-item d-flex align-items-center mb-2 p-2 border-bottom">
                <img src="${item.image || '/assets/img/no-image.png'}" 
                     alt="${item.name}" 
                     class="mini-cart-image me-2" 
                     style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                <div class="flex-grow-1">
                    <h6 class="mb-0 small">${item.name}</h6>
                    <small class="text-muted">${item.quantity} x $${item.price.toLocaleString()}</small>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="cart.removeFromCart('${item.id}')">
                    <i class="fas fa-trash fa-xs"></i>
                </button>
            </div>
        `).join('');

        if (miniCartTotal) {
            miniCartTotal.textContent = `$${this.cartTotal.toLocaleString()}`;
        }
    }

    // Actualizar página completa del carrito
    updateCartPage() {
        const cartContainer = document.getElementById('cart-items-container');
        const cartTotalElement = document.getElementById('cart-total');
        
        if (!cartContainer) return;

        if (this.cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                    <h3>Tu carrito está vacío</h3>
                    <p class="text-muted">Agrega productos a tu carrito para comenzar a comprar</p>
                    <a href="/productos.html" class="btn btn-primary">
                        <i class="fas fa-shopping-bag me-2"></i>Ir a Comprar
                    </a>
                </div>
            `;
            if (cartTotalElement) cartTotalElement.textContent = '$0';
            return;
        }

        cartContainer.innerHTML = this.cart.map(item => `
            <div class="cart-item card mb-3">
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-2">
                            <img src="${item.image || '/assets/img/no-image.png'}" 
                                 alt="${item.name}" 
                                 class="img-fluid rounded"
                                 style="max-height: 80px; object-fit: cover;">
                        </div>
                        <div class="col-md-4">
                            <h5 class="card-title">${item.name}</h5>
                            <p class="text-muted mb-0">Precio: $${item.price.toLocaleString()} / ${item.unit}</p>
                            <small class="text-muted">Stock disponible: ${item.stock} ${item.unit}</small>
                        </div>
                        <div class="col-md-3">
                            <div class="input-group">
                                <button class="btn btn-outline-secondary" onclick="cart.updateQuantity('${item.id}', ${item.quantity - 1})">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number" class="form-control text-center" 
                                       value="${item.quantity}" 
                                       min="1" 
                                       max="${item.stock}"
                                       onchange="cart.updateQuantity('${item.id}', parseInt(this.value))">
                                <button class="btn btn-outline-secondary" onclick="cart.updateQuantity('${item.id}', ${item.quantity + 1})">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        <div class="col-md-2 text-center">
                            <strong>$${(item.price * item.quantity).toLocaleString()}</strong>
                        </div>
                        <div class="col-md-1 text-center">
                            <button class="btn btn-outline-danger" onclick="cart.removeFromCart('${item.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        if (cartTotalElement) {
            cartTotalElement.textContent = `$${this.cartTotal.toLocaleString()}`;
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        // Listener para cuando el usuario se loguee/desloguee
        if (window.authManager) {
            window.authManager.on('AUTH_STATE_CHANGED', async (event) => {
                if (event.detail.state === 'AUTHENTICATED') {
                    await this.loadCartFromDB();
                    this.updateCartUI();
                } else if (event.detail.state === 'UNAUTHENTICATED') {
                    this.cart = [];
                    this.calculateTotals();
                    this.updateCartUI();
                }
            });
        }

        // Agregar eventos a botones de "Agregar al carrito" existentes
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.add-to-cart, .btn[onclick*="carrito"]')) {
                e.preventDefault();
                
                const button = e.target.closest('.add-to-cart, .btn[onclick*="carrito"]');
                const card = button.closest('.card, .card-product');
                
                if (card) {
                    const productId = button.dataset.productId || this.generateTempId();
                    const productName = card.querySelector('h5, h6, .card-title')?.textContent?.trim() || 'Producto';
                    const priceText = card.querySelector('.fw-bold, .price, .h5')?.textContent || '$0';
                    const price = this.extractPrice(priceText);
                    const image = card.querySelector('img')?.src || '';
                    
                    await this.addToCart(productId, productName, price, image);
                }
            }
        });
    }

    // Funciones auxiliares
    extractPrice(priceText) {
        const match = priceText.match(/[\d,]+/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
    }

    generateTempId() {
        return 'temp_' + Math.random().toString(36).substr(2, 9);
    }

    setLoading(loading) {
        this.isLoading = loading;
        // Aquí puedes agregar UI de loading si lo deseas
    }

    showNotification(message, type = 'info') {
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showLoginAlert() {
        this.showNotification('Por favor, inicia sesión para agregar productos al carrito', 'error');
        
        // Mostrar modal de login si existe
        setTimeout(() => {
            if (window.showLoginModal) {
                window.showLoginModal();
            }
        }, 1000);
    }

    // Método para obtener el carrito (útil para debugging)
    getCart() {
        return {
            items: this.cart,
            count: this.cartCount,
            total: this.cartTotal
        };
    }
}

// Inicializar carrito globalmente
window.cart = new ShoppingCart();

// Hacer funciones disponibles globalmente para compatibilidad
window.addToCart = (id, name, price, image, quantity = 1) => {
    return window.cart.addToCart(id, name, price, image, quantity);
};

// Función para mostrar el carrito (si tienes un modal o página específica)
window.showCart = () => {
    // Implementar según tu diseño
    console.log('Carrito:', window.cart.getCart());
};

// Log de inicialización
console.log('🛒 Sistema de carrito de compras cargado correctamente');