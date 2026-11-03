// js/pwa-install.js - Gestión de Registro e Instalación de SIRA PWA

// 1. REGISTRAR EL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Solo registrar si el protocolo es http/https (evitar error en file://)
        if (window.location.protocol.startsWith('http')) {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => {
                    console.log('✅ SIRA PWA: Service Worker registrado con éxito', reg.scope);
                })
                .catch((err) => {
                    console.warn('⚠️ SIRA PWA: Error al registrar Service Worker:', err);
                });
        }
    });
}

// 2. DETECTAR SI YA ESTÁ INSTALADA O EN MODO STANDALONE
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true;

let deferredInstallPrompt = null;

// 3. CAPTURAR EVENTO DE INSTALACIÓN EN ANDROID / CHROME / EDGE
window.addEventListener('beforeinstallprompt', (e) => {
    // Evitar el minibar por defecto de Chrome
    e.preventDefault();
    deferredInstallPrompt = e;

    // Mostrar el banner interactivo si no estamos ya en standalone
    if (!isStandalone) {
        mostrarBannerPWA();
    }
});

// 4. CREAR EL BANNER FLOTANTE DE INSTALACIÓN
function mostrarBannerPWA() {
    // Si ya existe el banner, no duplicar
    if (document.getElementById('pwa-install-banner')) return;

    // Verificar si el usuario lo cerró en las últimas 24 horas
    const bannerDismissed = localStorage.getItem('sira_pwa_dismissed');
    if (bannerDismissed && (Date.now() - parseInt(bannerDismissed)) < 86400000) {
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <img src="icons/icon-192.png" alt="SIRA App" style="width: 42px; height: 42px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <div>
                <strong style="display: block; font-size: 0.92rem; color: #f8fafc;">Instala SIRA en tu Teléfono</strong>
                <span style="font-size: 0.78rem; color: #94a3b8;">Acceso instantáneo a tus terapias y monitor IA</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btnPwaAction" style="background: #3b82f6; color: white; border: none; padding: 7px 15px; border-radius: 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(59,130,246,0.4);">
                <i class="fa-solid fa-download"></i> Instalar
            </button>
            <button id="btnPwaClose" style="background: transparent; border: none; color: #64748b; font-size: 1.1rem; cursor: pointer; padding: 6px;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    // Estilos inline fijos para garantizar visibilidad sin colisión
    Object.assign(banner.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '480px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.25)',
        borderRadius: '16px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: '9999',
        animation: 'pwaSlideUp 0.4s ease'
    });

    document.body.appendChild(banner);

    // Evento del botón Instalar
    document.getElementById('btnPwaAction').addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            console.log(`PWA: Decisión del usuario: ${outcome}`);
            deferredInstallPrompt = null;
            banner.remove();
        } else {
            // Caso iOS Safari o navegador sin soporte nativo de prompt
            mostrarGuiaInstalacionIOS();
        }
    });

    // Evento cerrar
    document.getElementById('btnPwaClose').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('sira_pwa_dismissed', Date.now().toString());
    });
}

// 5. GUÍA ESPECIAL PARA IPHONE / IPAD (SAFARI)
function mostrarGuiaInstalacionIOS() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (window.Swal) {
        Swal.fire({
            title: '¡Instala SIRA en tu Celular!',
            html: isIOS ? `
                <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; color: #cbd5e1;">
                    <p style="margin-bottom: 10px;">Para tener el icono de SIRA en tu iPhone sin App Store:</p>
                    <ol style="padding-left: 20px; margin: 0;">
                        <li>Toca el botón <strong>Compartir</strong> <i class="fa-solid fa-arrow-up-from-bracket" style="color: #38bdf8;"></i> en la barra inferior de Safari.</li>
                        <li>Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong> <i class="fa-regular fa-square-plus" style="color: #10b981;"></i>.</li>
                        <li>Toca <strong>Añadir</strong> en la esquina superior derecha.</li>
                    </ol>
                </div>
            ` : `
                <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; color: #cbd5e1;">
                    <p>En el menú de tu navegador (los tres puntos <i class="fa-solid fa-ellipsis-vertical"></i> arriba a la derecha), selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>
                </div>
            `,
            icon: 'info',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'Entendido'
        });
    } else {
        alert("En el menú de tu navegador selecciona 'Instalar aplicación' o 'Añadir a la pantalla de inicio' para tener el icono de SIRA.");
    }
}

// Escuchar cuando la app se haya instalado
window.addEventListener('appinstalled', () => {
    console.log('🎉 SIRA PWA ha sido instalada exitosamente en el dispositivo');
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
});

// Función accesible globalmente por si un botón en el menú quiere disparar la instalación
window.instalarPWA = () => {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
    } else {
        mostrarGuiaInstalacionIOS();
    }
};
