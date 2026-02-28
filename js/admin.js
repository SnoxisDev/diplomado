import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersTable = document.getElementById('adminUsersTable');
const bitacoraTable = document.getElementById('bitacoraTable');

// 1. CARGAR TODOS LOS USUARIOS (READ)
async function cargarUsuarios() {
    try {
        const q = query(collection(db, "users"));
        const snapshot = await getDocs(q);
        const usersTable = document.getElementById('adminUsersTable');
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

// 1.5 EDITAR ROL DE USUARIO (UPDATE)
window.cambiarRol = async (userId, nombre, rolActual) => {
    const nuevoRol = prompt(`Cambiar rol de: ${nombre}\nRol actual: ${rolActual}\n\nEscribe 'doctor' o 'paciente' para cambiarlo:`, rolActual);
    
    if (nuevoRol && (nuevoRol.toLowerCase() === 'doctor' || nuevoRol.toLowerCase() === 'paciente') && nuevoRol.toLowerCase() !== rolActual) {
        try {
            await updateDoc(doc(db, "users", userId), { rol: nuevoRol.toLowerCase() });
            
            // Registrar en bitácora
            await addDoc(collection(db, "bitacora"), {
                fecha: new Date(),
                usuario_id: auth.currentUser ? auth.currentUser.uid : "Admin",
                accion: "CAMBIO DE ROL",
                detalle: `El Administrador cambió el rol de ${nombre} a ${nuevoRol.toLowerCase()}`
            });

            alert(`✅ Rol actualizado con éxito.`);
            cargarUsuarios(); 
            if(typeof cargarEstadisticas === 'function') cargarEstadisticas(); 
            if(typeof cargarBitacoraConFiltro === 'function') cargarBitacoraConFiltro();
        } catch (error) {
            alert("❌ Error al cambiar rol: " + error.message);
        }
    } else if (nuevoRol && nuevoRol.toLowerCase() !== rolActual) {
        alert("⚠️ Rol no válido. Escribe exactamente 'doctor' o 'paciente'.");
    }
};

// 3. ELIMINAR USUARIO (DELETE)
window.eliminarUsuario = async (userId, nombre) => {
    if (confirm(`¿Estás seguro de eliminar a ${nombre} de la base de datos? Esto es irreversible.`)) {
        try {
            await deleteDoc(doc(db, "users", userId));
            alert("Usuario eliminado correctamente.");
            cargarUsuarios(); 
            if(typeof cargarEstadisticas === 'function') cargarEstadisticas();

            await addDoc(collection(db, "bitacora"), {
                fecha: new Date(),
                usuario_id: auth.currentUser ? auth.currentUser.uid : "Admin",
                accion: "USUARIO ELIMINADO",
                detalle: `El Administrador eliminó del sistema al usuario: ${nombre}`
            });
            if(typeof cargarBitacoraConFiltro === 'function') cargarBitacoraConFiltro();
        } catch (error) {
            alert("Error al eliminar: " + error.message);
        }
    }
};

// 4. CARGAR RUTINAS GLOBALES
// ==========================================
// 3.5 CONTROL GLOBAL DE RUTINAS (CON NOMBRES Y FILTROS)
// ==========================================
let rutinasGlobalesMemoria = []; // Guardamos los datos aquí para que los filtros sean súper rápidos

async function cargarRutinasGlobales() {
    const globalTable = document.getElementById('globalAssignmentsTable');
    if(!globalTable) return;

    try {
        // 1. Traer todas las rutinas asignadas
        const q = query(collection(db, "assignments"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        
        // 2. Traer todos los usuarios para cruzar sus IDs por Nombres (Súper optimizado)
        const usersSnap = await getDocs(collection(db, "users"));
        const nombresMap = {};
        usersSnap.forEach(u => nombresMap[u.id] = u.data().nombre);

        rutinasGlobalesMemoria = [];
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            rutinasGlobalesMemoria.push({
                ...data,
                // Si el ID existe, ponemos el nombre, si no, ponemos "Usuario Eliminado"
                nombrePaciente: nombresMap[data.id_paciente] || "Usuario Eliminado",
                nombreDoctor: nombresMap[data.id_doctor] || "Doctor Desconocido"
            });
        });

        // Mostramos "todas" al cargar por primera vez
        renderizarTablaGlobal(rutinasGlobalesMemoria);

    } catch (error) {
        console.error("Error al cargar rutinas globales:", error);
    }
}

// Función que se activa al hacer clic en las pestañas (botones)
window.filtrarEstadoGlobal = (estado) => {
    if (estado === 'todas') {
        renderizarTablaGlobal(rutinasGlobalesMemoria);
    } else {
        const filtrados = rutinasGlobalesMemoria.filter(r => r.estado === estado);
        renderizarTablaGlobal(filtrados);
    }
};

// Función que dibuja el HTML de la tabla
function renderizarTablaGlobal(datos) {
    const globalTable = document.getElementById('globalAssignmentsTable');
    globalTable.innerHTML = "";

    if (datos.length === 0) {
        globalTable.innerHTML = "<tr><td colspan='5'>No hay rutinas en esta categoría.</td></tr>";
        return;
    }

    datos.forEach(data => {
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
}

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Inicializar
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

// ==========================================
// NUEVAS FUNCIONES: ESTADÍSTICAS Y FILTROS
// ==========================================

// 1. Cargar Estadísticas Rápidas
const cargarEstadisticas = async () => {
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        let totalUsers = 0, totalPacientes = 0, totalDoctores = 0;
        
        usersSnap.forEach(doc => {
            totalUsers++;
            const data = doc.data();
            if(data.rol === "paciente") totalPacientes++; // Corregido: rol
            if(data.rol === "doctor") totalDoctores++;    // Corregido: rol
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

// 2. Lógica del Filtro de Fechas para la Bitácora
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
    const tabla = document.getElementById("bitacoraTable"); // Corregido: bitacoraTable
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

// 3. Eventos de los Botones de Filtro
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

document.addEventListener("DOMContentLoaded", () => {
    cargarEstadisticas();
    cargarBitacoraConFiltro();
});