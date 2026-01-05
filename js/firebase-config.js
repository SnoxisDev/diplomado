// js/firebase-config.js

// 1. Importamos las librerías oficiales de Google (Versión Web Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 2. Tu configuración (PEGA AQUÍ TUS DATOS DEL PASO 1)
const firebaseConfig = {
  apiKey: "AIzaSyBynC5PK4hGTWocLc-h0X_6R-jGkzCHmQk",
  authDomain: "telerehab-tesis.firebaseapp.com",
  projectId: "telerehab-tesis",
  storageBucket: "telerehab-tesis.firebasestorage.app",
  messagingSenderId: "414281177880",
  appId: "1:414281177880:web:a7e441f458def37929dc6d"
};

// 3. Iniciamos la conexión
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("✅ Firebase configurado y listo en js/firebase-config.js");

// 4. Exportamos para que otros archivos puedan usar la conexión
export { db, auth };