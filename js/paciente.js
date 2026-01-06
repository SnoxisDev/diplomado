import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const directorySection = document.getElementById('directorySection');
const exercisesSection = document.getElementById('exercisesSection');
const doctorsList = document.getElementById('doctorsList');

// 1. Cerrar Sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// 2. Verificar Estado del Paciente
async function checkStatus(user) {
    // Ponemos el nombre
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        document.getElementById('userName').innerText = userDoc.data().nombre;
    }

    // Buscamos si ya tiene doctor asignado (Buscamos en una coleccion 'connections')
    // OJO: Para hacerlo simple hoy, vamos a asumir que si NO tiene ejercicios, le mostramos doctores.
    // Pero lo correcto es buscar solicitudes.
    
    // Paso A: Cargar Doctores Disponibles
    loadDoctors(user.uid);
    
    // Paso B: Cargar Ejercicios (si los tiene)
    loadAssignments(user);
}

// 3. Cargar Lista de Doctores (Directorio)
async function loadDoctors(patientId) {
    directorySection.style.display = 'block'; // Mostramos el directorio
    doctorsList.innerHTML = '';

    try {
        // Buscar todos los usuarios que sean DOCTORES
        const q = query(collection(db, "users"), where("rol", "==", "doctor"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            doctorsList.innerHTML = "<p>No hay doctores registrados en la plataforma.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const drData = docSnap.data();
            const drId = docSnap.id;

            // Crear Tarjeta
            const card = document.createElement('div');
            card.className = 'doctor-card';
            card.innerHTML = `
                <div class="doc-avatar">Dr</div>
                <h3>${drData.nombre}</h3>
                <p style="color:#666; font-size:0.9em;">Fisioterapeuta Certificado</p>
                <button class="btn-request" onclick="enviarSolicitud('${drId}', '${drData.nombre}')" id="btn-${drId}">
                    Solicitar Atención
                </button>
            `;
            doctorsList.appendChild(card);
        });

    } catch (error) {
        console.error("Error cargando doctores:", error);
    }
}

// 4. Función Global para Enviar Solicitud
window.enviarSolicitud = async (doctorId, doctorName) => {
    const btn = document.getElementById(`btn-${doctorId}`);
    const patientId = auth.currentUser.uid;
    const patientName = document.getElementById('userName').innerText;

    if(!confirm(`¿Quieres enviar una solicitud al ${doctorName}?`)) return;

    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        // Guardamos en la colección 'requests'
        await addDoc(collection(db, "requests"), {
            id_doctor: doctorId,
            nombre_doctor: doctorName,
            id_paciente: patientId,
            nombre_paciente: patientName,
            estado: "pendiente", // pendiente, aceptado, rechazado
            fecha: new Date()
        });

        alert("✅ Solicitud enviada. Espera a que el doctor te acepte.");
        btn.innerText = "Solicitud Enviada";

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
        btn.disabled = false;
        btn.innerText = "Solicitar Atención";
    }
};

// 5. Cargar Ejercicios (Igual que antes, pero verificando visibilidad)
async function loadAssignments(user) {
    const list = document.getElementById('exercisesList');
    
    const q = query(
        collection(db, "assignments"), 
        where("id_paciente", "==", user.uid),
        where("estado", "==", "pendiente")
    );

    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
        list.innerHTML = "<p>No tienes ejercicios activos. Busca un doctor arriba.</p>";
        return;
    }
    
    // Si tiene ejercicios, ocultamos el directorio para que se enfoque en trabajar
    directorySection.style.display = 'none'; 
    exercisesSection.style.display = 'block';

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const nombreEj = data.tipo_ejercicio.replace('_', ' ').toUpperCase();
        
        const div = document.createElement('div');
        div.className = 'task-card'; // Asegurate de tener este estilo en css
        div.style = "background: white; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 5px solid #ffc107; display: flex; justify-content: space-between; align-items: center;";
        
        div.innerHTML = `
            <div>
                <h3 style="margin:0">${nombreEj}</h3>
                <small>Meta: ${data.reps_meta} reps</small>
            </div>
            <button onclick="window.location.href='monitor.html?id=${docSnap.id}&meta=${data.reps_meta}&tipo=${data.tipo_ejercicio}'" 
                style="background:#007bff; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                ▶ INICIAR
            </button>
        `;
        list.appendChild(div);
    });
}

// Iniciar
auth.onAuthStateChanged(user => {
    if (user) checkStatus(user);
    else window.location.href = 'index.html';
});