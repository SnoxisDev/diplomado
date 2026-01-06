import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const directorySection = document.getElementById('directorySection');
const exercisesSection = document.getElementById('exercisesSection');
const doctorsList = document.getElementById('doctorsList');
const exercisesList = document.getElementById('exercisesList');

// Verificar Estado del Paciente
async function checkStatus(user) {
    // 1. Obtener nombre del paciente
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let pacienteNombre = "Paciente";
    if (userDoc.exists()) {
        pacienteNombre = userDoc.data().nombre;
    }
    
    // Ponemos el nombre por defecto
    document.getElementById('userName').innerText = pacienteNombre;

    // 2. Buscar si tiene doctor (Aceptado o Pendiente)
    const q = query(
        collection(db, "requests"),
        where("id_paciente", "==", user.uid)
    );
    
    const snapshot = await getDocs(q);

    let tieneDoctor = false;
    let doctorName = "";
    let requestId = ""; // ID de la solicitud para poder borrarla luego

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.estado === 'aceptado') {
            tieneDoctor = true;
            doctorName = data.nombre_doctor;
            requestId = doc.id;
        } else if (data.estado === 'pendiente') {
            // Si está pendiente, le decimos que espere
            exercisesSection.style.display = 'block';
            directorySection.style.display = 'none';
            exercisesList.innerHTML = `
                <div class="task-card" style="border-left:5px solid orange">
                    <h3>⏳ Solicitud Enviada</h3>
                    <p>Esperando a que el <strong>${data.nombre_doctor}</strong> te acepte.</p>
                    <button onclick="dejarDoctor('${doc.id}')" style="background:none; border:none; color:red; cursor:pointer; margin-top:10px; text-decoration:underline;">
                        (Cancelar solicitud)
                    </button>
                </div>`;
            return; // Salimos de la función
        }
    });

    if (tieneDoctor) {
        // CASO 1: YA TIENE DOCTOR
        // Actualizamos el título para mostrar quién lo atiende y el botón de cambiar
        document.getElementById('userName').innerHTML = `
            ${pacienteNombre} 
            <br><small style="color:#666; font-size:0.6em; font-weight:normal;">
                Atendido por: Dr. ${doctorName} 
                <a href="#" onclick="dejarDoctor('${requestId}')" style="color:red; margin-left:10px; text-decoration:underline;">(Cambiar)</a>
            </small>
        `;

        directorySection.style.display = 'none';
        exercisesSection.style.display = 'block';
        loadAssignments(user);

    } else if (exercisesList.innerHTML.includes("Solicitud Enviada")) {
        // Si ya mostramos el mensaje de pendiente arriba, no hacemos nada más
    } else {
        // CASO 2: NO TIENE DOCTOR NI SOLICITUD -> MOSTRAR DIRECTORIO
        directorySection.style.display = 'block';
        exercisesSection.style.display = 'none';
        loadDoctors(user.uid);
    }
}

// 2. Cargar Ejercicios
async function loadAssignments(user) {
    const q = query(
        collection(db, "assignments"), 
        where("id_paciente", "==", user.uid),
        where("estado", "==", "pendiente")
    );

    const snapshot = await getDocs(q);
    exercisesList.innerHTML = "";

    if (snapshot.empty) {
        // AQUÍ ESTABA EL ERROR ANTES. Ahora le decimos que espere, no que busque otro doctor.
        exercisesList.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <h2>🎉 ¡Todo al día!</h2>
                <p>No tienes ejercicios pendientes por ahora.</p>
                <p>Tu fisioterapeuta te enviará nuevas rutinas pronto.</p>
            </div>
        `;
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const nombreEj = data.tipo_ejercicio.replace('_', ' ').toUpperCase();
        
        const div = document.createElement('div');
        div.className = 'task-card';
        // Estilos inline para asegurar diseño sin CSS extra
        div.style = "background: white; padding: 20px; margin-bottom: 15px; border-radius: 10px; border-left: 5px solid #007bff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;";
        
        div.innerHTML = `
            <div>
                <h3 style="margin:0; color:#333;">${nombreEj}</h3>
                <p style="margin:5px 0; color:#666">Meta: <strong>${data.reps_meta} repeticiones</strong></p>
            </div>
            <button onclick="window.location.href='monitor.html?id=${docSnap.id}&meta=${data.reps_meta}&tipo=${data.tipo_ejercicio}'" 
                style="background:#28a745; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">
                ▶ COMENZAR
            </button>
        `;
        exercisesList.appendChild(div);
    });
}

// 3. Cargar Doctores
async function loadDoctors() {
    doctorsList.innerHTML = '<p>Cargando especialistas...</p>';
    
    // Solo mostramos doctores si NO hay relación activa (manejado por checkStatus)
    try {
        const q = query(collection(db, "users"), where("rol", "==", "doctor"));
        const snapshot = await getDocs(q);
        doctorsList.innerHTML = "";

        snapshot.forEach(docSnap => {
            const drData = docSnap.data();
            const card = document.createElement('div');
            card.className = 'doctor-card'; // Clase CSS del día anterior
            card.innerHTML = `
                <div class="doc-avatar" style="margin: 0 auto 15px auto;">Dr</div>
                <h3>${drData.nombre}</h3>
                <button class="btn-request" onclick="enviarSolicitud('${docSnap.id}', '${drData.nombre}')">Solicitar Atención</button>
            `;
            doctorsList.appendChild(card);
        });
    } catch (e) { console.error(e); }
}

// 4. Enviar Solicitud (CON ANTI-DUPLICADO)
window.enviarSolicitud = async (doctorId, doctorName) => {
    const patientId = auth.currentUser.uid;
    const patientName = document.getElementById('userName').innerText;

    if(!confirm(`¿Enviar solicitud al ${doctorName}?`)) return;

    // VERIFICACIÓN DOBLE: Verificar si ya existe solicitud antes de crearla
    // (Aunque checkStatus ayuda, esto es seguridad extra)
    const q = query(collection(db, "requests"), where("id_paciente", "==", patientId), where("id_doctor", "==", doctorId));
    const snap = await getDocs(q);
    
    if(!snap.empty) {
        alert("⚠️ Ya tienes una solicitud pendiente o activa con este doctor.");
        window.location.reload();
        return;
    }

    try {
        await addDoc(collection(db, "requests"), {
            id_doctor: doctorId, nombre_doctor: doctorName,
            id_paciente: patientId, nombre_paciente: patientName,
            estado: "pendiente", fecha: new Date()
        });
        alert("Solicitud enviada exitosamente.");
        window.location.reload(); // Recargar para que checkStatus actualice la vista
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));

// Init
auth.onAuthStateChanged(user => {
    if (user) checkStatus(user);
    else window.location.href = 'index.html';
});

// Función para borrar la relación con el doctor
window.dejarDoctor = async (reqId) => {
    if(confirm("¿Seguro que quieres dejar a este doctor o cancelar la solicitud?")) {
        try {
            await deleteDoc(doc(db, "requests", reqId));
            alert("Listo. Ahora puedes elegir un nuevo doctor.");
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
    }
}