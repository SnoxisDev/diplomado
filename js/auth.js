import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias al HTML (Adaptadas al Nuevo Diseño)
const authForm = document.getElementById('authForm');
const toggleBtn = document.getElementById('toggleBtn');     // Enlace de texto abajo
const toggleText = document.getElementById('toggleText');   // Texto "¿No tienes cuenta?"
const registerFields = document.getElementById('registerFields'); // Campos extra

let isRegistering = false; 

// 1. ALTERNAR MODO (Login <-> Registro)
toggleBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Evita que el enlace recargue la página
    isRegistering = !isRegistering;

    const btnSubmit = authForm.querySelector('button'); // El botón principal

    if (isRegistering) {
        // MODO REGISTRO
        registerFields.style.display = 'block'; // Mostrar campos
        toggleText.innerText = "¿Ya tienes cuenta?";
        toggleBtn.innerText = "Inicia Sesión aquí";
        // Cambiar botón con icono de FontAwesome
        btnSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear Cuenta';
    } else {
        // MODO LOGIN
        registerFields.style.display = 'none'; // Ocultar campos
        toggleText.innerText = "¿No tienes cuenta?";
        toggleBtn.innerText = "Regístrate aquí";
        // Cambiar botón con icono de FontAwesome
        btnSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
    }
});

// 2. MANEJAR ENVÍO
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btnSubmit = authForm.querySelector('button');

    // Feedback visual (Cargando...)
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        if (isRegistering) {
            // --- REGISTRO ---
            const nombre = document.getElementById('nombre').value;
            const rol = document.getElementById('rol').value;

            if(!nombre) throw new Error("El nombre es obligatorio");

            // Crear usuario
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Guardar en Firestore
            await setDoc(doc(db, "users", user.uid), {
                nombre: nombre,
                email: email,
                rol: rol,
                fecha_registro: new Date()
            });

            alert(`✅ ¡Bienvenido, ${nombre}!`);
            redirigir(rol);

        } else {
            // --- LOGIN ---
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Buscar rol
            const docSnap = await getDoc(doc(db, "users", user.uid));
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                redirigir(data.rol);
            } else {
                alert("Error: Usuario sin datos.");
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalText;
            }
        }
    } catch (error) {
        console.error(error);
        
        // Mensajes de error amigables
        let msg = error.message;
        if (error.code === 'auth/invalid-credential') msg = "Correo o contraseña incorrectos.";
        if (error.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
        if (error.code === 'auth/weak-password') msg = "La contraseña es muy débil (mínimo 6 caracteres).";

        alert("❌ " + msg);
        
        // Restaurar botón
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
});

// Función simple para mover al usuario
function redirigir(rol) {
    if (rol === 'doctor') {
        window.location.href = 'dashboard-dr.html';
    } else {
        window.location.href = 'dashboard-paciente.html';
    }
}