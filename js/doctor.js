import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variables globales
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
    } else {
        window.location.href = 'index.html'; // Si no está logueado, fuera
    }
});