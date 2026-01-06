// js/vision.js
import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. LEER LA MISIÓN DE LA URL (Ej: monitor.html?meta=10&id=xyz...)
const params = new URLSearchParams(window.location.search);
const META_REPS = parseInt(params.get('meta')) || 10; // Si no hay meta, usa 10 por defecto
const ASSIGNMENT_ID = params.get('id');
const EXERCISE_TYPE = params.get('tipo');

// Mostrar la meta en pantalla
document.getElementById('lblExercise').innerText = `${EXERCISE_TYPE || "Ejercicio"} (Meta: ${META_REPS})`;

// 2. ELEMENTOS
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const lblReps = document.getElementById('lblReps');
const lblFeedback = document.getElementById('feedback');

// ESTADO
let count = 0;
let stage = "down";
let isFinished = false; // Para evitar que siga contando después de terminar

// 3. CALCULO DE ÁNGULO
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// 4. FUNCIÓN PARA GUARDAR EN FIREBASE (VICTORIA)
async function finishExercise() {
    isFinished = true;
    lblFeedback.innerText = "🎉 ¡TERMINASTE! Guardando...";
    lblFeedback.style.color = "#00ff00";
    
    // Detener la cámara
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
            window.location.href = "dashboard-paciente.html"; // Volver al panel
        } else {
            alert("Modo prueba terminado (Sin guardar).");
        }
    } catch (error) {
        console.error(error);
        alert("Error guardando: " + error.message);
    }
}

// 5. BUCLE DE VISIÓN
function onResults(results) {
    if (isFinished) return; // Si ya terminó, no hacer nada

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // Lógica para Flexión de Codo (Brazo Derecho)
        const shoulder = results.poseLandmarks[12];
        const elbow = results.poseLandmarks[14];
        const wrist = results.poseLandmarks[16];

        if (shoulder.visibility > 0.5 && elbow.visibility > 0.5 && wrist.visibility > 0.5) {
            const angle = calculateAngle(shoulder, elbow, wrist);
            
            // Texto del ángulo
            canvasCtx.font = "30px Arial";
            canvasCtx.fillStyle = "white";
            canvasCtx.fillText(Math.round(angle), elbow.x * canvasElement.width, elbow.y * canvasElement.height);

            // Contador
            if (angle > 160) {
                stage = "down";
                lblFeedback.innerText = "Baja... Extiende bien 👇";
            }
            if (angle < 45 && stage === "down") {
                stage = "up";
                count++;
                lblReps.innerText = `${count} / ${META_REPS}`;
                lblFeedback.innerText = "¡SUBE! 💪";
                
                // VERIFICAR VICTORIA
                if (count >= META_REPS) {
                    finishExercise();
                }
            }
        }
    }
    canvasCtx.restore();
}

// 6. INICIAR
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { if(!isFinished) await pose.send({image: videoElement}) },
    width: 1280, height: 720
});
camera.start();