import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. CARGAR TODOS LOS USUARIOS (READ & UPDATE)
// ==========================================
async function cargarUsuarios() {
    try {
        const q = query(collection(db, "users"));
        const snapshot = await getDocs(q);
        const usersTable = document.getElementById('adminUsersTable');
        if(!usersTable) return;
        usersTable.innerHTML = "";

        if (snapshot.empty) {
            usersTable.innerHTML = "<tr><td colspan='3'>No hay usuarios registrados.</td></tr>";
            return;
        }

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            let rolBadge = user.rol === 'doctor' 
                ? '<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem;">Doctor</span>'
                : '<span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem;">Paciente</span>';

            usersTable.innerHTML += `
                <tr>
                    <td><strong>${user.nombre}</strong><br><small style="color:gray;">${docSnap.id}</small></td>
                    <td>${rolBadge}</td>
                    <td>
                        <button onclick="cambiarRol('${docSnap.id}', '${user.nombre}', '${user.rol}')" class="btn" style="background: var(--warning); color: #000; padding: 5px 10px; font-size: 0.8rem; margin-right: 5px;" title="Cambiar Rol">
                            <i class="fa-solid fa-user-pen"></i>
                        </button>
                        <button onclick="eliminarUsuario('${docSnap.id}', '${user.nombre}')" class="btn" style="background: #ef4444; color: white; padding: 5px 10px; font-size: 0.8rem;" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
    }
}

window.cambiarRol = async (userId, nombre, rolActual) => {
    // ALERTA SWEETALERT: Selector de Rol Moderno
    const { value: nuevoRol } = await Swal.fire({
        title: `Cambiar rol de ${nombre}`,
        text: `Rol actual: ${rolActual.toUpperCase()}`,
        icon: 'question',
        input: 'select',
        inputOptions: {
            'doctor': '👨‍⚕️ Doctor',
            'paciente': '🤕 Paciente'
        },
        inputValue: rolActual,
        showCancelButton: true,
        confirmButtonText: 'Actualizar Rol',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f59e0b'
    });

    if (nuevoRol && nuevoRol !== rolActual) {
        try {
            await updateDoc(doc(db, "users", userId), { rol: nuevoRol });
            await addDoc(collection(db, "bitacora"), {
                fecha: new Date(),
                usuario_id: auth.currentUser ? auth.currentUser.uid : "Admin",
                accion: "CAMBIO DE ROL",
                detalle: `El Administrador cambió el rol de ${nombre} a ${nuevoRol}`
            });
            
            // ALERTA SWEETALERT: Éxito
            Swal.fire('¡Actualizado!', 'El rol ha sido cambiado exitosamente.', 'success');
            
            cargarUsuarios(); 
            cargarEstadisticas(); 
            cargarBitacoraConFiltro();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
};

window.eliminarUsuario = async (userId, nombre) => {
    // ALERTA SWEETALERT: Confirmación Peligrosa
    const result = await Swal.fire({
        title: `¿Eliminar a ${nombre}?`,
        text: "Esta acción borrará al usuario de la base de datos para siempre.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "users", userId));
            await addDoc(collection(db, "bitacora"), {
                fecha: new Date(),
                usuario_id: auth.currentUser ? auth.currentUser.uid : "Admin",
                accion: "USUARIO ELIMINADO",
                detalle: `El Administrador eliminó del sistema al usuario: ${nombre}`
            });
            
            // ALERTA SWEETALERT: Eliminado
            Swal.fire('¡Eliminado!', 'El usuario ha sido borrado.', 'success');
            
            cargarUsuarios(); 
            cargarEstadisticas();
            cargarBitacoraConFiltro();
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
};

// ==========================================
// 2. ESTADÍSTICAS GLOBALES
// ==========================================
const cargarEstadisticas = async () => {
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        let totalUsers = 0, totalPacientes = 0, totalDoctores = 0;
        usersSnap.forEach(doc => {
            totalUsers++;
            const data = doc.data();
            if(data.rol === "paciente") totalPacientes++;
            if(data.rol === "doctor") totalDoctores++;
        });

        const asignacionesSnap = await getDocs(query(collection(db, "assignments"), where("estado", "==", "completado")));
        let totalRutinas = asignacionesSnap.size;

        document.getElementById("stat-total-usuarios").innerText = totalUsers;
        document.getElementById("stat-pacientes").innerText = totalPacientes;
        document.getElementById("stat-doctores").innerText = totalDoctores;
        document.getElementById("stat-rutinas").innerText = totalRutinas;
    } catch (error) {
        console.log("Error al cargar estadísticas: ", error);
    }
};

// ==========================================
// 3. BITÁCORA INTELIGENTE (FILTROS)
// ==========================================
let bitacoraGlobal = []; 

const cargarBitacoraConFiltro = async () => {
    try {
        const q = query(collection(db, "bitacora"), orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        bitacoraGlobal = [];
        querySnapshot.forEach((doc) => {
            bitacoraGlobal.push({ id: doc.id, ...doc.data() });
        });
        renderizarTablaBitacora(bitacoraGlobal); 
    } catch (e) {
        console.error("Error cargando bitácora:", e);
    }
};

const renderizarTablaBitacora = (datos) => {
    const tabla = document.getElementById("bitacoraTable");
    if(!tabla) return;
    tabla.innerHTML = "";
    
    if (datos.length === 0) {
        tabla.innerHTML = "<tr><td colspan='3'>No hay registros para estas fechas.</td></tr>";
        return;
    }

    datos.forEach(item => {
        let fechaJS = item.fecha.toDate ? item.fecha.toDate() : new Date(item.fecha);
        let fechaStr = fechaJS.toLocaleDateString() + " " + fechaJS.toLocaleTimeString(); 
        
        let fila = `
            <tr>
                <td style="font-size: 0.8rem; color: #94a3b8;">${fechaStr}</td>
                <td><strong style="color: #f59e0b;">${item.accion}</strong></td>
                <td style="font-size: 0.9rem;">${item.detalle}</td>
            </tr>
        `;
        tabla.innerHTML += fila;
    });
};

if(document.getElementById("btn-filtrar-bitacora")){
    document.getElementById("btn-filtrar-bitacora").addEventListener("click", () => {
        const fInicio = document.getElementById("filtro-fecha-inicio").value;
        const fFin = document.getElementById("filtro-fecha-fin").value;
        if(!fInicio || !fFin) return alert("⚠️ Por favor selecciona ambas fechas.");
        const start = new Date(fInicio + "T00:00:00");
        const end = new Date(fFin + "T23:59:59");
        const datosFiltrados = bitacoraGlobal.filter(item => {
            let fechaItem = item.fecha.toDate ? item.fecha.toDate() : new Date(item.fecha);
            return fechaItem >= start && fechaItem <= end;
        });
        renderizarTablaBitacora(datosFiltrados);
    });

    document.getElementById("btn-limpiar-filtro").addEventListener("click", () => {
        document.getElementById("filtro-fecha-inicio").value = "";
        document.getElementById("filtro-fecha-fin").value = "";
        renderizarTablaBitacora(bitacoraGlobal); 
    });
}

// ==========================================
// 4. CONTROL GLOBAL DE RUTINAS (PAGINACIÓN)
// ==========================================
let rutinasGlobalesMemoria = []; 
let rutinasFiltradasActuales = []; 
let paginaActual = 1;
const itemsPorPagina = 5; 

async function cargarRutinasGlobales() {
    const globalTable = document.getElementById('globalAssignmentsTable');
    if(!globalTable) return;

    try {
        const q = query(collection(db, "assignments"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        
        const usersSnap = await getDocs(collection(db, "users"));
        const nombresMap = {};
        usersSnap.forEach(u => nombresMap[u.id] = u.data().nombre);

        rutinasGlobalesMemoria = [];
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            rutinasGlobalesMemoria.push({
                ...data,
                nombrePaciente: nombresMap[data.id_paciente] || "Usuario Eliminado",
                nombreDoctor: nombresMap[data.id_doctor] || "Doctor Desconocido"
            });
        });

        rutinasFiltradasActuales = [...rutinasGlobalesMemoria];
        paginaActual = 1;
        renderizarTablaGlobalPaginada();

    } catch (error) {
        console.error("Error al cargar rutinas globales:", error);
    }
}

window.filtrarEstadoGlobal = (estado) => {
    if (estado === 'todas') {
        rutinasFiltradasActuales = [...rutinasGlobalesMemoria];
    } else {
        rutinasFiltradasActuales = rutinasGlobalesMemoria.filter(r => r.estado === estado);
    }
    paginaActual = 1; 
    renderizarTablaGlobalPaginada();
};

window.cambiarPagina = (numeroPagina) => {
    paginaActual = numeroPagina;
    renderizarTablaGlobalPaginada();
};

function renderizarTablaGlobalPaginada() {
    const globalTable = document.getElementById('globalAssignmentsTable');
    const paginacionDiv = document.getElementById('paginacionRutinas');
    if(!globalTable) return;
    
    globalTable.innerHTML = "";
    if(paginacionDiv) paginacionDiv.innerHTML = "";

    if (rutinasFiltradasActuales.length === 0) {
        globalTable.innerHTML = "<tr><td colspan='5'>No hay rutinas en esta categoría.</td></tr>";
        return;
    }

    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const datosPagina = rutinasFiltradasActuales.slice(inicio, fin); 

    datosPagina.forEach(data => {
        let estadoBadge = data.estado === 'completado' 
            ? '<span style="color: #10b981; font-weight: bold;"><i class="fa-solid fa-check"></i> Completado</span>'
            : '<span style="color: #f59e0b; font-weight: bold;"><i class="fa-solid fa-hourglass-half"></i> Pendiente</span>';

        globalTable.innerHTML += `
            <tr>
                <td><strong>${data.nombrePaciente}</strong></td>
                <td style="color: #94a3b8;">Dr. ${data.nombreDoctor}</td>
                <td><strong>${data.tipo_ejercicio.replace('_', ' ').toUpperCase()}</strong></td>
                <td>${estadoBadge}</td>
                <td><strong style="color: var(--text-main);">${data.reps_realizadas}</strong> / ${data.reps_meta}</td>
            </tr>
        `;
    });

    const totalPaginas = Math.ceil(rutinasFiltradasActuales.length / itemsPorPagina);
    
    if (totalPaginas > 1 && paginacionDiv) {
        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.onclick = () => cambiarPagina(i);
            
            if (i === paginaActual) {
                btn.style = "background: var(--primary); color: white; border: none; width: 35px; height: 35px; border-radius: 5px; cursor: pointer; font-weight: bold;";
            } else {
                btn.style = "background: #334155; color: white; border: none; width: 35px; height: 35px; border-radius: 5px; cursor: pointer;";
            }
            paginacionDiv.appendChild(btn);
        }
    }
}

// ==========================================
// 5. INICIALIZACIÓN Y SESIÓN
// ==========================================
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

auth.onAuthStateChanged(user => {
    if (user) {
        cargarUsuarios();
        cargarEstadisticas();
        cargarBitacoraConFiltro();
        cargarRutinasGlobales();
    } else {
        window.location.href = 'index.html';
    }
});