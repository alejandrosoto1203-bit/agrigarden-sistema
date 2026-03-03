// auth.js - Seguridad y Acceso
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    if (btn) {
        btn.innerText = "Verificando...";
        btn.disabled = true;
    }

    try {

        // Intento de recuperación si window.sb no está inicializado
        // Definimos credenciales localmente para evitar errores si api.js falla
        // MODIFICADO: Usar configuración dinámica si existe
        const SB_URL = window.SUPABASE_URL || 'https://gajhfqfuvzotppnmzbuc.supabase.co';
        const SB_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamhmcWZ1dnpvdHBwbm16YnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM5OTAsImV4cCI6MjA4Mzk5OTk5MH0.FLomja07LVEmtzSuhBKRDQVcOXqryimaYPDBdIVNVbQ';

        if (!window.sb && window.createClient) {
            window.sb = window.createClient(SB_URL, SB_KEY);
        } else if (!window.sb && window.supabase && window.supabase.createClient) {
            window.sb = window.supabase.createClient(SB_URL, SB_KEY);
        }

        if (!window.sb) {
            throw new Error("Librería de conexión no cargada o cliente no inicializado.");
        }

        // Login seguro: la comparación de contraseña se hace en el servidor
        const { data: result, error } = await window.sb
            .rpc('verify_login', { p_email: email, p_password: pass });

        if (error) throw error;

        if (result && result.success) {
            const data = result.user;
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userRole', data.rol || 'viewer');
            sessionStorage.setItem('userName', data.nombre);
            sessionStorage.setItem('userId', data.id);
            sessionStorage.setItem('usuario', JSON.stringify(data));
            // Redirigir según rol
            if (data.rol === 'empleado') {
                window.location.href = 'solicitudes_rrhh.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        } else {
            alert("Credenciales incorrectas.");
            if (btn) {
                btn.innerText = "INGRESAR AL SISTEMA";
                btn.disabled = false;
            }
        }

    } catch (err) {
        console.error("Login error:", err);
        alert("Error al iniciar sesión: " + err.message);
        if (btn) {
            btn.innerText = "INGRESAR AL SISTEMA";
            btn.disabled = false;
        }
    }
});

const paginasPublicas = ['index.html', ''];
const currentPage = window.location.pathname.split("/").pop();

if (!paginasPublicas.includes(currentPage)) {
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = "index.html";
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}