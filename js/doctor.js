import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIABLES GLOBALES
let selectedPatientId = null;
let chartInstance = null;

// ELEMENTOS DOM
const bellBtn = document.getElementById('bellBtn');
const dropdown = document.getElementById('dropdownMenu');
const badge = document.getElementById('notificationBadge');
const reqList = document.getElementById('requestsList');
const logoutBtn = document.getElementById('logoutBtn');
const ctx = document.getElementById('patientChart').getContext('2d');

// 1. INICIALIZAR GRÁFICO
function initChart() {
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue'],
            datasets: [{
                label: 'Repeticiones Logradas',
                data: [0, 0, 0, 0, 0],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}
initChart();

// 2. ACTUALIZAR GRÁFICO
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
        fechas = ["Sin datos"]; valores = [0];
    } else {
        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.fecha_completado.toDate();
            const fechaCorta = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            fechas.push(fechaCorta);
            valores.push(data.reps_realizadas);
        });
    }

    chartInstance.data.labels = fechas;
    chartInstance.data.datasets[0].data = valores;
    chartInstance.update();
}

// 3. INTERFAZ Y SOLICITUDES
if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
}
document.addEventListener('click', () => { if(dropdown) dropdown.style.display = 'none'; });

async function loadIncomingRequests() {
    if (!reqList) return;
    const q = query(collection(db, "requests"), where("id_doctor", "==", auth.currentUser.uid), where("estado", "==", "pendiente"));
    const snapshot = await getDocs(q);
    reqList.innerHTML = "";

    if (!snapshot.empty) {
        badge.innerText = snapshot.size; badge.style.display = "block";
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style = "padding:10px; border-bottom:1px solid #334155; color:#f8fafc;";
            div.innerHTML = `
                <small>${data.nombre_paciente}</small>
                <div style="margin-top:5px; display:flex; gap:5px;">
                    <button onclick="responderSolicitud('${docSnap.id}', 'aceptado')" style="background:#10b981; color:white; border:none; padding:2px 8px; border-radius:4px; font-size:0.7rem;">✔</button>
                    <button onclick="responderSolicitud('${docSnap.id}', 'rechazado')" style="background:#ef4444; color:white; border:none; padding:2px 8px; border-radius:4px; font-size:0.7rem;">✖</button>
                </div>`;
            reqList.appendChild(div);
        });
    } else {
        badge.style.display = "none";
        reqList.innerHTML = '<div style="padding:10px; text-align:center; color:#64748b;">Nada nuevo.</div>';
    }
}

window.responderSolicitud = async (reqId, respuesta) => {
    await updateDoc(doc(db, "requests", reqId), { estado: respuesta });
    loadIncomingRequests(); loadMyPatients();
};

// 4. CARGAR PACIENTES (CON FOTOS REALES)
async function loadMyPatients() {
    const list = document.getElementById('patientsList');
    list.innerHTML = 'Cargando...';
    
    const q = query(collection(db, "requests"), where("id_doctor", "==", auth.currentUser.uid), where("estado", "==", "aceptado"));
    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) { list.innerHTML = '<p style="padding:10px; color:#64748b">Sin pacientes activos.</p>'; return; }

    snapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'patient-item'; 
        div.style = "padding: 10px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; cursor: pointer;";
        
        const avatarId = `avatar-${data.id_paciente}`;
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div id="${avatarId}" style="width:40px; height:40px; background:#3b82f6; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold; color:white; overflow:hidden;">
                    ${data.nombre_paciente.charAt(0)}
                </div>
                <div>
                    <div style="font-weight:bold;">${data.nombre_paciente}</div>
                    <div style="font-size:0.8rem; color:#10b981;">● Activo</div>
                </div>
            </div>
            <i class="fa-solid fa-trash" style="color:#ef4444; padding:10px;" onclick="event.stopPropagation(); desvincular('${docSnap.id}')" title="Dejar de atender"></i>
        `;

        div.onclick = () => {
            selectedPatientId = data.id_paciente;
            document.querySelectorAll('.patient-item').forEach(el => el.style.background = 'transparent');
            div.style.background = 'rgba(59, 130, 246, 0.1)';
            
            const currentAvatarHTML = document.getElementById(avatarId).innerHTML;
            const isImage = currentAvatarHTML.includes('<img');
            
            const headerHTML = isImage 
                ? `<div style="display:flex; align-items:center; gap:10px;"><div style="width:40px; height:40px; border-radius:50%; overflow:hidden;">${currentAvatarHTML}</div><span>Paciente: <strong>${data.nombre_paciente}</strong></span></div>`
                : `<i class="fa-solid fa-user-check"></i> Paciente: <strong>${data.nombre_paciente}</strong>`;

            document.getElementById('selectedPatientName').innerHTML = headerHTML;
            document.getElementById('btnAssign').disabled = false;
            updateChartData(selectedPatientId); 
        };

        list.appendChild(div);

        // Buscar foto real en segundo plano
        try {
            const userSnap = await getDoc(doc(db, "users", data.id_paciente));
            if (userSnap.exists() && userSnap.data().photoUrl) {
                const avatarDiv = document.getElementById(avatarId);
                if (avatarDiv) {
                    avatarDiv.style.background = 'transparent';
                    avatarDiv.innerHTML = `<img src="${userSnap.data().photoUrl}" style="width:100%; height:100%; object-fit:cover;">`;
                }
            }
        } catch (e) {}
    });
}

window.desvincular = async (id) => {
    if(confirm("¿Eliminar paciente?")) { await deleteDoc(doc(db, "requests", id)); loadMyPatients(); }
};

// 5. ASIGNAR EJERCICIO (CON SEGURIDAD)
document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // --- VALIDACIÓN DE SEGURIDAD ---
    if (!selectedPatientId) return alert("⚠️ Selecciona un paciente primero.");
    const reps = document.getElementById('repsMeta').value;
    if (reps < 1) return alert("⚠️ La meta debe ser mayor a 0.");
    if (reps > 100 && !confirm("⚠️ ¿Seguro que quieres mandar más de 100 repeticiones?")) return;
    // -------------------------------

    const ex = document.getElementById('exerciseSelect').value;
    const btn = document.getElementById('btnAssign');
    
    btn.disabled = true; btn.innerText = "Enviando...";
    await addDoc(collection(db, "assignments"), {
        id_doctor: auth.currentUser.uid,
        id_paciente: selectedPatientId,
        tipo_ejercicio: ex,
        reps_meta: parseInt(reps),
        estado: "pendiente",
        fecha: new Date(),
        reps_realizadas: 0
    });
    alert("✅ Rutina enviada");
    btn.disabled = false; btn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Enviar Rutina';
});

// 6. HISTORIAL Y WHATSAPP INTELIGENTE
document.getElementById('btnRefreshHistory').addEventListener('click', async () => {
    const table = document.getElementById('historyTableBody');
    table.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
    
    try {
        const q = query(collection(db, "assignments"), where("id_doctor", "==", auth.currentUser.uid), where("estado", "==", "completado"), orderBy("fecha_completado", "desc"), limit(20));
        const snap = await getDocs(q);
        table.innerHTML = "";

        if(snap.empty) { table.innerHTML = "<tr><td colspan='5'>Sin datos recientes.</td></tr>"; return; }

        for (const d of snap.docs) {
            const data = d.data();
            let name = "Paciente";
            let telefono = "";

            try {
                const u = await getDoc(doc(db, "users", data.id_paciente));
                if(u.exists()) {
                    name = u.data().nombre || "Sin Nombre";
                    telefono = u.data().telefono || "";
                }
            } catch(e) {}
            
            const row = `<tr>
                <td>${name}</td>
                <td>${data.tipo_ejercicio}</td>
                <td><strong style="color:#10b981">${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
                <td>${new Date(data.fecha_completado.seconds*1000).toLocaleDateString()}</td>
                <td>
                    <button class="btn" style="padding:5px 10px; font-size:0.8rem; margin-right:5px;" onclick="generarPDF('${name}','${data.tipo_ejercicio}',${data.reps_realizadas})"><i class="fa-solid fa-file-pdf"></i></button>
                    <button class="btn" style="padding:5px 10px; font-size:0.8rem; background:#25D366; color:white;" onclick="enviarWhatsApp('${telefono}', '${name}', '${data.tipo_ejercicio}', ${data.reps_realizadas})"><i class="fa-brands fa-whatsapp"></i></button>
                </td>
            </tr>`;
            table.innerHTML += row;
        }
    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td colspan='5'>Error: ${e.message}</td></tr>`;
    }
});

// Funciones Globales
window.generarPDF = (nombre, ej, reps) => {
    if(!window.jspdf) return alert("Cargando librería PDF...");
    const doc = new window.jspdf.jsPDF();
    doc.text(`Reporte: ${nombre}`, 10, 10);
    doc.text(`Ejercicio: ${ej} - Reps: ${reps}`, 10, 20);
    doc.save(`Reporte_${nombre}.pdf`);
};

window.enviarWhatsApp = (telefono, nombre, ejercicio, reps) => {
    if (!telefono || telefono.length < 5) return alert("⚠️ Este paciente no tiene teléfono registrado.");
    const numeroLimpio = telefono.replace(/\D/g,''); 
    const mensaje = `Hola ${nombre}, soy tu doctor. Vi que completaste ${reps} repeticiones de ${ejercicio}. ¡Sigue así! 💪`;
    window.open(`https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
};

// Auth
if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(()=>window.location.href='index.html'));
auth.onAuthStateChanged(user => {
    if(user) { loadIncomingRequests(); loadMyPatients(); }
    else window.location.href='index.html';
});