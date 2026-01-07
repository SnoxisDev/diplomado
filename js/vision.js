import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. LEER URL
const params = new URLSearchParams(window.location.search);
const META_REPS = parseInt(params.get('meta')) || 10;
const ASSIGNMENT_ID = params.get('id');
const EXERCISE_TYPE = (params.get('tipo') || "flexion_codo").toLowerCase();

// Elementos HTML
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

const lblReps = document.getElementById('lblReps');
const lblMeta = document.getElementById('lblMeta');
const progressBar = document.getElementById('progressBar');
const lblFeedback = document.getElementById('feedback');
const lblTitle = document.getElementById('lblExercise');

// Configuración Inicial
if(lblTitle) lblTitle.innerText = EXERCISE_TYPE.toUpperCase().replace('_', ' ');
if(lblMeta) lblMeta.innerText = META_REPS;

// VARIABLES DE ESTADO
let count = 0;
let stage = "up"; 
let isFinished = false;

// 2. MATEMÁTICAS (Ángulo)
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// 3. FINALIZAR
async function finishExercise() {
    isFinished = true;
    lblFeedback.innerText = "🎉 ¡COMPLETADO!";
    lblFeedback.style.color = "#10b981"; // Verde éxito
    camera.stop();

    try {
        if (ASSIGNMENT_ID) {
            const taskRef = doc(db, "assignments", ASSIGNMENT_ID);
            await updateDoc(taskRef, {
                estado: "completado",
                fecha_completado: new Date(),
                reps_realizadas: count
            });
            setTimeout(() => {
                alert("✅ Ejercicio guardado. Volviendo al menú.");
                window.location.href = "dashboard-paciente.html";
            }, 1000);
        } else {
            alert("Modo prueba terminado.");
            window.history.back();
        }
    } catch (error) {
        console.error(error);
        alert("Error guardando: " + error.message);
    }
}

// 4. LÓGICA DE EJERCICIOS
function procesarEjercicio(landmarks) {
    let angle = 0;
    let jointCoordinates = null;

    // --- FLEXIÓN DE CODO ---
    if (EXERCISE_TYPE.includes("flexion") || EXERCISE_TYPE.includes("codo")) {
        const shoulder = landmarks[12];
        const elbow = landmarks[14];
        const wrist = landmarks[16];

        if (shoulder.visibility > 0.5 && elbow.visibility > 0.5 && wrist.visibility > 0.5) {
            angle = calculateAngle(shoulder, elbow, wrist);
            jointCoordinates = elbow;

            if (angle > 160) {
                stage = "down";
                lblFeedback.innerText = "Sube el brazo 💪";
            }
            if (angle < 45 && stage === "down") {
                stage = "up";
                count++;
                lblFeedback.innerText = "¡Excelente!";
            }
        } else {
            lblFeedback.innerText = "⚠️ Enfoca tu brazo derecho";
        }
    } 
    
    // --- SENTADILLA ---
    else if (EXERCISE_TYPE.includes("sentadilla")) {
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
            angle = calculateAngle(hip, knee, ankle);
            jointCoordinates = knee;

            if (angle > 165) {
                stage = "up";
                lblFeedback.innerText = "Baja la cadera 👇";
            }
            if (angle < 100 && stage === "up") {
                stage = "down";
                count++;
                lblFeedback.innerText = "¡Arriba! 🦵";
            }
        } else {
            lblFeedback.innerText = "⚠️ Necesito ver tu cuerpo completo";
        }
    }

    return { angle, jointCoordinates };
}

// 5. BUCLE PRINCIPAL (30 FPS)
function onResults(results) {
    if (isFinished) return;

    // Ajustar tamaño del canvas al del video para evitar pixelado
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Dibujar video
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Dibujar líneas del cuerpo
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // PROCESAR LÓGICA
        const data = procesarEjercicio(results.poseLandmarks);

        if (data.jointCoordinates) {
            // Dibujar ángulo en pantalla
            canvasCtx.font = "bold 40px Arial";
            canvasCtx.fillStyle = "yellow";
            canvasCtx.strokeStyle = "black";
            canvasCtx.lineWidth = 2;
            const x = data.jointCoordinates.x * canvasElement.width;
            const y = data.jointCoordinates.y * canvasElement.height;
            canvasCtx.strokeText(Math.round(data.angle) + "°", x, y);
            canvasCtx.fillText(Math.round(data.angle) + "°", x, y);
            
            // --- ACTUALIZAR INTERFAZ Y BARRA ---
            lblReps.innerText = count;
            
            // CÁLCULO DE LA BARRA DE PROGRESO
            const porcentaje = (count / META_REPS) * 100;
            if(progressBar) progressBar.style.width = `${Math.min(porcentaje, 100)}%`;
            
            // Verificar fin
            if (count >= META_REPS) {
                finishExercise();
            }
        }
    }
    canvasCtx.restore();
}

// 6. INICIAR MEDIAPIPE (Resolución HD)
const pose = new Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { if(!isFinished) await pose.send({image: videoElement}) },
    width: 1280, // Forzar HD para evitar pixelado
    height: 720
});
camera.start();