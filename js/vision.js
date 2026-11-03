import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 1. LEER PARÁMETROS DE LA URL
// ==========================================
const params = new URLSearchParams(window.location.search);
const META_REPS = parseInt(params.get('meta')) || 10;
const ASSIGNMENT_ID = params.get('id');
const EXERCISE_TYPE = (params.get('tipo') || "flexion_codo").toLowerCase();
let currentSide = (params.get('lado') || "derecho").toLowerCase();

// ==========================================
// 2. ELEMENTOS DOM
// ==========================================
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

const lblReps = document.getElementById('lblReps');
const lblMeta = document.getElementById('lblMeta');
const progressBar = document.getElementById('progressBar');
const lblFeedback = document.getElementById('feedback');
const lblSubFeedback = document.getElementById('lblSubFeedback');
const lblTitle = document.getElementById('lblExercise');
const lblAngleMeter = document.getElementById('lblAngleMeter');
const postureAlert = document.getElementById('postureAlert');

// Botones de control HUD
const btnToggleSide = document.getElementById('btnToggleSide');
const lblSideName = document.getElementById('lblSideName');
const btnToggleVoice = document.getElementById('btnToggleVoice');
const iconVoice = document.getElementById('iconVoice');
const lblVoiceStatus = document.getElementById('lblVoiceStatus');

// Formato de título de ejercicio legible
function obtenerNombreEjercicio(tipo) {
    if (tipo.includes("flexion_codo") || tipo.includes("codo")) return "Flexión de Codo (Bíceps)";
    if (tipo.includes("elevacion_lateral") || tipo.includes("lateral")) return "Elevación Lateral (Hombro)";
    if (tipo.includes("elevacion_frontal") || tipo.includes("frontal")) return "Elevación Frontal (Hombro)";
    if (tipo.includes("sentadilla") || tipo.includes("rodilla")) return "Sentadilla Terapéutica";
    return tipo.replace('_', ' ').toUpperCase();
}

if (lblTitle) lblTitle.innerText = obtenerNombreEjercicio(EXERCISE_TYPE);
if (lblMeta) lblMeta.innerText = META_REPS;
if (lblSideName) lblSideName.innerText = currentSide === 'izquierdo' ? 'Lado Izquierdo' : 'Lado Derecho';

// ==========================================
// 3. SISTEMA DE VOZ INTELIGENTE (SPEECH SYNTHESIS)
// ==========================================
let voiceEnabled = localStorage.getItem('sira_voice_active') !== 'false';
let lastSpokenText = "";
let lastSpokenTime = 0;
let lastPostureWarningTime = 0;
let hasWelcomed = false;

function updateVoiceUI() {
    if (!btnToggleVoice || !iconVoice || !lblVoiceStatus) return;
    if (voiceEnabled) {
        iconVoice.className = "fa-solid fa-volume-high text-success";
        lblVoiceStatus.innerText = "Voz Activa";
    } else {
        iconVoice.className = "fa-solid fa-volume-xmark text-muted";
        lblVoiceStatus.innerText = "Voz Mute";
    }
}
updateVoiceUI();

if (btnToggleVoice) {
    btnToggleVoice.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem('sira_voice_active', voiceEnabled);
        updateVoiceUI();
        if (voiceEnabled) {
            speak("Asistente de voz activado", { force: true });
        } else if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    });
}

function speak(text, options = {}) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const now = Date.now();
    const cooldown = options.force ? 0 : 2500;

    if (!options.force && text === lastSpokenText && (now - lastSpokenTime) < 4000) return;
    if (!options.force && (now - lastSpokenTime) < cooldown) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;

    window.speechSynthesis.speak(utterance);
    lastSpokenText = text;
    lastSpokenTime = now;
}

// Cargar voces en navegadores basados en Chromium
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        if (!hasWelcomed) {
            hasWelcomed = true;
            setTimeout(() => {
                const ladoTexto = currentSide === 'izquierdo' ? 'lado izquierdo' : 'lado derecho';
                speak(`Bienvenido a SIRA. Iniciamos ${obtenerNombreEjercicio(EXERCISE_TYPE)} con el ${ladoTexto}. Colócate frente a la cámara.`);
            }, 800);
        }
    };
}

// ==========================================
// 4. CONTROL INTERACTIVO DE LADO (BILATERAL)
// ==========================================
if (btnToggleSide) {
    btnToggleSide.addEventListener('click', () => {
        currentSide = currentSide === 'derecho' ? 'izquierdo' : 'derecho';
        lblSideName.innerText = currentSide === 'izquierdo' ? 'Lado Izquierdo' : 'Lado Derecho';
        stage = null;
        if (lblFeedback) lblFeedback.innerText = `Cambiado a ${currentSide.toUpperCase()}`;
        speak(`Cambiado a ${currentSide === 'izquierdo' ? 'lado izquierdo' : 'lado derecho'}`, { force: true });
    });
}

// ==========================================
// 5. VARIABLES DE ESTADO Y BIOMECÁNICA
// ==========================================
let count = 0;
let stage = null; 
let isFinished = false;
let compensationDetected = false;

// Cálculo del ángulo entre 3 puntos articulares
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// Detección de Compensación Postural (Anti-Trampa)
function verificarCompensacionPostural(landmarks) {
    const shoulderL = landmarks[11];
    const shoulderR = landmarks[12];

    if (shoulderL.visibility > 0.5 && shoulderR.visibility > 0.5) {
        // Desnivel de hombros en el eje vertical
        const shoulderSlope = Math.abs(shoulderL.y - shoulderR.y);
        
        if (shoulderSlope > 0.09) {
            compensationDetected = true;
            if (postureAlert) postureAlert.style.display = 'block';
            
            const now = Date.now();
            if (now - lastPostureWarningTime > 5500) {
                speak("Endereza tu torso, mantén los hombros alineados");
                lastPostureWarningTime = now;
            }
            return true;
        }
    }
    
    compensationDetected = false;
    if (postureAlert) postureAlert.style.display = 'none';
    return false;
}

// ==========================================
// 6. MOTOR CLÍNICO DE EJERCICIOS
// ==========================================
function procesarEjercicio(landmarks) {
    let angle = 0;
    let jointCoordinates = null;
    const isLeft = currentSide === "izquierdo";

    // Validar compensación postural global
    verificarCompensacionPostural(landmarks);

    // ----------------------------------------------------
    // CASO 1: FLEXIÓN DE CODO (BÍCEPS)
    // ----------------------------------------------------
    if (EXERCISE_TYPE.includes("flexion_codo") || EXERCISE_TYPE.includes("codo")) {
        const shoulder = isLeft ? landmarks[11] : landmarks[12];
        const elbow = isLeft ? landmarks[13] : landmarks[14];
        const wrist = isLeft ? landmarks[15] : landmarks[16];

        if (shoulder.visibility > 0.45 && elbow.visibility > 0.45 && wrist.visibility > 0.45) {
            angle = calculateAngle(shoulder, elbow, wrist);
            jointCoordinates = elbow;

            // Extensión hacia abajo
            if (angle > 155) {
                if (stage !== "down") {
                    stage = "down";
                    lblFeedback.innerText = "Sube el brazo 💪";
                    lblFeedback.style.color = "#fbbf24";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Flexiona el codo contrayendo el bíceps";
                    speak("Sube");
                }
            }
            // Contracción hacia arriba
            else if (angle < 45 && stage === "down") {
                if (compensationDetected) {
                    lblFeedback.innerText = "⚠️ Repite sin inclinar el torso";
                    lblFeedback.style.color = "#ef4444";
                } else {
                    stage = "up";
                    count++;
                    lblFeedback.innerText = "¡Excelente flexión! 🎉";
                    lblFeedback.style.color = "#10b981";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Baja despacio con control muscular";
                    anunciarRepeticion(count);
                }
            }
        } else {
            lblFeedback.innerText = `⚠️ Enfoca tu brazo ${currentSide}`;
            lblFeedback.style.color = "#f87171";
            if (lblSubFeedback) lblSubFeedback.innerText = "Asegúrate de que hombro, codo y muñeca sean visibles";
        }
    }

    // ----------------------------------------------------
    // CASO 2: ELEVACIÓN LATERAL (HOMBRO / ABDUCCIÓN)
    // ----------------------------------------------------
    else if (EXERCISE_TYPE.includes("elevacion_lateral") || EXERCISE_TYPE.includes("lateral")) {
        const hip = isLeft ? landmarks[23] : landmarks[24];
        const shoulder = isLeft ? landmarks[11] : landmarks[12];
        const elbow = isLeft ? landmarks[13] : landmarks[14];

        if (hip.visibility > 0.45 && shoulder.visibility > 0.45 && elbow.visibility > 0.45) {
            angle = calculateAngle(hip, shoulder, elbow);
            jointCoordinates = shoulder;

            // Elevación a nivel del hombro (75° a 95°)
            if (angle > 75) {
                if (stage !== "up") {
                    stage = "up";
                    lblFeedback.innerText = "Baja el brazo despacio 👇";
                    lblFeedback.style.color = "#38bdf8";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Mantén la posición un segundo y desciende";
                    speak("Baja despacio");
                }
            }
            // Vuelta a posición de reposo pegado al cuerpo (< 25°)
            else if (angle < 25 && stage === "up") {
                if (compensationDetected) {
                    lblFeedback.innerText = "⚠️ Repite con espalda alineada";
                    lblFeedback.style.color = "#ef4444";
                } else {
                    stage = "down";
                    count++;
                    lblFeedback.innerText = "¡Muy buena repetición! 🕊️";
                    lblFeedback.style.color = "#10b981";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Eleva lateralmente sin sobrepasar la horizontal";
                    anunciarRepeticion(count);
                }
            }
        } else {
            lblFeedback.innerText = "⚠️ Aléjate un poco del lente";
            lblFeedback.style.color = "#f87171";
            if (lblSubFeedback) lblSubFeedback.innerText = "Necesito ver tu torso y cadera completos";
        }
    }

    // ----------------------------------------------------
    // CASO 3: ELEVACIÓN FRONTAL (HOMBRO / PLANO SAGITAL)
    // ----------------------------------------------------
    else if (EXERCISE_TYPE.includes("elevacion_frontal") || EXERCISE_TYPE.includes("frontal")) {
        const hip = isLeft ? landmarks[23] : landmarks[24];
        const shoulder = isLeft ? landmarks[11] : landmarks[12];
        const wrist = isLeft ? landmarks[15] : landmarks[16];

        if (hip.visibility > 0.45 && shoulder.visibility > 0.45 && wrist.visibility > 0.45) {
            angle = calculateAngle(hip, shoulder, wrist);
            jointCoordinates = shoulder;

            // Subida al frente a 80° aprox
            if (angle > 75) {
                if (stage !== "up") {
                    stage = "up";
                    lblFeedback.innerText = "Baja con control 👇";
                    lblFeedback.style.color = "#38bdf8";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Controla la fase excéntrica al bajar";
                    speak("Baja suavemente");
                }
            }
            // Retorno abajo (< 25°)
            else if (angle < 25 && stage === "up") {
                if (compensationDetected) {
                    lblFeedback.innerText = "⚠️ Evita inclinar la espalda atrás";
                    lblFeedback.style.color = "#ef4444";
                } else {
                    stage = "down";
                    count++;
                    lblFeedback.innerText = "¡Gran elevación frontal! 🎯";
                    lblFeedback.style.color = "#10b981";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Sube hacia el frente sin doblar el codo";
                    anunciarRepeticion(count);
                }
            }
        } else {
            lblFeedback.innerText = `⚠️ Enfoca tu perfil ${currentSide}`;
            lblFeedback.style.color = "#f87171";
            if (lblSubFeedback) lblSubFeedback.innerText = "Ponte ligeramente en diagonal para captar el brazo";
        }
    }

    // ----------------------------------------------------
    // CASO 4: SENTADILLA TERAPÉUTICA (TREN INFERIOR)
    // ----------------------------------------------------
    else if (EXERCISE_TYPE.includes("sentadilla") || EXERCISE_TYPE.includes("rodilla") || EXERCISE_TYPE.includes("piernas")) {
        const hip = isLeft ? landmarks[23] : landmarks[24];
        const knee = isLeft ? landmarks[25] : landmarks[26];
        const ankle = isLeft ? landmarks[27] : landmarks[28];

        if (hip.visibility > 0.45 && knee.visibility > 0.45 && ankle.visibility > 0.45) {
            angle = calculateAngle(hip, knee, ankle);
            jointCoordinates = knee;

            // Extensión de pie (> 155°)
            if (angle > 155) {
                if (stage === "down") {
                    stage = "up";
                    count++;
                    lblFeedback.innerText = "¡Sentadilla lograda! 🦵";
                    lblFeedback.style.color = "#10b981";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Mantén el peso en los talones";
                    anunciarRepeticion(count);
                } else if (stage !== "up") {
                    stage = "up";
                    lblFeedback.innerText = "Flexiona rodillas y baja cadera 👇";
                    lblFeedback.style.color = "#fbbf24";
                    if (lblSubFeedback) lblSubFeedback.innerText = "Baja hasta que los muslos queden a 90°";
                    speak("Baja");
                }
            }
            // Cuclillas terapéutica (90° a 105°)
            else if (angle < 105 && angle > 60 && stage === "up") {
                stage = "down";
                lblFeedback.innerText = "¡Sube con fuerza! ⬆️";
                lblFeedback.style.color = "#38bdf8";
                if (lblSubFeedback) lblSubFeedback.innerText = "Empuja con los talones para ponerte de pie";
                speak("Sube");
            }
        } else {
            lblFeedback.innerText = "⚠️ Aléjate para ver tus piernas";
            lblFeedback.style.color = "#f87171";
            if (lblSubFeedback) lblSubFeedback.innerText = "La cámara debe registrar cadera, rodilla y tobillos";
        }
    }

    return { angle, jointCoordinates };
}

// Anuncio hablado de repeticiones y motivación
function anunciarRepeticion(n) {
    if (n === META_REPS) {
        speak(`¡Última repetición completada! Excelente trabajo.`, { force: true });
    } else if (n === Math.floor(META_REPS / 2)) {
        speak(`Repetición ${n}. ¡Vas por la mitad! Continúa con fuerza.`, { force: true });
    } else {
        speak(`Repetición ${n}. Muy bien.`, { force: true });
    }
}

// ==========================================
// 7. FINALIZACIÓN Y EVALUACIÓN CLÍNICA (VAS)
// ==========================================
async function finishExercise() {
    isFinished = true;
    lblFeedback.innerText = "🎉 ¡SESIÓN COMPLETADA!";
    lblFeedback.style.color = "#10b981"; 
    if (lblSubFeedback) lblSubFeedback.innerText = "Guardando tele-rehabilitación en tu expediente...";
    camera.stop();

    try {
        if (ASSIGNMENT_ID) {
            const taskRef = doc(db, "assignments", ASSIGNMENT_ID);
            await updateDoc(taskRef, {
                estado: "completado",
                fecha_completado: new Date(),
                reps_realizadas: count,
                lado_completado: currentSide
            });

            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            // Bitácora de auditoría
            await addDoc(collection(db, "bitacora"), {
                fecha: new Date(),
                usuario_id: "Paciente", 
                accion: "EJERCICIO COMPLETADO",
                detalle: `Completó ${count}/${META_REPS} reps de ${obtenerNombreEjercicio(EXERCISE_TYPE)} (${currentSide.toUpperCase()})`
            });

            // Notificación al doctor
            try {
                const snapAssign = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(m => m.getDoc(taskRef));
                if (snapAssign.exists() && snapAssign.data().id_doctor) {
                    await addDoc(collection(db, "notificaciones"), {
                        usuario_id: snapAssign.data().id_doctor,
                        titulo: "¡Sesión Completada por Paciente!",
                        mensaje: `El paciente ha finalizado ${count} repeticiones de ${obtenerNombreEjercicio(EXERCISE_TYPE)} (${currentSide}).`,
                        leida: false,
                        fecha: new Date()
                    });
                }
            } catch (errNotif) {}

            // Evaluación de Dolor Clínico (Escala Visual Analógica VAS)
            const { value: nivelDolor } = await Swal.fire({
                title: '¡Rutina Terminada con Éxito!',
                html: `
                    <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 12px;">Completaste <strong>${count} de ${META_REPS}</strong> repeticiones.</p>
                    <p style="font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">En la escala del 1 al 10, ¿cuánto dolor sentiste durante este ejercicio?</p>
                `,
                icon: 'question',
                input: 'range',
                inputAttributes: { min: 1, max: 10, step: 1 },
                inputValue: 1,
                confirmButtonColor: '#3b82f6',
                confirmButtonText: 'Guardar y Finalizar'
            });

            // Guardar dolor
            await addDoc(collection(db, "evaluaciones_dolor"), {
                id_asignacion: ASSIGNMENT_ID,
                tipo_ejercicio: EXERCISE_TYPE,
                lado: currentSide,
                nivel_dolor: parseInt(nivelDolor || 1),
                fecha: new Date()
            });
            
            await Swal.fire({
                title: '¡Progreso Guardado!',
                text: 'Tus métricas biomecánicas han sido enviadas a tu fisioterapeuta.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });

            window.location.href = "dashboard-paciente.html";

        } else {
            await Swal.fire('Modo Práctica Finalizado', `Has completado ${count} repeticiones libres con IA.`, 'success');
            window.location.href = "biblioteca.html";
        }
    } catch (error) {
        console.error("Error al guardar resultado:", error);
        alert("Error guardando progreso: " + error.message);
    }
}

// ==========================================
// 8. BUCLE PRINCIPAL DE RENDERIZADO (30 FPS)
// ==========================================
function onResults(results) {
    if (isFinished) return;

    // Sincronizar dimensiones reales de video y canvas
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Dibujar frame de video
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // Dibujar conectores del esqueleto
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00F0FF', lineWidth: 3 });
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#38BDF8', fillColor: '#0369A1', lineWidth: 2, radius: 4 });

        // Procesar ejercicio y ángulos
        const data = procesarEjercicio(results.poseLandmarks);

        if (data.jointCoordinates && data.angle > 0) {
            const angleRounded = Math.round(data.angle);

            // Renderizar texto del ángulo en el canvas
            const x = data.jointCoordinates.x * canvasElement.width;
            const y = data.jointCoordinates.y * canvasElement.height;

            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 22, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
            canvasCtx.fill();
            canvasCtx.strokeStyle = '#38bdf8';
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();

            canvasCtx.font = "bold 22px 'Inter', sans-serif";
            canvasCtx.fillStyle = "#fbbf24";
            canvasCtx.textAlign = "center";
            canvasCtx.textBaseline = "middle";
            canvasCtx.fillText(`${angleRounded}°`, x, y);

            // Actualizar HUD superior izquierdo
            if (lblAngleMeter) lblAngleMeter.innerText = `${angleRounded}°`;
            if (lblReps) lblReps.innerText = count;
            
            // Actualizar barra de progreso
            const porcentaje = (count / META_REPS) * 100;
            if (progressBar) progressBar.style.width = `${Math.min(porcentaje, 100)}%`;
            
            // Comprobar meta completada
            if (count >= META_REPS) {
                finishExercise();
            }
        }
    }
    canvasCtx.restore();
}

// ==========================================
// 9. INICIALIZACIÓN DE MEDIAPIPE Y CÁMARA
// ==========================================
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    },
    width: window.innerWidth > 600 ? 1280 : 640, 
    height: window.innerWidth > 600 ? 720 : 480
});
camera.start();
