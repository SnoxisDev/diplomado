import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('profileForm');
const avatarPreview = document.getElementById('avatarPreview');
const btnBack = document.getElementById('btnBack');

// Inputs
const nombreIn = document.getElementById('nombre');
const cedulaIn = document.getElementById('cedula');
const telefonoIn = document.getElementById('telefono');
const fechaIn = document.getElementById('fechaNacimiento');
const generoIn = document.getElementById('genero');
const emailIn = document.getElementById('email');
const photoIn = document.getElementById('photoUrl');

let userRole = "";

// 1. CARGAR DATOS
auth.onAuthStateChanged(async (user) => {
    if (user) {
        emailIn.value = user.email;
        
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            userRole = data.rol;

            if(data.nombre) nombreIn.value = data.nombre;
            if(data.cedula) cedulaIn.value = data.cedula;
            if(data.telefono) telefonoIn.value = data.telefono;
            if(data.fechaNacimiento) fechaIn.value = data.fechaNacimiento;
            if(data.genero) generoIn.value = data.genero;
            
            if(data.photoUrl) {
                photoIn.value = data.photoUrl;
                actualizarAvatar(data.photoUrl);
            }
        }
    } else {
        window.location.href = 'index.html';
    }
});

// 2. LÓGICA DEL AVATAR (INTELIGENTE)
function actualizarAvatar(url) {
    if(url) {
        const imgTemp = new Image();
        imgTemp.onload = function() {
            avatarPreview.style.background = 'none'; 
            avatarPreview.style.border = 'none';
            avatarPreview.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
        };
        imgTemp.onerror = function() {
            restaurarAvatarDefault();
            // Esta la dejamos con alert normal porque es un error de formato de imagen, 
            // no de validación de base de datos.
            alert("❌ El enlace no es una imagen válida.\nIntenta copiar la dirección de la imagen (terminada en .jpg o .png).");
            photoIn.value = "";
        };
        imgTemp.src = url;
    } else {
        restaurarAvatarDefault();
    }
}

function restaurarAvatarDefault() {
    avatarPreview.style.background = 'var(--primary)';
    avatarPreview.style.border = '3px solid var(--bg-card)';
    avatarPreview.innerHTML = '<i class="fa-solid fa-user"></i>';
}

// Escuchar cambios en el input de foto
photoIn.addEventListener('input', (e) => actualizarAvatar(e.target.value));

// 3. GUARDAR CAMBIOS (CON VALIDACIONES SWEETALERT Y TELÉFONO ESTRICTO)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // --- VALIDACIONES CON SWEETALERT ---
    if (nombreIn.value.trim().length < 3) {
        return Swal.fire('Nombre Inválido', 'El nombre es muy corto. Usa tu nombre real.', 'error');
    }

    // --- VALIDACIÓN DE TELÉFONO ESTRICTA ---
    const telefonoRaw = telefonoIn.value.trim();
    if (telefonoRaw.length > 0) {
        // 1. Prohibir letras y símbolos raros (solo permite números y el signo +)
        if (/[^0-9+]/.test(telefonoRaw)) {
            return Swal.fire('Teléfono Inválido', 'El teléfono no puede contener letras ni espacios.', 'error');
        }
        
        // 2. Verificar que tenga suficientes números
        const telLimpio = telefonoRaw.replace(/\D/g,''); 
        if (telLimpio.length < 10) {
            return Swal.fire('Teléfono Inválido', 'Ingresa un número válido con código de área (mínimo 10 dígitos).', 'error');
        }
    }

    // Validación de fecha
    if (fechaIn.value) {
        const fechaNac = new Date(fechaIn.value);
        const hoy = new Date();
        const edad = hoy.getFullYear() - fechaNac.getFullYear();
        
        if (fechaNac > hoy) return Swal.fire('Fecha Inválida', 'No puedes haber nacido en el futuro 🤖', 'error');
        if (edad > 110 || edad < 5) return Swal.fire('Fecha Inválida', 'Por favor verifica tu año de nacimiento.', 'error');
    }
    // ---------------------------------

    const btn = form.querySelector('button');
    btn.disabled = true; 
    btn.innerText = "Guardando...";

    try {
        const user = auth.currentUser;
        await updateDoc(doc(db, "users", user.uid), {
            nombre: nombreIn.value,
            cedula: cedulaIn.value,
            telefono: telefonoRaw, // Guardamos el teléfono crudo validado
            fechaNacimiento: fechaIn.value,
            genero: generoIn.value,
            photoUrl: photoIn.value
        });
        Swal.fire('¡Perfil Actualizado!', 'Tus datos se guardaron correctamente.', 'success');
    } catch (error) {
        Swal.fire('Error al guardar', error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
});

// 4. VOLVER
btnBack.addEventListener('click', () => {
    window.location.href = userRole === 'doctor' ? 'dashboard-dr.html' : 'dashboard-paciente.html';
});