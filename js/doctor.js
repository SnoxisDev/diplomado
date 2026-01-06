import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. CERRAR SESIÓN (Lo ponemos primero para asegurar que cargue) ---
const btnLogout = document.getElementById('logoutBtn');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'index.html');
    });
} else {
    console.error("Error: No encontré el botón 'logoutBtn' en el HTML");
}

// --- 2. BANDEJA DE ENTRADA (Solicitudes) ---
async function loadIncomingRequests() {
    const container = document.getElementById('requestsContainer');
    const list = document.getElementById('requestsList');
    
    // Verificamos que el HTML exista antes de intentar llenarlo
    if (!container || !list) {
        console.log("No encontré la caja de notificaciones en el HTML (requestsContainer)");
        return;
    }

    try {
        const q = query(
            collection(db, "requests"),
            where("id_doctor", "==", auth.currentUser.uid),
            where("estado", "==", "pendiente")
        );

        const snapshot = await getDocs(q);
        list.innerHTML = "";

        if (!snapshot.empty) {
            container.style.display = "block"; // Mostrar caja amarilla
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const div = document.createElement('div');
                div.style = "background: white; padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #ddd; display: inline-block; min-width: 200px;";
                div.innerHTML = `
                    <strong>${data.nombre_paciente}</strong>
                    <div style="margin-top:5px; display:flex; gap:5px;">
                        <button onclick="responderSolicitud('${docSnap.id}', 'aceptado')" style="background:#28a745; color:white; border:none; padding:5px 10px; cursor:pointer;">✔ Aceptar</button>
                        <button onclick="responderSolicitud('${docSnap.id}', 'rechazado')" style="background:#dc3545; color:white; border:none; padding:5px 10px; cursor:pointer;">✖ Rechazar</button>
                    </div>
                `;
                list.appendChild(div);
            });
        } else {
            container.style.display = "none";
        }
    } catch (e) {
        console.error("Error cargando solicitudes:", e);
    }
}

// Función Global para responder (necesaria para el onclick del HTML)
window.responderSolicitud = async (reqId, respuesta) => {
    try {
        await updateDoc(doc(db, "requests", reqId), { estado: respuesta });
        alert(`Paciente ${respuesta}`);
        loadIncomingRequests(); // Refrescar notificaciones
        loadMyPatients();       // Refrescar lista principal
    } catch (error) {
        alert("Error: " + error.message);
    }
};

// --- 3. CARGAR MIS PACIENTES (Solo Aceptados) ---
async function loadMyPatients() {
    const list = document.getElementById('patientsList');
    list.innerHTML = 'Cargando...';

    const q = query(
        collection(db, "requests"),
        where("id_doctor", "==", auth.currentUser.uid),
        where("estado", "==", "aceptado")
    );

    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
        list.innerHTML = '<p style="padding:10px">No tienes pacientes activos.</p>';
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'patient-item'; // Asegúrate que coincida con tu CSS
        div.style = "padding:10px; border-bottom:1px solid #eee; cursor:pointer;";
        div.innerHTML = `<strong>${data.nombre_paciente}</strong> <span style="color:green; font-size:0.8em">● Activo</span>`;
        
        // Al hacer click, activamos la selección
        div.onclick = () => {
            // Lógica simple de selección visual
            document.querySelectorAll('.patient-item').forEach(el => el.style.background = 'none');
            div.style.background = '#e3f2fd';
            
            // Habilitar panel de asignación
            const nameDisplay = document.getElementById('selectedPatientName');
            const btnAssign = document.getElementById('btnAssign');
            
            // IMPORTANTE: Guardamos el ID del paciente en una variable global del navegador para usarla al asignar
            window.selectedPatientId = data.id_paciente;

            if(nameDisplay) nameDisplay.innerHTML = `Paciente: <strong>${data.nombre_paciente}</strong>`;
            if(btnAssign) btnAssign.disabled = false;
        };
        
        list.appendChild(div);
    });
}

// --- 4. ASIGNAR EJERCICIO ---
const assignForm = document.getElementById('assignForm');
if(assignForm) {
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.selectedPatientId) return alert("Selecciona un paciente primero");

        const btn = document.getElementById('btnAssign');
        btn.disabled = true;
        btn.innerText = "Enviando...";

        const exercise = document.getElementById('exerciseSelect').value;
        const reps = document.getElementById('repsMeta').value;

        try {
            await addDoc(collection(db, "assignments"), {
                id_doctor: auth.currentUser.uid,
                id_paciente: window.selectedPatientId,
                tipo_ejercicio: exercise,
                reps_meta: parseInt(reps),
                estado: "pendiente",
                fecha: new Date()
            });
            alert("Rutina asignada exitosamente");
        } catch (error) {
            console.error(error);
            alert("Error al asignar");
        }
        btn.disabled = false;
        btn.innerText = "Asignar Ejercicio";
    });
}

// --- 5. INICIALIZACIÓN ---
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Doctor logueado: ", user.email);
        loadIncomingRequests();
        loadMyPatients();
    } else {
        window.location.href = 'index.html';
    }
});