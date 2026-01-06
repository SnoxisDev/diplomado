// js/vision.js

// 1. Elementos del DOM
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const lblFeedback = document.getElementById('feedback');

// 2. Función que se ejecuta en CADA cuadro de video (30 veces por segundo)
function onResults(results) {
  // Limpiar el canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Dibujar la imagen de la cámara
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // Si la IA detectó un cuerpo...
  if (results.poseLandmarks) {
    // Dibujar los conectores (huesos)
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                   {color: '#00FF00', lineWidth: 4}); // Verde Matrix
    
    // Dibujar los puntos (articulaciones)
    drawLandmarks(canvasCtx, results.poseLandmarks,
                  {color: '#FF0000', lineWidth: 2}); // Puntos rojos

    lblFeedback.innerText = "Cuerpo detectado ✅";
  } else {
    lblFeedback.innerText = "⚠️ No veo tu cuerpo completo";
  }
  
  canvasCtx.restore();
}

// 3. Configuración de MediaPipe Pose
const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});

pose.setOptions({
  modelComplexity: 1, // 0=Rápido, 1=Balanceado, 2=Preciso (Usamos 1 para Venezuela)
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// 4. Encender la Cámara
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({image: videoElement});
  },
  width: 1280,
  height: 720
});

camera.start();
console.log("Cámara iniciada y procesando...");