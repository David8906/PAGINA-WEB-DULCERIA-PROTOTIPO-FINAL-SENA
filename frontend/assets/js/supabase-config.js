// ===== CONFIGURACIÓN FINAL PARA TU PROYECTO - VERSIÓN COMPLETA =====

// Configuración de Supabase
const SUPABASE_URL = 'https://jgjckpiodbswzkajxxsd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnamNrcGlvZGJzd3prYWp4eHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzcxMTksImV4cCI6MjA2ODgxMzExOX0.bxs1YS_oE5s7Gvsss8w1jBLSiLnSxXywstzQHAQjS3U';

// Inicializar cliente con CDN
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== FUNCIONES DE AUTENTICACIÓN =====

// Función de Login
async function loginUser(email, password) {
    if (window.authManager) {
        return await window.authManager.login(email, password);
    } else {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });
            
            if (error) {
                console.error('Error de login:', error.message);
                return { success: false, error: error.message };
            }
            
            console.log('Login exitoso:', data);
            return { success: true, user: data.user };
        } catch (err) {
            console.error('Error inesperado:', err);
            return { success: false, error: 'Error inesperado' };
        }
    }
}

// Función de Registro
async function registerUser(nombre_completo, email, password) {
    if (window.authManager) {
        return await window.authManager.register(nombre_completo, email, password);
    } else {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        nombre_completo: nombre_completo,
                        full_name: nombre_completo
                    }
                }
            });
            
            if (error) {
                console.error('Error de registro:', error.message);
                return { success: false, error: error.message };
            }
            
            console.log('Registro exitoso:', data);
            return { success: true, user: data.user };
        } catch (err) {
            console.error('Error inesperado:', err);
            return { success: false, error: 'Error inesperado' };
        }
    }
}

// Función para cerrar sesión
async function logoutUser() {
    if (window.authManager) {
        return await window.authManager.logout();
    } else {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Error al cerrar sesión:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true };
        } catch (err) {
            console.error('Error inesperado:', err);
            return { success: false, error: 'Error inesperado' };
        }
    }
}

// ===== FUNCIÓN DE RECUPERACIÓN DE CONTRASEÑA CORREGIDA =====

async function resetPassword(email, options = {}) {
    try {
        console.log('🔐 Enviando correo de recuperación para:', email);
        
        // Validar email
        if (!email || !email.includes('@')) {
            const error = 'Por favor ingresa un correo electrónico válido';
            return { success: false, error };
        }
        
        // *** VERSIÓN SIMPLIFICADA - La URL ya está en la plantilla de Supabase ***
        // No necesitamos detectar rutas porque ya configuramos la plantilla con URL fija
        console.log('📧 Usando plantilla de Supabase con URL configurada');
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, options);
        
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
            
            return { success: false, error: userFriendlyError };
        }
        
        console.log('✅ Correo de recuperación enviado exitosamente');
        return { 
            success: true, 
            message: 'Correo de recuperación enviado exitosamente',
            email
        };
        
    } catch (err) {
        console.error('❌ Error inesperado al enviar correo de recuperación:', err);
        return { success: false, error: 'Error inesperado al enviar el correo de recuperación' };
    }
}

// Función para actualizar contraseña con token
async function updatePasswordWithToken(newPassword, accessToken) {
    try {
        console.log('🔐 Actualizando contraseña con token...');
        
        // Validar longitud de la contraseña
        if (newPassword.length < 8) {
            return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
        }
        
        // Si se proporciona un token, establecer la sesión primero
        if (accessToken) {
            console.log('🔑 Estableciendo sesión con token...');
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

// ===== FUNCIONES UTILITARIAS =====

// Verificar si el usuario está autenticado
function isUserAuthenticated() {
    if (window.authManager) {
        return window.authManager.isAuthenticated();
    }
    return false;
}

// Obtener usuario actual
function getCurrentUser() {
    if (window.authManager) {
        return window.authManager.getCurrentUser();
    }
    return null;
}

// Obtener perfil actual
function getCurrentProfile() {
    if (window.authManager) {
        return window.authManager.getCurrentProfile();
    }
    return null;
}

// Validar formato de email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validar contraseña
function isValidPassword(password) {
    return password && password.length >= 8;
}

// ===== MANEJO DE CONFIRMACIÓN DE EMAIL Y RECUPERACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Manejo de confirmación de email
    const confirmationToken = urlParams.get('token_hash') || urlParams.get('token');
    if (confirmationToken) {
        // Limpiar la URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Mostrar mensaje
        setTimeout(() => {
            alert('¡Email confirmado exitosamente!');
        }, 1000);
    }
    
    // Manejo de reset de contraseña
    const resetToken = urlParams.get('access_token') || hashParams.get('access_token');
    const type = urlParams.get('type') || hashParams.get('type');
    
    if (resetToken && type === 'recovery') {
        console.log('🔐 Detectado proceso de recuperación de contraseña');
        
        // Si estamos en la página de reset, no hacer nada (la página se encarga)
        if (window.location.pathname.includes('reset-password') || window.location.pathname.includes('reset_password_page')) {
            return;
        }
        
        // Si estamos en otra página, redirigir a reset-password
        const resetUrl = `/reset-password.html#access_token=${resetToken}&type=recovery`;
        console.log('🔄 Redirigiendo a página de reset:', resetUrl);
        window.location.href = resetUrl;
    }
});

// ===== EVENTOS GLOBALES DE SUPABASE =====

// Listener para cambios en el estado de autenticación
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Cambio en estado de autenticación:', event);
    
    switch (event) {
        case 'SIGNED_IN':
            console.log('✅ Usuario autenticado:', session.user.email);
            break;
        case 'SIGNED_OUT':
            console.log('🚪 Usuario cerró sesión');
            break;
        case 'PASSWORD_RECOVERY':
            console.log('🔐 Proceso de recuperación de contraseña iniciado');
            break;
        case 'TOKEN_REFRESHED':
            console.log('🔄 Token refrescado');
            break;
        case 'USER_UPDATED':
            console.log('👤 Datos de usuario actualizados');
            break;
    }
});

// ===== LOG DE CONFIGURACIÓN =====
console.log('📋 Configuración de Supabase cargada correctamente');
console.log('🔧 Funciones disponibles: loginUser, registerUser, logoutUser, resetPassword, updatePasswordWithToken');
console.log('🔒 Cliente Supabase inicializado:', !!supabase);

// Hacer funciones disponibles globalmente para compatibilidad
window.resetPassword = resetPassword;
window.updatePasswordWithToken = updatePasswordWithToken;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
window.isValidEmail = isValidEmail;
window.isValidPassword = isValidPassword;
