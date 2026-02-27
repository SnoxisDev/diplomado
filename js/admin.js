import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersTable = document.getElementById('adminUsersTable');
const bitacoraTable = document.getElementById('bitacoraTable');

// 1. CARGAR TODOS LOS USUARIOS (READ)
async function cargarUsuarios() {
    try {
        const q = query(collection(db, "users"));
        const snapshot = await getDocs(q);
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
                        <button onclick="eliminarUsuario('${docSnap.id}', '${user.nombre}')" class="btn" style="background: #ef4444; color: white; padding: 5px 10px; font-size: 0.8rem;">
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

// 2. CARGAR LA BITÁCORA (READ)
async function cargarBitacora() {
    try {
        // Traemos la bitácora ordenada por fecha (los más recientes primero)
        const q = query(collection(db, "bitacora"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        bitacoraTable.innerHTML = "";

        if (snapshot.empty) {
            bitacoraTable.innerHTML = "<tr><td colspan='3'>La bitácora está vacía.</td></tr>";
            return;
        }

        snapshot.forEach(docSnap => {
            const registro = docSnap.data();
            
            // Formatear la fecha para que se lea bien
            const fechaObj = registro.fecha.toDate();
            const fechaStr = fechaObj.toLocaleDateString() + " " + fechaObj.toLocaleTimeString();

            bitacoraTable.innerHTML += `
                <tr>
                    <td style="font-size: 0.8rem; color: #94a3b8;">${fechaStr}</td>
                    <td><strong style="color: #f59e0b;">${registro.accion}</strong></td>
                    <td style="font-size: 0.9rem;">${registro.detalle}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error al cargar bitácora:", error);
    }
}

// 3. ELIMINAR USUARIO (DELETE)
window.eliminarUsuario = async (userId, nombre) => {
    if (confirm(`¿Estás seguro de eliminar a ${nombre} de la base de datos? Esto es irreversible.`)) {
        try {
            await deleteDoc(doc(db, "users", userId));
            alert("Usuario eliminado correctamente.");
            cargarUsuarios(); // Recargar la tabla
        } catch (error) {
            alert("Error al eliminar: " + error.message);
        }
    }
};

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Inicializar
auth.onAuthStateChanged(user => {
    if (user) {
        cargarUsuarios();
        cargarBitacora();
    } else {
        window.location.href = 'index.html';
    }
});