import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// BITÁCORA DE AUDITORÍA
// ==========================================
async function registrarBitacora(accion, detalle) {
    try {
        await addDoc(collection(db, "bitacora"), {
            fecha: new Date(),
            usuario_id: auth.currentUser ? auth.currentUser.uid : "Doctor",
            accion: accion,
            detalle: detalle
        });
    } catch (e) {
        console.error("Error al registrar bitácora:", e);
    }
}

// VARIABLES GLOBALES
let selectedPatientId = null;
let chartInstance = null;
let listaPacientesCache = [];

// ELEMENTOS DOM
const bellBtn = document.getElementById('bellBtn');
const dropdown = document.getElementById('dropdownMenu');
const badge = document.getElementById('notificationBadge');
const reqList = document.getElementById('requestsList');
const logoutBtn = document.getElementById('logoutBtn');
const ctx = document.getElementById('patientChart').getContext('2d');
const statPacientes = document.getElementById('stat-dr-pacientes');
const statRutinas = document.getElementById('stat-dr-rutinas');
const statCompletados = document.getElementById('stat-dr-completados');
const statSolicitudes = document.getElementById('stat-dr-solicitudes');
const badgeActivePatients = document.getElementById('badgeActivePatientsCount');
const headerAvatar = document.getElementById('headerAvatar');
const heroDoctorAvatar = document.getElementById('heroDoctorAvatar');
const doctorNameHeader = document.getElementById('doctorNameHeader');

// 1. INICIALIZAR GRÁFICO PROFESIONAL
function initChart() {
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Sesión 1', 'Sesión 2', 'Sesión 3', 'Sesión 4', 'Sesión 5'],
            datasets: [{
                label: 'Repeticiones Logradas',
                data: [0, 0, 0, 0, 0],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderWidth: 3,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3b82f6',
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    labels: { color: '#94a3b8', font: { family: 'Inter', weight: 600 } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#38bdf8',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#1e293b' }, 
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } } 
                }
            }
        }
    });
}
initChart();

// 2. ACTUALIZAR GRÁFICO DEL PACIENTE SELECCIONADO
async function updateChartData(patientId) {
    const q = query(
        collection(db, "assignments"),
        where("id_paciente", "==", patientId),
        where("estado", "==", "completado"),
        orderBy("fecha_completado", "asc"),
        limit(10)
    );

    const snapshot = await getDocs(q);
    let fechas = [];
    let valores = [];

    if (snapshot.empty) {
        fechas = ["Sin sesiones completadas"]; 
        valores = [0];
    } else {
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.fecha_completado && data.fecha_completado.toDate) {
                const dateObj = data.fecha_completado.toDate();
                fechas.push(`${dateObj.getDate()}/${dateObj.getMonth() + 1}`);
            } else {
                fechas.push("Fecha N/A");
            }
            valores.push(data.reps_realizadas || 0);
        });
    }

    chartInstance.data.labels = fechas;
    chartInstance.data.datasets[0].data = valores;
    chartInstance.update();
}

// 3. INTERFAZ DE SOLICITUDES ENTRANTE (CAMPANITA)
if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
}
document.addEventListener('click', () => { 
    if (dropdown) dropdown.style.display = 'none'; 
});

async function loadIncomingRequests() {
    if (!reqList) return;
    const q = query(
        collection(db, "requests"), 
        where("id_doctor", "==", auth.currentUser.uid), 
        where("estado", "==", "pendiente")
    );
    const snapshot = await getDocs(q);
    reqList.innerHTML = "";

    const count = snapshot.size;
    if (statSolicitudes) statSolicitudes.innerText = count;

    if (!snapshot.empty) {
        if (badge) {
            badge.innerText = count; 
            badge.style.display = "block";
        }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style = "padding:12px; border-bottom:1px solid #334155; color:#f8fafc;";
            div.innerHTML = `
                <div style="font-weight: 700; font-size: 0.9rem;">${data.nombre_paciente}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">Desea comenzar rehabilitación contigo</div>
                <div style="display:flex; gap:8px;">
                    <button onclick="responderSolicitud('${docSnap.id}', 'aceptado', '${data.id_paciente}')" class="btn" style="background:#10b981; color:white; padding:4px 10px; font-size:0.75rem;">
                        <i class="fa-solid fa-check"></i> Aceptar
                    </button>
                    <button onclick="responderSolicitud('${docSnap.id}', 'rechazado', '${data.id_paciente}')" class="btn" style="background:#ef4444; color:white; padding:4px 10px; font-size:0.75rem;">
                        <i class="fa-solid fa-xmark"></i> Rechazar
                    </button>
                </div>`;
            reqList.appendChild(div);
        });
    } else {
        if (badge) badge.style.display = "none";
        reqList.innerHTML = '<div style="padding:15px; text-align:center; color:#64748b; font-size: 0.88rem;">No hay solicitudes pendientes.</div>';
    }
}

window.responderSolicitud = async (reqId, respuesta, pacienteUid) => {
    await updateDoc(doc(db, "requests", reqId), { estado: respuesta });
    
    // Notificar al paciente
    try {
        await addDoc(collection(db, "notificaciones"), {
            usuario_id: pacienteUid,
            titulo: respuesta === 'aceptado' ? "¡Solicitud Aceptada!" : "Solicitud Declinada",
            mensaje: respuesta === 'aceptado' 
                ? "El fisioterapeuta ha aceptado tu solicitud. Pronto te asignará tu primera rutina." 
                : "El doctor no puede atender tu caso en este momento.",
            leida: false,
            fecha: new Date()
        });
    } catch(e) {}

    loadIncomingRequests(); 
    loadMyPatients();
};

// 4. CARGAR PACIENTES Y BUSCADOR EN TIEMPO REAL
async function loadMyPatients() {
    const list = document.getElementById('patientsList');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Cargando lista de pacientes...</p>';
    
    const q = query(
        collection(db, "requests"), 
        where("id_doctor", "==", auth.currentUser.uid), 
        where("estado", "==", "aceptado")
    );
    const snapshot = await getDocs(q);

    listaPacientesCache = [];
    snapshot.forEach(d => {
        listaPacientesCache.push({ reqId: d.id, ...d.data() });
    });

    const totalActivos = listaPacientesCache.length;
    if (statPacientes) statPacientes.innerText = totalActivos;
    if (badgeActivePatients) badgeActivePatients.innerText = `${totalActivos} activos`;

    renderPatientsList(listaPacientesCache);

    // Conectar buscador
    const searchInput = document.getElementById('patientSearchInput');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtrados = listaPacientesCache.filter(p => 
                p.nombre_paciente && p.nombre_paciente.toLowerCase().includes(term)
            );
            renderPatientsList(filtrados);
        };
    }

    // Actualizar métricas globales de rutinas
    cargarMetricasRutinas();
}

function renderPatientsList(lista) {
    const list = document.getElementById('patientsList');
    if (!list) return;
    list.innerHTML = "";

    if (lista.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="fa-solid fa-user-clock" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                No hay pacientes que coincidan con la búsqueda.
            </div>`;
        return;
    }

    lista.forEach(data => {
        const div = document.createElement('div');
        div.className = 'patient-item';
        div.style = "padding: 12px 14px; border-radius: 10px; background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; transition: all 0.2s ease; cursor: pointer;";
        
        const avatarId = `avatar-${data.id_paciente}`;
        const initial = data.nombre_paciente ? data.nombre_paciente.charAt(0).toUpperCase() : "P";

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div id="${avatarId}" style="width:42px; height:42px; background:var(--primary); border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold; color:white; overflow:hidden; flex-shrink:0;">
                    ${initial}
                </div>
                <div>
                    <div style="font-weight:700; font-size: 0.95rem; color: #ffffff;">${data.nombre_paciente}</div>
                    <div style="font-size:0.78rem; color:#34d399; display: flex; align-items: center; gap: 5px;">
                        <span style="width: 7px; height: 7px; background: #10b981; border-radius: 50%; display: inline-block;"></span> En tratamiento
                    </div>
                </div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation(); desvincular('${data.reqId}', '${data.nombre_paciente}')" title="Dar de alta / Desvincular" style="color: #f87171; padding: 6px;">
                <i class="fa-solid fa-user-xmark"></i>
            </button>
        `;

        div.onclick = () => {
            selectedPatientId = data.id_paciente;
            
            document.querySelectorAll('.patient-item').forEach(el => {
                el.style.background = 'rgba(30, 41, 59, 0.4)';
                el.style.borderColor = 'var(--border)';
            });
            div.style.background = 'rgba(59, 130, 246, 0.15)';
            div.style.borderColor = 'var(--primary)';
            
            const currentAvatarHTML = document.getElementById(avatarId).innerHTML;
            const isImage = currentAvatarHTML.includes('<img');
            
            const headerHTML = isImage 
                ? `<div style="display:flex; align-items:center; gap:12px;"><div style="width:42px; height:42px; border-radius:50%; overflow:hidden;">${currentAvatarHTML}</div><div><strong style="font-size: 1rem; color: white;">${data.nombre_paciente}</strong><br><small style="color:#60a5fa;">● Paciente Seleccionado</small></div></div>`
                : `<i class="fa-solid fa-user-check text-primary"></i> <div><strong style="font-size: 1rem; color: white;">${data.nombre_paciente}</strong><br><small style="color:#60a5fa;">● Paciente Seleccionado</small></div>`;

            const boxSelected = document.getElementById('selectedPatientName');
            if (boxSelected) boxSelected.innerHTML = headerHTML;
            
            const btnAssign = document.getElementById('btnAssign');
            if (btnAssign) btnAssign.disabled = false;
            
            updateChartData(selectedPatientId); 
        };

        list.appendChild(div);

        // Buscar foto de perfil real
        getDoc(doc(db, "users", data.id_paciente)).then(userSnap => {
            if (userSnap.exists() && userSnap.data().photoUrl) {
                const avatarDiv = document.getElementById(avatarId);
                if (avatarDiv) {
                    avatarDiv.innerHTML = `<img src="${userSnap.data().photoUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                }
            }
        }).catch(() => {});
    });
}

// 5. CARGAR MÉTRICAS GLOBALES DE RUTINAS
async function cargarMetricasRutinas() {
    try {
        const qTotal = query(collection(db, "assignments"), where("id_doctor", "==", auth.currentUser.uid));
        const snapTotal = await getDocs(qTotal);
        
        let completados = 0;
        snapTotal.forEach(d => {
            if (d.data().estado === 'completado') completados++;
        });

        if (statRutinas) statRutinas.innerText = snapTotal.size;
        if (statCompletados) statCompletados.innerText = completados;
    } catch(e) {}
}

window.desvincular = async (id, nombre) => {
    const result = await Swal.fire({
        title: `¿Desvincular a ${nombre}?`,
        text: "Dejarás de ver su progreso y el paciente podrá elegir a otro especialista.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, desvincular',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) { 
        await deleteDoc(doc(db, "requests", id)); 
        await registrarBitacora("ELIMINAR PACIENTE", `El doctor desvinculó la relación con ${nombre} (Solicitud ID: ${id})`);
        
        Swal.fire('Paciente Desvinculado', `${nombre} ya no está en tu lista activa.`, 'success');
        loadMyPatients(); 
    }
};

// 6. ASIGNAR EJERCICIO Y PRESCRIBIR
document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedPatientId) {
        return Swal.fire('Selecciona un Paciente', 'Haz clic en un paciente de la lista izquierda para asignarle la tarea.', 'warning');
    }
    
    const reps = document.getElementById('repsMeta').value;
    if (reps < 1) {
        return Swal.fire('Cantidad Inválida', 'La meta de repeticiones debe ser al menos 1.', 'error');
    }
    
    if (reps > 100) {
        const confirmReps = await Swal.fire({
            title: '¿Confirmar cantidad?',
            text: `¿Estás seguro de prescribir ${reps} repeticiones? Podría causar sobrecarga muscular.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Sí, prescribir de todos modos'
        });
        if (!confirmReps.isConfirmed) return;
    }

    const ex = document.getElementById('exerciseSelect').value;
    const lado = document.getElementById('sideSelect') ? document.getElementById('sideSelect').value : 'derecho';
    const btn = document.getElementById('btnAssign');
    const originalText = btn.innerHTML;
    
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Prescribiendo...';
    
    try {
        await addDoc(collection(db, "assignments"), {
            id_doctor: auth.currentUser.uid,
            id_paciente: selectedPatientId,
            tipo_ejercicio: ex,
            lado: lado,
            reps_meta: parseInt(reps),
            estado: "pendiente",
            fecha: new Date(),
            reps_realizadas: 0
        });

        // Enviar notificación al paciente
        await addDoc(collection(db, "notificaciones"), {
            usuario_id: selectedPatientId,
            titulo: "¡Nueva Rutina Asignada!",
            mensaje: `Tu fisioterapeuta te ha prescrito ${reps} repeticiones de ${ex.replace('_', ' ').toUpperCase()} (${lado === 'izquierdo' ? 'Lado Izquierdo' : 'Lado Derecho'}).`,
            leida: false,
            fecha: new Date()
        });

        await registrarBitacora("ASIGNAR RUTINA", `Se prescribió ${ex} (${reps} reps, lado: ${lado}) al paciente ID: ${selectedPatientId}`);
        
        Swal.fire({
            title: '¡Rutina Prescrita!',
            text: `La tarea fue enviada y notificada al paciente con éxito.`,
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });

        cargarMetricasRutinas();

    } catch (error) {
        console.error("Error al asignar rutina:", error);
        Swal.fire('Error Técnico', error.message, 'error');
    }
    
    btn.disabled = false; 
    btn.innerHTML = originalText;
});

// 7. HISTORIAL CLÍNICO Y WHATSAPP INTELIGENTE
async function cargarHistorialGlobal() {
    const table = document.getElementById('historyTableBody');
    if (!table) return;
    table.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:var(--text-muted);'><i class='fa-solid fa-spinner fa-spin'></i> Cargando sesiones...</td></tr>";
    
    try {
        const q = query(
            collection(db, "assignments"), 
            where("id_doctor", "==", auth.currentUser.uid), 
            where("estado", "==", "completado"), 
            orderBy("fecha_completado", "desc"), 
            limit(20)
        );
        const snap = await getDocs(q);
        table.innerHTML = "";

        if (snap.empty) { 
            table.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:25px; color:var(--text-muted);'>No hay sesiones completadas registradas recientemente.</td></tr>"; 
            return; 
        }

        for (const d of snap.docs) {
            const data = d.data();
            let name = "Paciente";
            let telefono = "";

            try {
                const u = await getDoc(doc(db, "users", data.id_paciente));
                if (u.exists()) {
                    name = u.data().nombre || "Sin Nombre";
                    telefono = u.data().telefono || "";
                }
            } catch(e) {}
            
            const tipoLimpio = (data.tipo_ejercicio || "ejercicio").replace('_', ' ').toUpperCase();
            const ladoStr = (data.lado || 'derecho').toUpperCase();
            const fechaStr = (data.fecha_completado && data.fecha_completado.seconds)
                ? new Date(data.fecha_completado.seconds * 1000).toLocaleDateString()
                : "Hoy";

            const row = `<tr>
                <td><strong>${name}</strong></td>
                <td>
                    <span style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:700;">${tipoLimpio}</span>
                    <small style="display:block; color:var(--text-muted); font-size:0.72rem; margin-top:3px;"><i class="fa-solid fa-arrows-left-right"></i> Lado ${ladoStr}</small>
                </td>
                <td><strong style="color:#10b981; font-size:1.05rem;">${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
                <td><small style="color:var(--text-muted);">${fechaStr}</small></td>
                <td>
                    <button class="btn-action-pdf" onclick="generarPDF('${name}','${tipoLimpio} (${ladoStr})',${data.reps_realizadas}, ${data.reps_meta})" title="Descargar Reporte PDF">
                        <i class="fa-solid fa-file-pdf"></i> PDF
                    </button>
                    <button class="btn-action-wa" onclick="enviarWhatsApp('${telefono}', '${name}', '${tipoLimpio}', ${data.reps_realizadas})" title="Enviar felicitación por WhatsApp">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                    </button>
                </td>
            </tr>`;
            table.innerHTML += row;
        }
    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td colspan='5' style='color:var(--danger); text-align:center; padding:15px;'>Error: ${e.message}</td></tr>`;
    }
}

const btnRefreshHistory = document.getElementById('btnRefreshHistory');
if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', cargarHistorialGlobal);
}

// Generación de PDF clínico
window.generarPDF = (nombre, ej, reps, meta) => {
    if (!window.jspdf) return alert("Cargando librería jsPDF...");
    const doc = new window.jspdf.jsPDF();
    
    // Encabezado clínico
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("SIRA - Sistema Inteligente De Rehabilitación Asistida", 14, 18);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("REPORTE OFICIAL DE SESIÓN TERAPÉUTICA", 14, 45);
    
    doc.setFontSize(11);
    doc.text(`Paciente: ${nombre}`, 14, 60);
    doc.text(`Ejercicio Evaluado: ${ej}`, 14, 70);
    doc.text(`Repeticiones Completadas: ${reps} / ${meta || reps}`, 14, 80);
    doc.text(`Fecha del Reporte: ${new Date().toLocaleDateString()}`, 14, 90);
    doc.text(`Estado Biomecánico: Evaluado mediante Visión Artificial MediaPipe`, 14, 100);

    doc.setDrawColor(59, 130, 246);
    doc.line(14, 110, 195, 110);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Documento generado automáticamente por la plataforma SIRA TeleRehab AI.", 14, 120);

    doc.save(`SIRA_Reporte_${nombre.replace(/\s+/g, '_')}.pdf`);
};

// WhatsApp Directo
window.enviarWhatsApp = (telefono, nombre, ejercicio, reps) => {
    if (!telefono || telefono.length < 5) {
        return Swal.fire('Sin Teléfono', 'Este paciente no tiene número telefónico registrado en su perfil.', 'info');
    }
    const numeroLimpio = telefono.replace(/\D/g, ''); 
    const mensaje = `Hola ${nombre}, soy tu fisioterapeuta en SIRA. He revisado tu sesión de hoy: ¡completaste ${reps} repeticiones de ${ejercicio}! Excelente trabajo. 💪`;
    window.open(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
};

// Auth y Cierre de Sesión
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
}

// Inicialización de Datos del Doctor
auth.onAuthStateChanged(async (user) => {
    if (user) {
        if (user.email === "admin@gmail.com") {
            window.location.href = 'dashboard-admin.html';
            return;
        }

        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists() && docSnap.data().rol === "doctor") {
            const dataDr = docSnap.data();
            
            if (doctorNameHeader) {
                doctorNameHeader.innerText = dataDr.nombre || "Fisioterapeuta";
            }
            if (dataDr.photoUrl) {
                if (headerAvatar) headerAvatar.src = dataDr.photoUrl;
                if (heroDoctorAvatar) {
                    heroDoctorAvatar.innerHTML = `<img src="${dataDr.photoUrl}" alt="${dataDr.nombre}">`;
                }
            } else {
                const initial = dataDr.nombre ? dataDr.nombre.charAt(0).toUpperCase() : "Dr";
                if (heroDoctorAvatar) heroDoctorAvatar.innerHTML = initial;
            }

            loadIncomingRequests(); 
            loadMyPatients();
            cargarHistorialGlobal();
        } else {
            window.location.href = 'dashboard-paciente.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});
