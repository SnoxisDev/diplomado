import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const authForm = document.getElementById('authForm');
const toggleBtn = document.getElementById('toggleBtn');
const toggleText = document.getElementById('toggleText');
const registerFields = document.getElementById('registerFields');

let isRegistering = false; 

toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    const btnSubmit = authForm.querySelector('button');

    if (isRegistering) {
        registerFields.style.display = 'block';
        toggleText.innerText = "¿Ya tienes cuenta?";
        toggleBtn.innerText = "Inicia Sesión aquí";
        btnSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear Cuenta';
    } else {
        registerFields.style.display = 'none';
        toggleText.innerText = "¿No tienes cuenta?";
        toggleBtn.innerText = "Regístrate aquí";
        btnSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btnSubmit = authForm.querySelector('button');

    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        if (isRegistering) {
            const nombre = document.getElementById('nombre').value;
            const rol = document.getElementById('rol').value;

            if(!nombre) throw new Error("El nombre es obligatorio");

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                nombre: nombre,
                email: email,
                rol: rol,
                fecha_registro: new Date()
            });

            // ALERTA SWEETALERT: Registro Exitoso
            Swal.fire({
                title: '¡Registro Exitoso!',
                text: `Bienvenido a SIRA, ${nombre}`,
                icon: 'success',
                confirmButtonColor: '#3b82f6'
            }).then(() => {
                redirigir(rol);
            });

       } else {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (user.email === "admin@gmail.com") {
                // ALERTA SWEETALERT: Admin Login
                Swal.fire({
                    title: '¡Hola Admin!',
                    text: 'Accediendo al panel de control...',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = "dashboard-admin.html";
                });
                return; 
            }

            const docSnap = await getDoc(doc(db, "users", user.uid));
            
            if (docSnap.exists()) {
                // 🔒 NUEVO: VERIFICACIÓN DE BLOQUEO
                if (docSnap.data().estado === 'bloqueado') {
                    // Importar y ejecutar el cierre de sesión inmediatamente
                    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    await signOut(auth);
                    throw new Error("Tu cuenta ha sido bloqueada por el Administrador. Contacta a soporte.");
                }

                redirigir(docSnap.data().rol);
            } else {
                throw new Error("Usuario sin datos en la base de datos.");
            }
        }
    } catch (error) {
        console.error(error);
        
        let msg = error.message;
        if (error.code === 'auth/invalid-credential') msg = "Correo o contraseña incorrectos.";
        if (error.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
        if (error.code === 'auth/weak-password') msg = "La contraseña es muy débil (mínimo 6 caracteres).";

        // ALERTA SWEETALERT: Error
        Swal.fire({
            title: 'Acceso Denegado',
            text: msg,
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
});

function redirigir(rol) {
    if (rol === 'doctor') {
        window.location.href = 'dashboard-dr.html';
    } else {
        window.location.href = 'dashboard-paciente.html';
    }
}