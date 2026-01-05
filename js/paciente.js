import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Cerrar Sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// 2. Cargar Asignaciones
async function loadAssignments(user) {
    const list = document.getElementById('exercisesList');
    const nameSpan = document.getElementById('userName');

    // A. Poner el nombre del usuario
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        nameSpan.innerText = userDoc.data().nombre;
    }

    // B. Buscar ejercicios PENDIENTES
    // Consulta: Dame assignments donde id_paciente == MI_ID y estado == 'pendiente'
    const q = query(
        collection(db, "assignments"), 
        where("id_paciente", "==", user.uid),
        where("estado", "==", "pendiente")
    );

    const snapshot = await getDocs(q);
    list.innerHTML = ""; // Limpiar mensaje de carga

    if (snapshot.empty) {
        list.innerHTML = "<p>🎉 ¡Estás al día! No tienes ejercicios pendientes.</p>";
        return;
    }

    // C. Mostrar cada ejercicio
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // Formatear nombre del ejercicio (ej: "flexion_codo" -> "Flexion Codo")
        const nombreEj = data.tipo_ejercicio.replace('_', ' ').toUpperCase();

        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <div>
                <h3 style="margin:0">${nombreEj}</h3>
                <p style="margin:5px 0; color:#666">Meta: <strong>${data.reps_meta} repeticiones</strong></p>
                <small>Asignado: ${new Date(data.fecha.seconds * 1000).toLocaleDateString()}</small>
            </div>
            <button class="btn-start" onclick="alert('Mañana conectamos la cámara para: ${nombreEj}')">
                ▶ COMENZAR
            </button>
        `;
        list.appendChild(div);
    });
}

// Iniciar solo si hay usuario logueado
auth.onAuthStateChanged(user => {
    if (user) {
        // Verificar que sea rol paciente (seguridad extra)
        // Por rapidez, confiamos en el login, pero cargamos datos
        loadAssignments(user);
    } else {
        window.location.href = 'index.html';
    }
});