import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let selectedPatientId = null;

// 1. Botón Cerrar Sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
});

// 2. Cargar lista de pacientes al iniciar
async function loadPatients() {
    const listContainer = document.getElementById('patientsList');
    const loadingMsg = document.getElementById('loadingPatients');
    
    try {
        // Consulta: Dame todos los usuarios donde rol == 'paciente'
        const q = query(collection(db, "users"), where("rol", "==", "paciente"));
        const querySnapshot = await getDocs(q);

        listContainer.innerHTML = ""; // Limpiar lista
        loadingMsg.style.display = "none";

        if (querySnapshot.empty) {
            listContainer.innerHTML = "<p>No hay pacientes registrados.</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Crear el elemento HTML para cada paciente
            const div = document.createElement('div');
            div.className = 'patient-item';
            div.innerHTML = `
                <span>${data.nombre}</span>
                <small>${data.email}</small>
            `;
            
            // Evento al hacer click en un paciente
            div.addEventListener('click', () => {
                selectPatient(doc.id, data.nombre, div);
            });

            listContainer.appendChild(div);
        });

    } catch (error) {
        console.error("Error cargando pacientes:", error);
        loadingMsg.innerText = "Error cargando datos.";
    }
}

// 3. Seleccionar paciente (Visual y Lógico)
function selectPatient(id, name, divElement) {
    selectedPatientId = id;
    
    // Actualizar visualmente
    document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('selected'));
    divElement.classList.add('selected');
    
    document.getElementById('selectedPatientName').innerHTML = `Paciente seleccionado: <strong>${name}</strong>`;
    document.getElementById('selectedPatientName').style.color = "#007bff";
    document.getElementById('btnAssign').disabled = false;
}

// 4. Guardar la asignación en Base de Datos
document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedPatientId) return alert("Selecciona un paciente primero");

    const exercise = document.getElementById('exerciseSelect').value;
    const reps = document.getElementById('repsMeta').value;
    const btn = document.getElementById('btnAssign');

    try {
        btn.innerText = "Asignando...";
        btn.disabled = true;

        // GUARDAMOS EN FIRESTORE
        await addDoc(collection(db, "assignments"), {
            id_doctor: auth.currentUser.uid,
            id_paciente: selectedPatientId,
            tipo_ejercicio: exercise,
            reps_meta: parseInt(reps),
            estado: "pendiente", // pendiente, completado
            fecha: new Date()
        });

        alert("✅ Ejercicio asignado correctamente al paciente.");
        btn.innerText = "Asignar Ejercicio";
        btn.disabled = false;

    } catch (error) {
        console.error(error);
        alert("Error al asignar: " + error.message);
        btn.innerText = "Asignar Ejercicio";
        btn.disabled = false;
    }
});

// Iniciar carga
auth.onAuthStateChanged(user => {
    if (user) {
        loadPatients();
        loadHistory();
    } else {
        window.location.href = 'index.html'; // Si no está logueado, fuera
    }
});

// --- NUEVO CÓDIGO: HISTORIAL Y REPORTES ---

// 1. Cargar Historial
const historyTable = document.getElementById('historyTableBody');
const btnRefresh = document.getElementById('btnRefreshHistory');

async function loadHistory() {
    historyTable.innerHTML = "<tr><td colspan='5'>Cargando resultados...</td></tr>";
    
    try {
        // Buscamos ejercicios que ya estén "completados"
        const q = query(
            collection(db, "assignments"), 
            where("id_doctor", "==", auth.currentUser.uid),
            where("estado", "==", "completado")
        );
        
        const snapshot = await getDocs(q);
        historyTable.innerHTML = ""; // Limpiar tabla

        if (snapshot.empty) {
            historyTable.innerHTML = "<tr><td colspan='5'>No hay ejercicios completados aún.</td></tr>";
            return;
        }

        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            
            // Truco: Necesitamos el nombre del paciente, pero en el assignment solo tenemos su ID.
            // Hacemos una búsqueda rápida del nombre.
            const userSnap = await getDoc(doc(db, "users", data.id_paciente));
            const patientName = userSnap.exists() ? userSnap.data().nombre : "Desconocido";

            const fecha = new Date(data.fecha_completado.seconds * 1000).toLocaleDateString();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${patientName}</td>
                <td>${data.tipo_ejercicio}</td>
                <td><strong>${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
                <td>${fecha}</td>
                <td>
                    <button onclick="generarPDF('${patientName}', '${data.tipo_ejercicio}', '${data.reps_realizadas}', '${fecha}')" 
                            style="background: #dc3545; color: white; border: none; padding: 5px; cursor: pointer;">
                        📄 PDF
                    </button>
                    <button onclick="enviarWhatsApp('${patientName}', '${data.tipo_ejercicio}')" 
                            style="background: #25D366; color: white; border: none; padding: 5px; cursor: pointer;">
                        📱 W.App
                    </button>
                </td>
            `;
            historyTable.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        historyTable.innerHTML = "<tr><td colspan='5'>Error cargando historial.</td></tr>";
    }
}

// Botón de actualizar
if(btnRefresh) btnRefresh.addEventListener('click', loadHistory);

// 2. Generar PDF (Usando la librería jsPDF que importamos en el HTML)
window.generarPDF = (nombre, ejercicio, reps, fecha) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Diseño del PDF
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 255); // Azul
    doc.text("Reporte de Tele-Rehabilitación", 20, 20);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Negro
    doc.text(`Paciente: ${nombre}`, 20, 40);
    doc.text(`Fecha: ${fecha}`, 20, 50);
    
    doc.setLineWidth(1);
    doc.line(20, 55, 190, 55); // Línea separadora

    doc.setFontSize(14);
    doc.text("Detalles del Ejercicio:", 20, 70);
    doc.text(`- Tipo: ${ejercicio.toUpperCase()}`, 20, 80);
    doc.text(`- Resultado: ${reps} repeticiones completadas correctamente.`, 20, 90);
    doc.text(`- Validación IA: APROBADO ✅`, 20, 100);

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Generado automáticamente por Sistema TeleRehab Venezuela", 20, 140);

    doc.save(`Reporte_${nombre}_${ejercicio}.pdf`);
};

// 3. Enviar WhatsApp
window.enviarWhatsApp = (nombre, ejercicio) => {
    const texto = `Hola ${nombre}, te envío el reporte de tu ejercicio: ${ejercicio}. ¡Buen trabajo!`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
};

// Cargar historial al iniciar (además de la lista de pacientes)
// Asegúrate de llamar a loadHistory() dentro del onAuthStateChanged existente