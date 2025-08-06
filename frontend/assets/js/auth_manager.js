// =====================================================
// AUTH-MANAGER.JS - VERSIÓN ACTUALIZADA Y MEJORADA
// Gestor centralizado de autenticación con todas las funcionalidades
// =====================================================

class AuthManager {
    // Estados de autenticación
    static AUTH_STATES = {
        AUTHENTICATED: 'authenticated',
        UNAUTHENTICATED: 'unauthenticated',
        LOADING: 'loading',
        ERROR: 'error'
    };

    // Eventos personalizados
    static EVENTS = {
        AUTH_STATE_CHANGED: 'authStateChanged',
        LOGIN_SUCCESS: 'loginSuccess',
        LOGIN_ERROR: 'loginError',
        LOGOUT_SUCCESS: 'logoutSuccess',
        PROFILE_UPDATED: 'profileUpdated',
        PASSWORD_RESET_SENT: 'passwordResetSent',
        PASSWORD_RESET_ERROR: 'passwordResetError',
        CART_UPDATED: 'cartUpdated' // Nuevo evento para el carrito
    };
    
    constructor() {
        this.initialized = false;
        this.currentUser = null;
        this.currentProfile = null;
        this.authState = AuthManager.AUTH_STATES.LOADING;
        this.eventTarget = new EventTarget();
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    // Método para suscribirse a eventos
    on(event, callback) {
        this.eventTarget.addEventListener(event, callback);
        return () => this.eventTarget.removeEventListener(event, callback);
    }

    // Disparar eventos personalizados
    _dispatchEvent(event, detail = {}) {
        const customEvent = new CustomEvent(event, { 
            detail: { 
                ...detail, 
                authState: this.authState, 
                user: this.currentUser,
                profile: this.currentProfile,
                timestamp: new Date().toISOString()
            }
        });
        this.eventTarget.dispatchEvent(customEvent);
    }

    // Inicializar el gestor de autenticación
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('🚀 Inicializando AuthManager...');
            
            // Verificar si Supabase está disponible
            if (typeof supabase === 'undefined') {
                const error = new Error('Supabase no está disponible - Verificar que el script esté cargado');
                this._handleError(error);
                return;
            }
            
            this._setAuthState(AuthManager.AUTH_STATES.LOADING);

            // Obtener sesión actual con reintentos
            const sessionResult = await this._getSessionWithRetry();
            if (!sessionResult.success) {
                this._handleError(new Error(sessionResult.error));
                return;
            }

            const session = sessionResult.session;

            if (session && session.user) {
                console.log('✅ Sesión existente encontrada:', session.user.email);
                this.currentUser = session.user;
                await this.loadUserProfile();
                this._setAuthState(AuthManager.AUTH_STATES.AUTHENTICATED);
            } else {
                console.log('ℹ️ No hay sesión activa');
                this._setAuthState(AuthManager.AUTH_STATES.UNAUTHENTICATED);
            }

            // Configurar listener para cambios de estado
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔄 Estado de auth cambió:', event, session?.user?.email || 'sin usuario');
                
                try {
                    switch (event) {
                        case 'SIGNED_IN':
                            if (session && session.user) {
                                this.currentUser = session.user;
                                await this.loadUserProfile();
                                this._setAuthState(AuthManager.AUTH_STATES.AUTHENTICATED);
                                this._dispatchEvent(AuthManager.EVENTS.LOGIN_SUCCESS, { user: session.user });
                            }
                            break;
                            
                        case 'SIGNED_OUT':
                            this.currentUser = null;
                            this.currentProfile = null;
                            this._setAuthState(AuthManager.AUTH_STATES.UNAUTHENTICATED);
                            this._dispatchEvent(AuthManager.EVENTS.LOGOUT_SUCCESS);
                            break;
                            
                        case 'PASSWORD_RECOVERY':
                            console.log('🔐 Proceso de recuperación de contraseña iniciado');
                            break;
                            
                        case 'TOKEN_REFRESHED':
                            console.log('🔄 Token refrescado automáticamente');
                            if (session && session.user) {
                                this.currentUser = session.user;
                            }
                            break;
                            
                        case 'USER_UPDATED':
                            console.log('👤 Datos de usuario actualizados');
                            if (session && session.user) {
                                this.currentUser = session.user;
                                await this.loadUserProfile();
                            }
                            break;
                    }
                    
                    // Actualizar UI en todas las páginas
                    await this.updateHeaderUI();
                    
                } catch (error) {
                    console.error('❌ Error en onAuthStateChange:', error);
                }
            });

            // Actualizar UI inicial
            await this.updateHeaderUI();
            this.initialized = true;
            
            console.log('✅ AuthManager inicializado correctamente');
            this._dispatchEvent(AuthManager.EVENTS.AUTH_STATE_CHANGED, { 
                state: this.authState,
                initialized: true
            });
            
        } catch (error) {
            console.error('❌ Error crítico inicializando AuthManager:', error);
            this._handleError(error);
        }
    }

    // Obtener sesión con reintentos
    async _getSessionWithRetry() {
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                console.log(`🔄 Obteniendo sesión (intento ${i + 1}/${this.maxRetries})...`);
                
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.warn(`⚠️ Error en intento ${i + 1}:`, error.message);
                    if (i === this.maxRetries - 1) {
                        throw error;
                    }
                    // Esperar antes del siguiente intento
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    continue;
                }
                
                return { success: true, session };
                
            } catch (error) {
                if (i === this.maxRetries - 1) {
                    return { success: false, error: error.message };
                }
            }
        }
    }

    // Manejo de errores centralizado
    _handleError(error, context = 'Error en AuthManager') {
        console.error(`${context}:`, error);
        this._setAuthState(AuthManager.AUTH_STATES.ERROR, error);
        return { success: false, error: error.message || error };
    }

    // Actualizar estado de autenticación
    _setAuthState(state, error = null) {
        const previousState = this.authState;
        this.authState = state;
        
        console.log(`🔄 Estado cambiado: ${previousState} → ${state}`);
        
        this._dispatchEvent(AuthManager.EVENTS.AUTH_STATE_CHANGED, { 
            state, 
            previousState,
            error,
            user: this.currentUser,
            profile: this.currentProfile
        });
    }

    // Cargar perfil del usuario
    async loadUserProfile() {
        if (!this.currentUser) {
            console.warn('⚠️ No hay usuario autenticado para cargar perfil');
            return { success: false, error: 'No hay usuario autenticado' };
        }
        
        try {
            console.log('🔍 Cargando perfil del usuario:', this.currentUser.id);
            
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No encontrado - crear perfil
                    console.log('📝 Perfil no encontrado, creando uno nuevo...');
                    return await this.createUserProfile();
                } else {
                    throw error;
                }
            } else {
                console.log('✅ Perfil cargado:', profile);
                this.currentProfile = profile;
                this._dispatchEvent(AuthManager.EVENTS.PROFILE_UPDATED, { profile });
                return { success: true, profile };
            }
        } catch (error) {
            console.error('❌ Error cargando perfil:', error);
            return this._handleError(error, 'Error al cargar perfil del usuario');
        }
    }

    // Crear perfil de usuario si no existe
    async createUserProfile() {
        if (!this.currentUser) {
            return { success: false, error: 'No hay usuario autenticado' };
        }

        try {
            console.log('📝 Creando perfil para usuario:', this.currentUser.email);
            
            // Obtener el nombre desde diferentes fuentes con prioridades
            let nombre = this._extractUserName();
            
            console.log('📝 Nombre extraído para el perfil:', nombre);

            const profileData = {
                id: this.currentUser.id,
                nombre: nombre,
                email: this.currentUser.email,
                rol: 'cliente',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log('📝 Datos del perfil a crear:', profileData);

            const { data, error } = await supabase
                .from('profiles')
                .insert([profileData])
                .select()
                .single();

            if (error) {
                console.error('❌ Error al crear perfil:', error);
                return this._handleError(error, 'Error al crear perfil');
            }    
            
            console.log('✅ Perfil creado exitosamente:', data);
            this.currentProfile = data;
            this._dispatchEvent(AuthManager.EVENTS.PROFILE_UPDATED, { profile: data });
            return { success: true, profile: data };
            
        } catch (error) {
            console.error('❌ Error inesperado al crear perfil:', error);
            return this._handleError(error, 'Error inesperado al crear perfil');
        }
    }

    // Extraer nombre del usuario de diferentes fuentes
    _extractUserName() {
        // Prioridad 1: user_metadata.nombre_completo
        if (this.currentUser.user_metadata?.nombre_completo) {
            console.log('✅ Nombre desde user_metadata.nombre_completo:', this.currentUser.user_metadata.nombre_completo);
            return this.currentUser.user_metadata.nombre_completo;
        }
        
        // Prioridad 2: user_metadata.full_name  
        if (this.currentUser.user_metadata?.full_name) {
            console.log('✅ Nombre desde user_metadata.full_name:', this.currentUser.user_metadata.full_name);
            return this.currentUser.user_metadata.full_name;
        }
        
        // Prioridad 3: primera parte del email
        if (this.currentUser.email) {
            const emailPart = this.currentUser.email.split('@')[0];
            if (emailPart && emailPart !== 'usuario' && emailPart.length > 2) {
                console.log('✅ Nombre desde email:', emailPart);
                return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
            }
        }
        
        // Valor por defecto
        console.log('ℹ️ Usando nombre por defecto: Usuario');
        return 'Usuario';
    }

    // Actualizar interfaz del header
    async updateHeaderUI() {
        try {
            const isAuthenticated = !!this.currentUser;
            console.log('🔄 Actualizando UI del header. Autenticado:', isAuthenticated);
            
            // Esperar un poco para asegurar que el DOM esté listo
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Elementos del header
            const elements = {
                userName: document.getElementById('userName'),
                userDisplayName: document.getElementById('userDisplayName'),
                userInfoHeader: document.getElementById('userInfoHeader'),
                userMenuDivider: document.getElementById('userMenuDivider'),
                menuUserName: document.getElementById('menuUserName'),
                menuUserEmail: document.getElementById('menuUserEmail'),
                mobileUserName: document.getElementById('mobileUserName'),
                mobileUserEmail: document.getElementById('mobileUserEmail'),
                
                // Menu items
                loginMenuItem: document.getElementById('loginMenuItem'),
                registerMenuItem: document.getElementById('registerMenuItem'),
                profileMenuItem: document.getElementById('profileMenuItem'),
                ordersMenuItem: document.getElementById('ordersMenuItem'),
                adminMenuItem: document.getElementById('adminMenuItem'),
                logoutDivider: document.getElementById('logoutDivider'),
                logoutMenuItem: document.getElementById('logoutMenuItem'),
                
                // Mobile actions
                mobileGuestActions: document.getElementById('mobileGuestActions'),
                mobileUserActions: document.getElementById('mobileUserActions'),
                mobileAdminAction: document.getElementById('mobileAdminAction')
            };

            if (isAuthenticated) {
                // Usuario autenticado
                const displayName = this.getDisplayName();
                console.log('👤 Nombre a mostrar:', displayName);
                
                // Actualizar elementos principales
                if (elements.userName) {
                    elements.userName.textContent = displayName;
                    console.log('✅ userName actualizado:', displayName);
                }
                
                // Ocultar userDisplayName para evitar duplicación
                if (elements.userDisplayName) {
                    elements.userDisplayName.classList.add('d-none');
                    elements.userDisplayName.textContent = '';
                }
                
                // Actualizar menú dropdown
                if (elements.userInfoHeader) elements.userInfoHeader.classList.remove('d-none');
                if (elements.userMenuDivider) elements.userMenuDivider.classList.remove('d-none');
                if (elements.menuUserName) elements.menuUserName.textContent = displayName;
                if (elements.menuUserEmail) elements.menuUserEmail.textContent = this.currentUser.email;
                
                // Actualizar elementos móviles
                if (elements.mobileUserName) elements.mobileUserName.textContent = displayName;
                if (elements.mobileUserEmail) elements.mobileUserEmail.textContent = this.currentUser.email;
                
                // Ocultar opciones de invitado
                if (elements.loginMenuItem) elements.loginMenuItem.classList.add('d-none');
                if (elements.registerMenuItem) elements.registerMenuItem.classList.add('d-none');
                if (elements.mobileGuestActions) elements.mobileGuestActions.classList.add('d-none');
                
                // Mostrar opciones de usuario autenticado
                if (elements.profileMenuItem) elements.profileMenuItem.classList.remove('d-none');
                if (elements.ordersMenuItem) elements.ordersMenuItem.classList.remove('d-none');
                if (elements.logoutDivider) elements.logoutDivider.classList.remove('d-none');
                if (elements.logoutMenuItem) elements.logoutMenuItem.classList.remove('d-none');
                if (elements.mobileUserActions) elements.mobileUserActions.classList.remove('d-none');
                
                // Mostrar panel admin si corresponde
                const isAdmin = this.currentProfile?.rol === 'admin';
                if (elements.adminMenuItem) {
                    if (isAdmin) {
                        elements.adminMenuItem.classList.remove('d-none');
                    } else {
                        elements.adminMenuItem.classList.add('d-none');
                    }
                }
                if (elements.mobileAdminAction) {
                    if (isAdmin) {
                        elements.mobileAdminAction.classList.remove('d-none');
                    } else {
                        elements.mobileAdminAction.classList.add('d-none');
                    }
                }
                
            } else {
                // Usuario no autenticado
                if (elements.userName) {
                    elements.userName.textContent = 'Cuenta';
                    console.log('✅ userName resetado a "Cuenta"');
                }
                
                // Ocultar elementos de usuario autenticado
                if (elements.userDisplayName) {
                    elements.userDisplayName.classList.add('d-none');
                    elements.userDisplayName.textContent = '';
                }
                if (elements.userInfoHeader) elements.userInfoHeader.classList.add('d-none');
                if (elements.userMenuDivider) elements.userMenuDivider.classList.add('d-none');
                if (elements.mobileUserActions) elements.mobileUserActions.classList.add('d-none');
                
                // Actualizar elementos móviles para invitados
                if (elements.mobileUserName) elements.mobileUserName.textContent = 'Invitado';
                if (elements.mobileUserEmail) elements.mobileUserEmail.textContent = 'Inicia sesión para ver tu cuenta';
                
                // Mostrar opciones de invitado
                if (elements.loginMenuItem) elements.loginMenuItem.classList.remove('d-none');
                if (elements.registerMenuItem) elements.registerMenuItem.classList.remove('d-none');
                if (elements.mobileGuestActions) elements.mobileGuestActions.classList.remove('d-none');
                
                // Ocultar opciones de usuario autenticado
                if (elements.profileMenuItem) elements.profileMenuItem.classList.add('d-none');
                if (elements.ordersMenuItem) elements.ordersMenuItem.classList.add('d-none');
                if (elements.adminMenuItem) elements.adminMenuItem.classList.add('d-none');
                if (elements.logoutDivider) elements.logoutDivider.classList.add('d-none');
                if (elements.logoutMenuItem) elements.logoutMenuItem.classList.add('d-none');
                if (elements.mobileAdminAction) elements.mobileAdminAction.classList.add('d-none');
            }
            
            console.log('✅ UI del header actualizada correctamente');
            
        } catch (error) {
            console.error('❌ Error al actualizar UI del header:', error);
        }
    }

    // Obtener nombre para mostrar
    getDisplayName() {
        // Prioridad 1: Nombre del perfil en la base de datos
        if (this.currentProfile?.nombre && this.currentProfile.nombre !== 'Usuario') {
            return this.currentProfile.nombre;
        }
        
        // Prioridad 2: user_metadata.nombre_completo
        if (this.currentUser?.user_metadata?.nombre_completo) {
            return this.currentUser.user_metadata.nombre_completo;
        }
        
        // Prioridad 3: user_metadata.full_name
        if (this.currentUser?.user_metadata?.full_name) {
            return this.currentUser.user_metadata.full_name;
        }
        
        // Prioridad 4: primera parte del email (si no es "usuario")
        if (this.currentUser?.email) {
            const emailPart = this.currentUser.email.split('@')[0];
            if (emailPart && emailPart !== 'usuario' && emailPart.length > 2) {
                return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
            }
        }
        
        return 'Mi cuenta';
    }

    // Método para login
    async login(email, password) {
        try {
            console.log('🔐 Intentando login para:', email);
            
            // Validaciones básicas
            if (!email || !password) {
                throw new Error('Email y contraseña son requeridos');
            }
            
            if (!this._isValidEmail(email)) {
                throw new Error('Formato de email inválido');
            }
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });
            
            if (error) {
                console.error('❌ Error de login:', error.message);
                
                // Personalizar mensajes de error
                let userFriendlyError = error.message;
                if (error.message.includes('Invalid login credentials')) {
                    userFriendlyError = 'Credenciales incorrectas. Verifica tu email y contraseña.';
                } else if (error.message.includes('Email not confirmed')) {
                    userFriendlyError = 'Por favor confirma tu email antes de iniciar sesión.';
                } else if (error.message.includes('Too many requests')) {
                    userFriendlyError = 'Demasiados intentos. Intenta de nuevo en unos minutos.';
                }
                
                this._dispatchEvent(AuthManager.EVENTS.LOGIN_ERROR, { 
                    error: userFriendlyError,
                    originalError: error.message,
                    email 
                });
                return { success: false, error: userFriendlyError };
            }
            
            console.log('✅ Login exitoso:', data.user.email);
            // El evento LOGIN_SUCCESS se disparará automáticamente en onAuthStateChange
            return { success: true, user: data.user };
            
        } catch (err) {
            console.error('❌ Error inesperado en login:', err);
            const errorMessage = err.message || 'Error inesperado al iniciar sesión';
            this._dispatchEvent(AuthManager.EVENTS.LOGIN_ERROR, { error: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    // Método para registro
    async register(nombre_completo, email, password) {
        try {
            console.log('📝 Intentando registro para:', { nombre_completo, email });
            
            // Validaciones
            if (!nombre_completo || !email || !password) {
                throw new Error('Todos los campos son requeridos');
            }
            
            if (!this._isValidEmail(email)) {
                throw new Error('Formato de email inválido');
            }
            
            if (password.length < 8) {
                throw new Error('La contraseña debe tener al menos 8 caracteres');
            }
            
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        nombre_completo: nombre_completo.trim(),
                        full_name: nombre_completo.trim()
                    }
                }
            });
            
            if (error) {
                console.error('❌ Error de registro:', error.message);
                
                // Personalizar mensajes de error
                let userFriendlyError = error.message;
                if (error.message.includes('User already registered')) {
                    userFriendlyError = 'Ya existe una cuenta con este email.';
                } else if (error.message.includes('Password should be')) {
                    userFriendlyError = 'La contraseña no cumple con los requisitos mínimos.';
                }
                
                return { success: false, error: userFriendlyError };
            }
            
            console.log('✅ Registro exitoso:', data.user?.email);
            
            // Si el usuario se registró pero necesita confirmar email
            if (data.user && !data.user.email_confirmed_at) {
                console.log('📧 Usuario registrado, esperando confirmación de email');
                return { 
                    success: true, 
                    user: data.user, 
                    message: 'Por favor revisa tu correo para confirmar tu cuenta'
                };
            }
            
            return { success: true, user: data.user };
            
        } catch (err) {
            console.error('❌ Error inesperado en registro:', err);
            return { success: false, error: err.message || 'Error inesperado' };
        }
    }

    // Método para logout
    async logout() {
        try {
            console.log('🚪 Cerrando sesión...');
            
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('❌ Error al cerrar sesión:', error.message);
                return { success: false, error: error.message };
            }
            
            console.log('✅ Sesión cerrada exitosamente');
            // El evento LOGOUT_SUCCESS se disparará automáticamente en onAuthStateChange
            return { success: true };
            
        } catch (err) {
            console.error('❌ Error inesperado al cerrar sesión:', err);
            return { success: false, error: 'Error inesperado' };
        }
    }

    // Método para recuperar contraseña
    async resetPassword(email, options = {}) {
        try {
            console.log('🔐 Enviando correo de recuperación para:', email);
            
            // Validar email
            if (!email || !this._isValidEmail(email)) {
                const error = 'Por favor ingresa un correo electrónico válido';
                this._dispatchEvent(AuthManager.EVENTS.PASSWORD_RESET_ERROR, { error });
                return { success: false, error };
            }
            
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), options);
            
            if (error) {
                console.error('❌ Error al enviar correo de recuperación:', error.message);
                
                // Interpretar diferentes tipos de errores
                let userFriendlyError = error.message;
                
                if (error.message.includes('User not found')) {
                    userFriendlyError = 'No encontramos una cuenta asociada a este correo electrónico';
                } else if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
                    userFriendlyError = 'Has enviado demasiadas solicitudes. Por favor espera unos minutos e intenta de nuevo';
                } else if (error.message.includes('Email not confirmed')) {
                    userFriendlyError = 'Tu cuenta no ha sido confirmada. Por favor revisa tu correo para confirmar tu cuenta primero';
                } else {
                    userFriendlyError = 'Error al enviar el correo de recuperación. Por favor intenta de nuevo';
                }
                
                this._dispatchEvent(AuthManager.EVENTS.PASSWORD_RESET_ERROR, { 
                    error: userFriendlyError,
                    originalError: error.message,
                    email 
                });
                
                return { success: false, error: userFriendlyError };
            }
            
            console.log('✅ Correo de recuperación enviado exitosamente');
            this._dispatchEvent(AuthManager.EVENTS.PASSWORD_RESET_SENT, { email });
            
            return { 
                success: true, 
                message: 'Correo de recuperación enviado exitosamente',
                email 
            };
            
        } catch (err) {
            console.error('❌ Error inesperado al enviar correo de recuperación:', err);
            const errorMessage = 'Error inesperado al enviar el correo de recuperación';
            this._dispatchEvent(AuthManager.EVENTS.PASSWORD_RESET_ERROR, { 
                error: errorMessage,
                originalError: err.message 
            });
            return { success: false, error: errorMessage };
        }
    }

    // Método para actualizar contraseña con token
    async updatePassword(newPassword, accessToken = null) {
        try {
            console.log('🔐 Actualizando contraseña...');
            
            // Validar longitud de la contraseña
            if (newPassword.length < 8) {
                const error = 'La contraseña debe tener al menos 8 caracteres';
                return { success: false, error };
            }
            
            // Si se proporciona un token, establecer la sesión primero
            if (accessToken) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: ''
                });
                
                if (sessionError) {
                    console.error('❌ Error al establecer sesión:', sessionError);
                    return { success: false, error: 'Token de recuperación inválido o expirado' };
                }
            }
            
            // Actualizar la contraseña
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                console.error('❌ Error al actualizar contraseña:', error.message);
                
                let userFriendlyError = error.message;
                if (error.message.includes('session')) {
                    userFriendlyError = 'Sesión expirada. Por favor solicita un nuevo enlace de recuperación';
                } else if (error.message.includes('weak password')) {
                    userFriendlyError = 'La contraseña es muy débil. Debe tener al menos 8 caracteres';
                }
                
                return { success: false, error: userFriendlyError };
            }
            
            console.log('✅ Contraseña actualizada exitosamente');
            return { 
                success: true, 
                message: 'Contraseña actualizada exitosamente' 
            };
            
        } catch (err) {
            console.error('❌ Error inesperado al actualizar contraseña:', err);
            return { success: false, error: 'Error inesperado al actualizar la contraseña' };
        }
    }

    // Funciones de utilidad
    _isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Métodos públicos de estado
    isAuthenticated() {
        return !!this.currentUser && this.authState === AuthManager.AUTH_STATES.AUTHENTICATED;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentProfile() {
        return this.currentProfile;
    }

    getAuthState() {
        return this.authState;
    }

    isLoading() {
        return this.authState === AuthManager.AUTH_STATES.LOADING;
    }

    hasError() {
        return this.authState === AuthManager.AUTH_STATES.ERROR;
    }

    isAdmin() {
        return this.currentProfile?.rol === 'admin';
    }

    // Método para refrescar perfil
    async refreshProfile() {
        if (this.currentUser) {
            return await this.loadUserProfile();
        }
        return { success: false, error: 'No hay usuario autenticado' };
    }
}

// =====================================================
// INICIALIZACIÓN GLOBAL
// =====================================================

// Crear instancia global del gestor de autenticación
window.authManager = new AuthManager();

// Funciones globales de compatibilidad
window.cerrarSesion = async function() {
    try {
        const result = await window.authManager.logout();
        if (result.success) {
            // Redirigir a la página de inicio después de un breve delay
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Ocurrió un error al cerrar la sesión. Por favor, inténtalo de nuevo.');
    }
};

// Función global para recuperar contraseña
window.resetPassword = async function(email, options = {}) {
    if (window.authManager) {
        return await window.authManager.resetPassword(email, options);
    } else {
        console.warn('AuthManager no disponible, usando función legacy');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: options.redirectTo || `${window.location.origin}/reset-password.html`
            });
            
            if (error) {
                return { success: false, error: error.message };
            }
            
            return { success: true };
        } catch (err) {
            return { success: false, error: 'Error inesperado' };
        }
    }
};

// Función para navegar (compatibilidad)
window.navigateTo = function(url) {
    window.location.href = url;
};

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 DOM listo, inicializando AuthManager...');
    try {
        await window.authManager.init();
    } catch (error) {
        console.error('❌ Error inicializando AuthManager:', error);
    }
});

// También inicializar si el DOM ya está listo
if (document.readyState !== 'loading') {
    console.log('🚀 DOM ya listo, inicializando AuthManager...');
    setTimeout(() => {
        window.authManager.init();
    }, 100);
}

// Log de carga exitosa
console.log('✅ AuthManager cargado correctamente - Versión mejorada');