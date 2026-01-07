import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('profileForm');
const avatarPreview = document.getElementById('avatarPreview');
const btnBack = document.getElementById('btnBack');

// Elementos del formulario
const nombreIn = document.getElementById('nombre');
const cedulaIn = document.getElementById('cedula');
const telefonoIn = document.getElementById('telefono');
const fechaIn = document.getElementById('fechaNacimiento');
const generoIn = document.getElementById('genero');
const emailIn = document.getElementById('email');
const photoIn = document.getElementById('photoUrl');

let userRole = ""; // Para saber a dónde volver (Dashboard Doctor o Paciente)

// 1. CARGAR DATOS AL ENTRAR
auth.onAuthStateChanged(async (user) => {
    if (user) {
        emailIn.value = user.email; // El correo viene de Auth

        // Buscar datos extra en Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            userRole = data.rol;

            // Rellenar campos si existen
            if(data.nombre) nombreIn.value = data.nombre;
            if(data.cedula) cedulaIn.value = data.cedula;
            if(data.telefono) telefonoIn.value = data.telefono;
            if(data.fechaNacimiento) fechaIn.value = data.fechaNacimiento;
            if(data.genero) generoIn.value = data.genero;
            
            // Manejo de la Foto
            if(data.photoUrl) {
                photoIn.value = data.photoUrl;
                actualizarAvatar(data.photoUrl);
            }
        }
    } else {
        window.location.href = 'index.html';
    }
});

// 2. FUNCIÓN VISUAL PARA EL AVATAR (CORREGIDA)
// 2. FUNCIÓN VISUAL PARA EL AVATAR (NUEVA VERSIÓN INTELIGENTE)
function actualizarAvatar(url) {
    if(url) {
        // A. Creamos una imagen "en memoria" para probar el link
        const imgTemp = new Image();
        
        // B. Definimos qué pasa si carga bien
        imgTemp.onload = function() {
            // Quitamos el fondo azul y el borde
            avatarPreview.style.background = 'none'; 
            avatarPreview.style.border = 'none';
            // Inyectamos la imagen con los estilos correctos
            avatarPreview.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
        };

        // C. Definimos qué pasa si falla (ej: link de Wikipedia)
        imgTemp.onerror = function() {
            // Restauramos el icono por defecto
            restaurarAvatarDefault();
            // Avisamos al usuario
            alert("❌ El enlace no es una imagen válida.\n\nTip: Haz clic derecho sobre la foto en Google y selecciona 'Copiar dirección de imagen'.");
            // Borramos el link malo del input
            photoIn.value = "";
        };

        // D. Iniciamos la prueba
        imgTemp.src = url;

    } else {
        // Si no hay URL, mostramos el default
        restaurarAvatarDefault();
    }
}

// Función auxiliar para restaurar el círculo azul
function restaurarAvatarDefault() {
    avatarPreview.style.background = 'var(--primary)';
    avatarPreview.style.border = '3px solid var(--bg-card)';
    avatarPreview.innerHTML = '<i class="fa-solid fa-user"></i>';
}

// Escuchar cambios en el input de URL para mostrar previsualización
photoIn.addEventListener('input', (e) => actualizarAvatar(e.target.value));

// 3. GUARDAR CAMBIOS
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try {
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);

        await updateDoc(userRef, {
            nombre: nombreIn.value,
            cedula: cedulaIn.value,
            telefono: telefonoIn.value,
            fechaNacimiento: fechaIn.value,
            genero: generoIn.value,
            photoUrl: photoIn.value
        });

        alert("✅ Perfil actualizado correctamente");
    } catch (error) {
        console.error(error);
        alert("Error al guardar: " + error.message);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
});

// 4. BOTÓN VOLVER
btnBack.addEventListener('click', () => {
    if(userRole === 'doctor') {
        window.location.href = 'dashboard-dr.html';
    } else {
        window.location.href = 'dashboard-paciente.html';
    }
});