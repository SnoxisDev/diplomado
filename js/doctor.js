// js/doctor.js - CÓDIGO COMPLETO Y CORREGIDO
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIABLES GLOBALES
let selectedPatientId = null; // Aquí guardamos a quién le vamos a asignar el ejercicio

// ELEMENTOS DEL DOM (HTML)
const bellBtn = document.getElementById('bellBtn');
const dropdown = document.getElementById('dropdownMenu');
const badge = document.getElementById('notificationBadge');
const reqList = document.getElementById('requestsList');
const logoutBtn = document.getElementById('logoutBtn');

// --------------------------------------------------------
// 1. LÓGICA DE LA CAMPANA (NOTIFICACIONES)
// --------------------------------------------------------

// Abrir/Cerrar menú al tocar la campana
if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que se cierre al instante
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    });
}

// Cerrar el menú si haces clic en cualquier otro lado de la pantalla
document.addEventListener('click', () => {
    if (dropdown) dropdown.style.display = 'none';
});

// Cargar solicitudes pendientes (La bandeja de entrada)
async function loadIncomingRequests() {
    if (!reqList) return; // Si no existe el elemento, no hacemos nada

    try {
        const q = query(
            collection(db, "requests"),
            where("id_doctor", "==", auth.currentUser.uid),
            where("estado", "==", "pendiente")
        );

        const snapshot = await getDocs(q);
        reqList.innerHTML = ""; // Limpiar lista anterior

        if (!snapshot.empty) {
            // Mostrar globito rojo con el número
            if (badge) {
                badge.innerText = snapshot.size;
                badge.style.display = "block";
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const div = document.createElement('div');
                div.style = "padding: 10px; border-bottom: 1px solid #eee;";
                div.innerHTML = `
                    <div style="font-size: 0.9em; margin-bottom: 5px;">
                        <strong>${data.nombre_paciente}</strong> quiere ser tu paciente.
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="responderSolicitud('${docSnap.id}', 'aceptado')" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8em;">Aceptar</button>
                        <button onclick="responderSolicitud('${docSnap.id}', 'rechazado')" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8em;">Rechazar</button>
                    </div>
                `;
                reqList.appendChild(div);
            });
        } else {
            if (badge) badge.style.display = "none";
            reqList.innerHTML = '<div style="padding:15px; text-align:center; color:#666;">No hay solicitudes nuevas.</div>';
        }
    } catch (e) {
        console.error("Error cargando notificaciones:", e);
    }
}

// Función global para responder (necesaria para el onclick del HTML)
window.responderSolicitud = async (reqId, respuesta) => {
    try {
        await updateDoc(doc(db, "requests", reqId), { estado: respuesta });
        alert(`Paciente ${respuesta}`);
        loadIncomingRequests(); // Recargar notificaciones
        loadMyPatients();       // Recargar lista de pacientes
    } catch (error) {
        alert("Error: " + error.message);
    }
};

// --------------------------------------------------------
// 2. CARGAR MIS PACIENTES (SOLO LOS ACEPTADOS)
// --------------------------------------------------------
async function loadMyPatients() {
    const list = document.getElementById('patientsList');
    if (!list) return;

    list.innerHTML = 'Cargando...';

    try {
        const q = query(
            collection(db, "requests"),
            where("id_doctor", "==", auth.currentUser.uid),
            where("estado", "==", "aceptado")
        );

        const snapshot = await getDocs(q);
        list.innerHTML = ""; // Limpiar para evitar duplicados

        if (snapshot.empty) {
            list.innerHTML = '<p style="padding:10px; color:#666">No tienes pacientes activos. Revisa la campana 🔔.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            // Estilos de la tarjeta de paciente
            div.className = 'patient-item'; 
            div.style = "padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center;";
            div.innerHTML = `
                <div style="width:35px; height:35px; background:#007bff; color:white; border-radius:50%; display:flex; justify-content:center; align-items:center; margin-right:10px; font-weight:bold;">
                    ${data.nombre_paciente.charAt(0)}
                </div>
                <div>
                    <strong>${data.nombre_paciente}</strong>
                    <div style="font-size:0.8em; color:green;">● Activo</div>
                </div>
            `;
            
            // Al hacer click, seleccionamos este paciente
            div.onclick = () => {
                selectedPatientId = data.id_paciente; // Guardamos el ID REAL del paciente
                
                // Efecto visual de selección
                document.querySelectorAll('.patient-item').forEach(el => el.style.background = 'none');
                div.style.background = '#e3f2fd';

                // Actualizar panel derecho
                const labelName = document.getElementById('selectedPatientName');
                const btnAssign = document.getElementById('btnAssign');
                
                if (labelName) labelName.innerHTML = `Paciente: <strong>${data.nombre_paciente}</strong>`;
                if (btnAssign) btnAssign.disabled = false;
            };

            list.appendChild(div);
        });

    } catch (error) {
        console.error("Error cargando pacientes:", error);
    }
}

// --------------------------------------------------------
// 3. ASIGNAR EJERCICIO
// --------------------------------------------------------
const assignForm = document.getElementById('assignForm');

if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!selectedPatientId) {
            alert("⚠️ Por favor selecciona un paciente de la lista izquierda primero.");
            return;
        }

        const btn = document.getElementById('btnAssign');
        const exercise = document.getElementById('exerciseSelect').value;
        const reps = document.getElementById('repsMeta').value;

        btn.innerText = "Enviando...";
        btn.disabled = true;

        try {
            // Guardamos la tarea en Firestore
            await addDoc(collection(db, "assignments"), {
                id_doctor: auth.currentUser.uid,
                id_paciente: selectedPatientId, // Usamos el ID seleccionado
                tipo_ejercicio: exercise,
                reps_meta: parseInt(reps),
                estado: "pendiente",
                fecha: new Date(),
                reps_realizadas: 0 // Iniciamos en 0
            });

            alert("✅ Rutina enviada exitosamente.");
            
        } catch (error) {
            console.error(error);
            alert("Error al asignar: " + error.message);
        }

        btn.innerText = "Asignar Ejercicio";
        btn.disabled = false;
    });
}

// --------------------------------------------------------
// 4. HISTORIAL Y REPORTES (CORREGIDO)
// --------------------------------------------------------
const btnRefreshHistory = document.getElementById('btnRefreshHistory');

async function loadHistory() {
    const historyTable = document.getElementById('historyTableBody');
    if (!historyTable) return;

    historyTable.innerHTML = "<tr><td colspan='5'>Cargando resultados...</td></tr>";

    try {
        // Buscamos SOLO ejercicios completados de ESTE doctor
        const q = query(
            collection(db, "assignments"),
            where("id_doctor", "==", auth.currentUser.uid),
            where("estado", "==", "completado")
        );

        const snapshot = await getDocs(q);
        historyTable.innerHTML = "";

        if (snapshot.empty) {
            historyTable.innerHTML = "<tr><td colspan='5'>No hay ejercicios completados aún.</td></tr>";
            return;
        }

        // Para cada resultado, necesitamos buscar el nombre del paciente
        // (Nota: Podríamos haber guardado el nombre en assignments, pero lo buscaremos ahora)
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            let nombrePaciente = "Paciente";

            // Buscar nombre real en la colección users
            try {
                const userSnap = await getDoc(doc(db, "users", data.id_paciente));
                if (userSnap.exists()) {
                    nombrePaciente = userSnap.data().nombre;
                }
            } catch (err) {
                console.log("No pude leer el nombre del usuario", err);
            }

            const fecha = new Date(data.fecha_completado.seconds * 1000).toLocaleDateString();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nombrePaciente}</td>
                <td>${data.tipo_ejercicio}</td>
                <td><strong>${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
                <td>${fecha}</td>
                <td>
                    <button onclick="generarPDF('${nombrePaciente}', '${data.tipo_ejercicio}', '${data.reps_realizadas}', '${fecha}')" style="cursor:pointer;">📄 PDF</button>
                    <button onclick="enviarWhatsApp('${nombrePaciente}', '${data.tipo_ejercicio}')" style="cursor:pointer;">📱 W.App</button>
                </td>
            `;
            historyTable.appendChild(row);
        }

    } catch (error) {
        console.error("Error historial:", error);
        historyTable.innerHTML = "<tr><td colspan='5'>Error cargando datos.</td></tr>";
    }
}

if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', loadHistory);
}

// Funciones globales para los botones de la tabla
window.generarPDF = (nombre, ejercicio, reps, fecha) => {
    if (!window.jspdf) {
        alert("Error: Librería PDF no cargada. Revisa tu internet.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Reporte TeleRehab", 20, 20);
    doc.setFontSize(12);
    doc.text(`Paciente: ${nombre}`, 20, 40);
    doc.text(`Ejercicio: ${ejercicio}`, 20, 50);
    doc.text(`Repeticiones logradas: ${reps}`, 20, 60);
    doc.text(`Fecha: ${fecha}`, 20, 70);
    doc.text(`Validado por IA ✅`, 20, 90);
    doc.save(`Reporte_${nombre}.pdf`);
};

window.enviarWhatsApp = (nombre, ejercicio) => {
    const texto = `Hola ${nombre}, aquí tienes tu reporte de ${ejercicio}. ¡Buen trabajo!`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
};

// --------------------------------------------------------
// 5. CERRAR SESIÓN Y ARRANQUE
// --------------------------------------------------------
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'index.html');
    });
}

// Escuchar si el usuario está logueado
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Doctor conectado:", user.email);
        loadIncomingRequests(); // Cargar notificaciones
        loadMyPatients();       // Cargar lista de pacientes
        loadHistory();          // Cargar historial
    } else {
        window.location.href = 'index.html';
    }
});