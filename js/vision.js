import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. LEER LA MISIÓN DE LA URL
const params = new URLSearchParams(window.location.search);
const META_REPS = parseInt(params.get('meta')) || 10;
const ASSIGNMENT_ID = params.get('id');
// Normalizamos el texto (minusculas) para evitar errores
const EXERCISE_TYPE = (params.get('tipo') || "flexion_codo").toLowerCase(); 

// Elementos HTML
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const lblReps = document.getElementById('lblReps');
const lblFeedback = document.getElementById('feedback');
const lblTitle = document.getElementById('lblExercise');

// Configuración Visual
lblTitle.innerText = `${EXERCISE_TYPE.toUpperCase().replace('_', ' ')} (Meta: ${META_REPS})`;

// VARIABLES DE ESTADO
let count = 0;
let stage = "up"; // up (arriba/extendido) o down (abajo/flexionado)
let isFinished = false;

// 2. FUNCIÓN MATEMÁTICA (Calcula ángulos)
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// 3. FINALIZAR EJERCICIO
async function finishExercise() {
    isFinished = true;
    lblFeedback.innerText = "🎉 ¡TERMINASTE! Guardando...";
    lblFeedback.style.color = "#00ff00";
    camera.stop();

    try {
        if (ASSIGNMENT_ID) {
            const taskRef = doc(db, "assignments", ASSIGNMENT_ID);
            await updateDoc(taskRef, {
                estado: "completado",
                fecha_completado: new Date(),
                reps_realizadas: count
            });
            alert("✅ ¡Ejercicio guardado exitosamente!");
            window.location.href = "dashboard-paciente.html";
        } else {
            alert("Modo prueba terminado (Sin guardar).");
            window.history.back();
        }
    } catch (error) {
        console.error(error);
        alert("Error guardando: " + error.message);
    }
}

// 4. LÓGICA POR EJERCICIO
function procesarEjercicio(landmarks) {
    let angle = 0;
    let jointCoordinates = null; // Para dibujar el numero en la articulacion correcta

    // --- CASO A: FLEXIÓN DE CODO (Bíceps) ---
    if (EXERCISE_TYPE.includes("flexion") || EXERCISE_TYPE.includes("codo")) {
        // Puntos: 12 (Hombro), 14 (Codo), 16 (Muñeca) - Lado Derecho
        const shoulder = landmarks[12];
        const elbow = landmarks[14];
        const wrist = landmarks[16];

        if (shoulder.visibility > 0.5 && elbow.visibility > 0.5 && wrist.visibility > 0.5) {
            angle = calculateAngle(shoulder, elbow, wrist);
            jointCoordinates = elbow;

            // Lógica de Conteo (Bíceps)
            if (angle > 160) {
                stage = "down"; // Brazo estirado
                lblFeedback.innerText = "Sube el brazo 💪";
            }
            if (angle < 45 && stage === "down") {
                stage = "up"; // Brazo contraído
                count++;
                lblFeedback.innerText = "¡Bien hecho!";
            }
        } else {
            lblFeedback.innerText = "⚠️ Enfoca tu brazo derecho";
        }
    } 
    
    // --- CASO B: SENTADILLA (Piernas) ---
    else if (EXERCISE_TYPE.includes("sentadilla")) {
        // Puntos: 24 (Cadera), 26 (Rodilla), 28 (Tobillo) - Lado Derecho
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
            angle = calculateAngle(hip, knee, ankle);
            jointCoordinates = knee;

            // Lógica de Conteo (Sentadilla)
            // Estar de pie: Angulo > 170
            // Estar abajo: Angulo < 100 (aprox 90 grados)
            
            if (angle > 165) {
                stage = "up"; // De pie
                lblFeedback.innerText = "Baja la cadera 👇";
            }
            if (angle < 100 && stage === "up") { // < 100 grados es una sentadilla decente
                stage = "down"; // Abajo
                count++;
                lblFeedback.innerText = "¡Arriba! 🦵";
            }
        } else {
            lblFeedback.innerText = "⚠️ Aléjate para ver tu cuerpo completo";
        }
    }

    return { angle, jointCoordinates };
}

// 5. BUCLE PRINCIPAL (Se ejecuta 30 veces por segundo)
function onResults(results) {
    if (isFinished) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Dibujar imagen de cámara
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Dibujar esqueleto completo
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // PROCESAR LÓGICA
        const data = procesarEjercicio(results.poseLandmarks);

        // Mostrar Repeticiones y Ángulo
        if (data.jointCoordinates) {
            // Pintar el ángulo en la articulación
            canvasCtx.font = "30px Arial";
            canvasCtx.fillStyle = "white";
            canvasCtx.fillText(Math.round(data.angle) + "°", data.jointCoordinates.x * canvasElement.width, data.jointCoordinates.y * canvasElement.height);
            
            // Actualizar contadores
            lblReps.innerText = `${count} / ${META_REPS}`;
            
            // Verificar Victoria
            if (count >= META_REPS) {
                finishExercise();
            }
        }
    }
    canvasCtx.restore();
}

// 6. INICIALIZAR MEDIAPIPE
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { if(!isFinished) await pose.send({image: videoElement}) },
    width: 1280, height: 720
});
camera.start();