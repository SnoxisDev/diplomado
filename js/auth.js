import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias al HTML
const authForm = document.getElementById('authForm');
const toggleBtn = document.getElementById('toggleModeBtn');
const registerFields = document.getElementById('registerFields');
const title = document.getElementById('formTitle');
const btnLabel = document.getElementById('submitBtn');
const msg = document.getElementById('msg');

let isRegistering = false; // Variable para saber si estamos logueando o registrando

// 1. Alternar entre Login y Registro
toggleBtn.addEventListener('click', () => {
    isRegistering = !isRegistering;
    if (isRegistering) {
        registerFields.classList.remove('hidden');
        title.innerText = "Crear Cuenta Nueva";
        btnLabel.innerText = "Registrarse";
        toggleBtn.innerText = "¿Ya tienes cuenta? Inicia Sesión";
    } else {
        registerFields.classList.add('hidden');
        title.innerText = "Iniciar Sesión";
        btnLabel.innerText = "Entrar";
        toggleBtn.innerText = "¿No tienes cuenta? Regístrate aquí";
    }
});

// 2. Manejar el envío del formulario
authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    msg.innerText = "Procesando...";

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        if (isRegistering) {
            // --- LÓGICA DE REGISTRO ---
            const nombre = document.getElementById('nombre').value;
            const rol = document.getElementById('rol').value;

            // A. Crear usuario en Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // B. Guardar datos extra en Firestore (Base de datos)
            await setDoc(doc(db, "users", user.uid), {
                nombre: nombre,
                email: email,
                rol: rol,
                fecha_registro: new Date()
            });

            alert("Usuario creado con éxito. Ahora inicia sesión.");
            // Recargar para limpiar campos
            window.location.reload(); 

        } else {
            // --- LÓGICA DE LOGIN ---
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // C. Consultar qué rol tiene el usuario en la base de datos
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                msg.innerText = `Bienvenido, ${userData.nombre}`;
                
                // D. Redireccionar según el rol
                if (userData.rol === 'doctor') {
                    window.location.href = 'dashboard-dr.html';
                } else {
                    window.location.href = 'dashboard-paciente.html';
                }
            } else {
                msg.innerText = "Error: Usuario sin datos en Firestore.";
            }
        }
    } catch (error) {
        console.error(error);
        msg.innerText = "Error: " + error.message;
    }
});