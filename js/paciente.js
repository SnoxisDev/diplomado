import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const directorySection = document.getElementById('directorySection');
const exercisesSection = document.getElementById('exercisesSection');
const doctorsList = document.getElementById('doctorsList');
const exercisesList = document.getElementById('exercisesList');
const statRutinas = document.getElementById('stat-rutinas-pendientes');
const statDoctorName = document.getElementById('stat-doctor-name');
const badgeCountPending = document.getElementById('badgeCountPending');
const assignedDoctorBox = document.getElementById('assignedDoctorBox');
const assignedDoctorText = document.getElementById('assignedDoctorText');
const btnCambiarDoctor = document.getElementById('btnCambiarDoctor');
const userStatusBadge = document.getElementById('userStatusBadge');
const heroAvatarLarge = document.getElementById('heroAvatarLarge');
const headerAvatar = document.getElementById('headerAvatar');

let todosLosDoctores = [];

// 1. Verificar Estado del Paciente
async function checkStatus(user) {
    cargarNotificaciones(user.uid);
    
    // Obtener datos del paciente
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let pacienteNombre = "Paciente";
    
    if (userDoc.exists()) {
        const uData = userDoc.data();
        pacienteNombre = uData.nombre || "Paciente";
        
        // Cargar foto de perfil si existe
        if (uData.photoUrl) {
            if (headerAvatar) headerAvatar.src = uData.photoUrl;
            if (heroAvatarLarge) {
                heroAvatarLarge.innerHTML = `<img src="${uData.photoUrl}" alt="${pacienteNombre}">`;
            }
        } else {
            const initial = pacienteNombre.charAt(0).toUpperCase();
            if (heroAvatarLarge) heroAvatarLarge.innerHTML = initial;
        }
    }
    
    // Nombre en el saludo
    const lblUserName = document.getElementById('userName');
    if (lblUserName) lblUserName.innerText = pacienteNombre;

    // Buscar si tiene doctor (Aceptado o Pendiente)
    const q = query(
        collection(db, "requests"),
        where("id_paciente", "==", user.uid)
    );
    
    const snapshot = await getDocs(q);

    let tieneDoctor = false;
    let doctorName = "";
    let requestId = "";

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.estado === 'aceptado') {
            tieneDoctor = true;
            doctorName = data.nombre_doctor;
            requestId = docSnap.id;
        } else if (data.estado === 'pendiente') {
            // Caso Solicitud en espera
            if (exercisesSection) exercisesSection.style.display = 'block';
            if (directorySection) directorySection.style.display = 'none';
            if (assignedDoctorBox) assignedDoctorBox.style.display = 'none';

            if (userStatusBadge) {
                userStatusBadge.className = 'hero-status-pill status-waiting';
                userStatusBadge.innerHTML = '<i class="fa-solid fa-clock"></i> Solicitud en Espera';
            }

            if (statDoctorName) statDoctorName.innerText = "En espera...";
            if (statRutinas) statRutinas.innerText = "0";
            if (badgeCountPending) badgeCountPending.innerText = "0 tareas";

            if (exercisesList) {
                exercisesList.innerHTML = `
                    <div class="pending-request-card">
                        <div class="pending-spinner-box">
                            <i class="fa-solid fa-hourglass-half"></i>
                        </div>
                        <h3>Solicitud Enviada</h3>
                        <p>Tu solicitud fue enviada al <strong>${data.nombre_doctor}</strong>. El especialista evaluará tu caso para programar tus rutinas asistidas.</p>
                        <button onclick="dejarDoctor('${docSnap.id}')" class="btn-change-doctor" style="border-color: var(--danger); color: var(--danger);">
                            <i class="fa-solid fa-xmark"></i> Cancelar Solicitud
                        </button>
                    </div>`;
            }
        }
    });

    if (tieneDoctor) {
        // CASO 1: TIENE DOCTOR ACTIVO
        if (userStatusBadge) {
            userStatusBadge.className = 'hero-status-pill status-active';
            userStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Tratamiento Activo';
        }

        if (statDoctorName) statDoctorName.innerText = `Dr. ${doctorName}`;

        if (assignedDoctorBox) {
            assignedDoctorBox.style.display = 'flex';
            if (assignedDoctorText) assignedDoctorText.innerText = `Dr. ${doctorName}`;
            if (btnCambiarDoctor) {
                btnCambiarDoctor.onclick = () => dejarDoctor(requestId);
            }
        }

        if (directorySection) directorySection.style.display = 'none';
        if (exercisesSection) exercisesSection.style.display = 'block';
        
        loadAssignments(user);

    } else if (exercisesList && exercisesList.innerHTML.includes("Solicitud Enviada")) {
        // Mensaje de pendiente ya renderizado
    } else {
        // CASO 2: NO TIENE DOCTOR -> MOSTRAR DIRECTORIO
        if (userStatusBadge) {
            userStatusBadge.className = 'hero-status-pill status-search';
            userStatusBadge.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Sin Especialista';
        }

        if (statDoctorName) statDoctorName.innerText = "Sin asignar";
        if (statRutinas) statRutinas.innerText = "0";
        if (badgeCountPending) badgeCountPending.innerText = "0 tareas";

        if (assignedDoctorBox) assignedDoctorBox.style.display = 'none';
        if (directorySection) directorySection.style.display = 'block';
        if (exercisesSection) exercisesSection.style.display = 'none';
        
        loadDoctors(user.uid);
    }
}

// 2. Cargar Ejercicios Pendientes
async function loadAssignments(user) {
    const q = query(
        collection(db, "assignments"), 
        where("id_paciente", "==", user.uid),
        where("estado", "==", "pendiente")
    );

    const snapshot = await getDocs(q);
    if (!exercisesList) return;
    exercisesList.innerHTML = "";

    const count = snapshot.size;
    if (statRutinas) statRutinas.innerText = count;
    if (badgeCountPending) badgeCountPending.innerText = `${count} ${count === 1 ? 'tarea' : 'tareas'}`;

    if (snapshot.empty) {
        exercisesList.innerHTML = `
            <div class="empty-routine-box">
                <div class="empty-routine-icon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h3>¡Excelente trabajo! Todo al día</h3>
                <p>No tienes ejercicios pendientes por ahora. Tu fisioterapeuta revisará tu evolución y te asignará nuevas rutinas pronto.</p>
                <a href="biblioteca.html" class="btn" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <i class="fa-solid fa-book-open"></i> Explorar Ejercicios en la Biblioteca
                </a>
            </div>
        `;
        return;
    }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const tipoLimpio = (data.tipo_ejercicio || "ejercicio").toLowerCase();
        const nombreEj = tipoLimpio.replace('_', ' ').toUpperCase();
        const lado = (data.lado || 'derecho').toLowerCase();
        const ladoTexto = lado === 'izquierdo' ? 'Lado Izquierdo' : 'Lado Derecho';
        
        // Icono y color temático por ejercicio
        let iconoClase = "fa-solid fa-dumbbell";
        let colorFondo = "rgba(59, 130, 246, 0.15)";
        let colorIcono = "#3b82f6";
        let categoria = "Tren Superior / Bíceps";

        if (tipoLimpio.includes("elevacion_lateral") || tipoLimpio.includes("lateral")) {
            iconoClase = "fa-solid fa-person-arrow-up-from-line";
            colorFondo = "rgba(245, 158, 11, 0.15)";
            colorIcono = "#f59e0b";
            categoria = "Hombro / Abducción";
        } else if (tipoLimpio.includes("elevacion_frontal") || tipoLimpio.includes("frontal")) {
            iconoClase = "fa-solid fa-hand-holding-hand";
            colorFondo = "rgba(139, 92, 246, 0.15)";
            colorIcono = "#8b5cf6";
            categoria = "Hombro / Deltoides";
        } else if (tipoLimpio.includes("sentadilla") || tipoLimpio.includes("rodilla") || tipoLimpio.includes("pierna")) {
            iconoClase = "fa-solid fa-person-walking";
            colorFondo = "rgba(16, 185, 129, 0.15)";
            colorIcono = "#10b981";
            categoria = "Tren Inferior / Cuádriceps";
        }
        
        const card = document.createElement('div');
        card.className = 'modern-exercise-card';
        
        card.innerHTML = `
            <div class="exercise-main-content">
                <div class="exercise-icon-avatar" style="background: ${colorFondo}; color: ${colorIcono};">
                    <i class="${iconoClase}"></i>
                </div>
                <div class="exercise-details-box">
                    <h3>${nombreEj}</h3>
                    <div class="exercise-meta-pills">
                        <span class="pill-meta-target">
                            <i class="fa-solid fa-bullseye"></i> Meta: ${data.reps_meta} reps
                        </span>
                        <span class="pill-meta-badge">
                            <i class="fa-solid fa-tag"></i> ${categoria}
                        </span>
                        <span class="pill-meta-badge" style="background: rgba(59, 130, 246, 0.12); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.25);">
                            <i class="fa-solid fa-arrows-left-right"></i> ${ladoTexto}
                        </span>
                    </div>
                </div>
            </div>

            <div class="exercise-actions-group">
                <button onclick="window.location.href='biblioteca.html?ver=${data.tipo_ejercicio}'" class="btn-exercise-tutorial" title="Ver explicación y video">
                    <i class="fa-solid fa-video"></i> Tutorial
                </button>
                <button onclick="window.location.href='monitor.html?id=${docSnap.id}&meta=${data.reps_meta}&tipo=${data.tipo_ejercicio}&lado=${lado}'" class="btn-exercise-start" title="Abrir cámara y comenzar">
                    <i class="fa-solid fa-play"></i> Iniciar con IA
                </button>
            </div>
        `;
        exercisesList.appendChild(card);
    });
}

// 3. Cargar Directorio de Fisioterapeutas
async function loadDoctors(patientUid) {
    if (!doctorsList) return;
    doctorsList.innerHTML = '<p style="text-align:center; color: var(--text-muted); grid-column: 1 / -1;">Cargando especialistas disponibles...</p>';
    
    try {
        const q = query(collection(db, "users"), where("rol", "==", "doctor"));
        const snapshot = await getDocs(q);
        
        todosLosDoctores = [];
        snapshot.forEach(d => todosLosDoctores.push({ id: d.id, ...d.data() }));

        renderDoctorsList(todosLosDoctores);

        // Buscador interactivo
        const searchInput = document.getElementById('doctorSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const filtrados = todosLosDoctores.filter(docItem => 
                    (docItem.nombre && docItem.nombre.toLowerCase().includes(term)) ||
                    (docItem.email && docItem.email.toLowerCase().includes(term))
                );
                renderDoctorsList(filtrados);
            });
        }

    } catch (e) {
        console.error("Error al cargar doctores:", e);
        doctorsList.innerHTML = '<p style="text-align:center; color: var(--danger); grid-column: 1 / -1;">Error al cargar la lista de doctores.</p>';
    }
}

function renderDoctorsList(lista) {
    if (!doctorsList) return;
    doctorsList.innerHTML = "";

    if (lista.length === 0) {
        doctorsList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="fa-solid fa-user-slash" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i>
                No se encontraron fisioterapeutas con ese nombre.
            </div>`;
        return;
    }

    lista.forEach(drData => {
        const initial = drData.nombre ? drData.nombre.charAt(0).toUpperCase() : "D";
        const avatarHTML = drData.photoUrl 
            ? `<img src="${drData.photoUrl}" alt="${drData.nombre}" style="width: 100%; height: 100%; object-fit: cover;">`
            : initial;

        const card = document.createElement('div');
        card.className = 'modern-doctor-card';
        card.innerHTML = `
            <div class="doc-avatar-badge">
                ${avatarHTML}
            </div>
            <h3>${drData.nombre || 'Dr. Fisioterapeuta'}</h3>
            <span class="doc-role-subtitle">
                <i class="fa-solid fa-badge-check"></i> Fisioterapeuta Certificado
            </span>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 15px 0;">
                Especialista en rehabilitación biomecánica asistida por cámara web.
            </p>
            <button class="btn-request-doctor" onclick="enviarSolicitud('${drData.id}', '${drData.nombre}')">
                <i class="fa-solid fa-user-plus"></i> Solicitar Tratamiento
            </button>
        `;
        doctorsList.appendChild(card);
    });
}

// 4. Enviar Solicitud de Atención
window.enviarSolicitud = async (doctorId, doctorName) => {
    const patientId = auth.currentUser.uid;
    const patientName = document.getElementById('userName').innerText;

    const result = await Swal.fire({
        title: `¿Solicitar atención al Dr. ${doctorName}?`,
        text: "El fisioterapeuta recibirá una notificación para evaluar tu caso y prescribir tus ejercicios.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, enviar solicitud',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    const q = query(
        collection(db, "requests"), 
        where("id_paciente", "==", patientId), 
        where("id_doctor", "==", doctorId)
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
        return Swal.fire('Aviso', 'Ya tienes una solicitud pendiente o activa con este doctor.', 'warning')
        .then(() => window.location.reload());
    }

    try {
        await addDoc(collection(db, "requests"), {
            id_doctor: doctorId,
            nombre_doctor: doctorName,
            id_paciente: patientId,
            nombre_paciente: patientName,
            estado: "pendiente",
            fecha: new Date()
        });

        // Registrar en bitácora
        await addDoc(collection(db, "bitacora"), {
            fecha: new Date(),
            usuario_id: patientId,
            accion: "NUEVA SOLICITUD",
            detalle: `El paciente ${patientName} solicitó atención al Dr. ${doctorName}`
        });

        // Notificar al doctor
        await addDoc(collection(db, "notificaciones"), {
            usuario_id: doctorId,
            titulo: "Nueva Solicitud de Paciente",
            mensaje: `${patientName} ha solicitado comenzar tratamiento contigo.`,
            leida: false,
            fecha: new Date()
        });
        
        Swal.fire({
            title: '¡Solicitud Enviada!',
            text: `El Dr. ${doctorName} ha sido notificado. Espera su aprobación para comenzar tus rutinas.`,
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        }).then(() => window.location.reload());

    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// 5. Dejar Doctor / Cambiar de Especialista
window.dejarDoctor = async (reqId) => {
    const result = await Swal.fire({
        title: '¿Cambiar de Especialista?',
        text: "Se cancelará la vinculación actual con este doctor y podrás seleccionar uno nuevo del directorio.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "requests", reqId));
            Swal.fire('Listo', 'Ahora puedes seleccionar un nuevo especialista del directorio.', 'success')
            .then(() => window.location.reload());
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
};

// 6. Cargar Notificaciones en la Campanita
async function cargarNotificaciones(uid) {
    const q = query(collection(db, "notificaciones"), where("usuario_id", "==", uid));
    const snap = await getDocs(q);
    
    const dropdown = document.getElementById('requestsList');
    const badge = document.getElementById('notificationBadge');
    
    if (!snap.empty) {
        dropdown.innerHTML = "";
        if (badge) badge.style.display = "block";
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            dropdown.innerHTML += `
                <div style="padding:14px; border-bottom:1px solid #334155; color: white;">
                    <strong style="color: var(--primary); font-size: 0.9rem;">${data.titulo}</strong><br>
                    <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; display: block; margin-top: 3px;">${data.mensaje}</span>
                </div>
            `;
        });
    } else {
        if (badge) badge.style.display = "none";
    }
}

// Evento Campanita
const bellBtn = document.getElementById('bellBtn');
if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('dropdownMenu');
        if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
}
document.addEventListener('click', () => {
    const menu = document.getElementById('dropdownMenu');
    if (menu) menu.style.display = 'none';
});

// Cerrar sesión
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
}

// Inicialización y Seguridad de Rutas
auth.onAuthStateChanged(async (user) => {
    if (user) {
        if (user.email === "admin@gmail.com") {
            window.location.href = 'dashboard-admin.html';
            return;
        }

        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists() && docSnap.data().rol === "paciente") {
            checkStatus(user);
        } else {
            window.location.href = 'dashboard-dr.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});
