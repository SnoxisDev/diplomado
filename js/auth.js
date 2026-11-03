import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const authForm = document.getElementById('authForm');

// Sincronizar el modo de autenticación si existe la función global
if (typeof window.cambiarModoAuth === 'function') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') {
        window.cambiarModoAuth(true);
    }
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Determinar si estamos registrando o iniciando sesión
        const isRegistering = (typeof window.isRegisteringMode !== 'undefined') 
            ? window.isRegisteringMode 
            : (document.getElementById('registerFields').style.display !== 'none');
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btnSubmit = document.getElementById('btnSubmitAuth') || authForm.querySelector('button[type="submit"]');

        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

        try {
            if (isRegistering) {
                const nombreInput = document.getElementById('nombre');
                const nombre = nombreInput ? nombreInput.value.trim() : "";
                const rol = document.getElementById('rol').value;

                if (!nombre) {
                    throw new Error("Por favor, ingresa tu nombre completo para el registro.");
                }

                // Crear usuario en Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Guardar documento en Firestore
                await setDoc(doc(db, "users", user.uid), {
                    nombre: nombre,
                    email: email,
                    rol: rol,
                    fecha_registro: new Date(),
                    estado: "activo"
                });

                // Registrar en bitácora de auditoría
                try {
                    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    await addDoc(collection(db, "bitacora"), {
                        fecha: new Date(),
                        usuario_id: user.uid,
                        accion: "NUEVO REGISTRO",
                        detalle: `Registro exitoso como ${rol}: ${nombre} (${email})`
                    });
                } catch (bErr) {
                    console.warn("Bitácora no registrada:", bErr);
                }

                // ALERTA SWEETALERT: Registro Exitoso
                await Swal.fire({
                    title: '¡Registro Exitoso!',
                    text: `Bienvenido a SIRA, ${nombre}. Tu cuenta de ${rol} ha sido creada correctamente.`,
                    icon: 'success',
                    confirmButtonColor: '#3b82f6',
                    confirmButtonText: 'Continuar'
                });

                redirigir(rol);

            } else {
                // Iniciar Sesión
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                if (user.email === "admin@gmail.com") {
                    await Swal.fire({
                        title: '¡Hola Admin!',
                        text: 'Accediendo al panel de control...',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    window.location.href = "dashboard-admin.html";
                    return; 
                }

                const docSnap = await getDoc(doc(db, "users", user.uid));
                
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    
                    // Verificación de Bloqueo
                    if (userData.estado === 'bloqueado') {
                        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                        await signOut(auth);
                        throw new Error("Tu cuenta ha sido bloqueada por el Administrador. Contacta a soporte.");
                    }

                    redirigir(userData.rol);
                } else {
                    throw new Error("Usuario autenticado pero sin datos registrados en la base de datos.");
                }
            }
        } catch (error) {
            console.error("Error de autenticación:", error);
            
            let msg = error.message;
            if (error.code === 'auth/invalid-credential') msg = "Correo o contraseña incorrectos.";
            if (error.code === 'auth/email-already-in-use') msg = "Este correo electrónico ya está registrado. Intenta iniciar sesión.";
            if (error.code === 'auth/weak-password') msg = "La contraseña es muy débil (debe tener al menos 6 caracteres).";
            if (error.code === 'auth/invalid-email') msg = "El formato del correo electrónico no es válido.";
            if (error.code === 'auth/network-request-failed') msg = "Error de conexión. Verifica tu acceso a internet o revisa si estás abriendo el proyecto con un servidor local.";

            // ALERTA SWEETALERT: Error
            Swal.fire({
                title: 'Error de Acceso',
                text: msg,
                icon: 'error',
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Entendido'
            });
            
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    });
}

function redirigir(rol) {
    if (rol === 'doctor') {
        window.location.href = 'dashboard-dr.html';
    } else {
        window.location.href = 'dashboard-paciente.html';
    }
}

// ==========================================
// RECUPERAR CONTRASEÑA
// ==========================================
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const { value: emailToReset } = await Swal.fire({
            title: 'Recuperar Contraseña',
            text: 'Ingresa tu correo registrado para enviarte un enlace:',
            icon: 'info',
            input: 'email',
            inputPlaceholder: 'usuario@ejemplo.com',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-envelope"></i> Enviar Enlace',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6'
        });

        if (emailToReset) {
            try {
                await sendPasswordResetEmail(auth, emailToReset);
                Swal.fire(
                    '¡Correo Enviado!', 
                    'Revisa tu bandeja de entrada (o carpeta de SPAM) para reestablecer tu contraseña.', 
                    'success'
                );
            } catch (error) {
                console.error("Error al enviar correo:", error);
                let msg = 'No se pudo enviar el correo de recuperación.';
                if (error.code === 'auth/user-not-found') msg = 'No existe ninguna cuenta registrada con este correo.';
                if (error.code === 'auth/invalid-email') msg = 'El correo electrónico no es válido.';
                
                Swal.fire('Error', msg, 'error');
            }
        }
    });
}
