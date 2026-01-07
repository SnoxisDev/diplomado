import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIABLES GLOBALES
let selectedPatientId = null;
let chartInstance = null; // Para guardar la referencia del gráfico y poder actualizarlo

// ELEMENTOS DOM
const bellBtn = document.getElementById('bellBtn');
const dropdown = document.getElementById('dropdownMenu');
const badge = document.getElementById('notificationBadge');
const reqList = document.getElementById('requestsList');
const logoutBtn = document.getElementById('logoutBtn');
const ctx = document.getElementById('patientChart').getContext('2d'); // El lienzo del gráfico

// --------------------------------------------------------
// 1. INICIALIZAR GRÁFICO VACÍO
// --------------------------------------------------------
function initChart() {
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'], // Placeholder
            datasets: [{
                label: 'Repeticiones Logradas',
                data: [0, 0, 0, 0, 0],
                borderColor: '#3b82f6', // Azul neón
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4, // Curvas suaves
                pointBackgroundColor: '#ffffff',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}
initChart(); // Arrancar gráfico vacío al inicio

// --------------------------------------------------------
// 2. FUNCIÓN PARA ACTUALIZAR EL GRÁFICO CON DATOS REALES
// --------------------------------------------------------
async function updateChartData(patientId) {
    // 1. Buscar historial completado de este paciente
    const q = query(
        collection(db, "assignments"),
        where("id_paciente", "==", patientId),
        where("estado", "==", "completado"),
        orderBy("fecha_completado", "asc"), // Ordenar por fecha
        limit(10) // Solo los últimos 10 ejercicios
    );

    const snapshot = await getDocs(q);
    
    let fechas = [];
    let valores = [];

    if (snapshot.empty) {
        // Si no hay datos, mostrar vacío
        fechas = ["Sin datos"];
        valores = [0];
    } else {
        snapshot.forEach(doc => {
            const data = doc.data();
            // Convertir fecha de Firestore a texto corto (Ej: 12/05)
            const dateObj = data.fecha_completado.toDate();
            const fechaCorta = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            
            fechas.push(fechaCorta);
            valores.push(data.reps_realizadas);
        });
    }

    // 2. Actualizar el gráfico existente
    chartInstance.data.labels = fechas;
    chartInstance.data.datasets[0].data = valores;
    chartInstance.update();
}


// --------------------------------------------------------
// 3. LOGICA DE INTERFAZ (Campana, Listas, etc)
// --------------------------------------------------------

if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
}
document.addEventListener('click', () => { if(dropdown) dropdown.style.display = 'none'; });

// Cargar Solicitudes
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

// Cargar Pacientes
async function loadMyPatients() {
    const list = document.getElementById('patientsList');
    list.innerHTML = 'Cargando...';
    
    const q = query(collection(db, "requests"), where("id_doctor", "==", auth.currentUser.uid), where("estado", "==", "aceptado"));
    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) { list.innerHTML = '<p style="padding:10px; color:#64748b">Sin pacientes.</p>'; return; }

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement('div');
        div.className = 'patient-item'; 
        div.style = "padding: 10px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s;";
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <div style="width:30px; height:30px; background:#3b82f6; border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:bold;">${data.nombre_paciente.charAt(0)}</div>
                <span>${data.nombre_paciente}</span>
            </div>
            <i class="fa-solid fa-trash" style="color:#ef4444; cursor:pointer;" onclick="desvincular('${docSnap.id}')"></i>
        `;
        
        // AL HACER CLICK EN EL PACIENTE
        div.querySelector('div').onclick = () => {
            selectedPatientId = data.id_paciente;
            document.querySelectorAll('.patient-item').forEach(el => el.style.background = 'transparent');
            div.style.background = 'rgba(59, 130, 246, 0.1)';
            
            document.getElementById('selectedPatientName').innerHTML = `
                <i class="fa-solid fa-user-check"></i> Paciente: <strong>${data.nombre_paciente}</strong>
            `;
            document.getElementById('btnAssign').disabled = false;

            // *** AQUÍ OCURRE LA MAGIA DEL GRÁFICO ***
            updateChartData(selectedPatientId); 
        };
        list.appendChild(div);
    });
}

window.desvincular = async (id) => {
    if(confirm("¿Eliminar paciente?")) { await deleteDoc(doc(db, "requests", id)); loadMyPatients(); }
};

// Asignar Ejercicio
document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ex = document.getElementById('exerciseSelect').value;
    const reps = document.getElementById('repsMeta').value;
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

// Historial y PDF
document.getElementById('btnRefreshHistory').addEventListener('click', async () => {
    const table = document.getElementById('historyTableBody');
    table.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";
    
    const q = query(collection(db, "assignments"), where("id_doctor", "==", auth.currentUser.uid), where("estado", "==", "completado"));
    const snap = await getDocs(q);
    table.innerHTML = "";

    if(snap.empty) { table.innerHTML = "<tr><td colspan='5'>Sin datos.</td></tr>"; return; }

    for (const d of snap.docs) {
        const data = d.data();
        let name = "Paciente";
        try {
            const u = await getDoc(doc(db, "users", data.id_paciente));
            if(u.exists()) name = u.data().nombre;
        } catch(e) {}
        
        const row = `<tr>
            <td>${name}</td>
            <td>${data.tipo_ejercicio}</td>
            <td><strong style="color:#10b981">${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
            <td>${new Date(data.fecha_completado.seconds*1000).toLocaleDateString()}</td>
            <td><button class="btn" style="padding:5px 10px; font-size:0.8rem;" onclick="generarPDF('${name}','${data.tipo_ejercicio}',${data.reps_realizadas})"><i class="fa-solid fa-file-pdf"></i></button></td>
        </tr>`;
        table.innerHTML += row;
    }
});

// PDF Global
window.generarPDF = (nombre, ej, reps) => {
    if(!window.jspdf) return alert("Cargando librería PDF...");
    const doc = new window.jspdf.jsPDF();
    doc.text(`Reporte: ${nombre}`, 10, 10);
    doc.text(`Ejercicio: ${ej} - Reps: ${reps}`, 10, 20);
    doc.save(`Reporte_${nombre}.pdf`);
};

// Auth
if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(()=>window.location.href='index.html'));
auth.onAuthStateChanged(user => {
    if(user) { loadIncomingRequests(); loadMyPatients(); }
    else window.location.href='index.html';
});