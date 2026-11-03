// js/pwa-install.js - Gestión de Registro e Instalación de SIRA PWA

// 1. REGISTRAR EL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
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

// Detectar si está en el navegador interno de WhatsApp, Discord, Instagram, etc.
function esNavegadorInterno() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || 
           (ua.indexOf("FBAV") > -1) || 
           (ua.indexOf("Instagram") > -1) || 
           (ua.indexOf("WhatsApp") > -1) || 
           (ua.indexOf("Discord") > -1) ||
           (ua.indexOf("Line") > -1);
}

// 3. CAPTURAR EVENTO NATIVO DE INSTALACIÓN (CHROME / ANDROID / EDGE)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (!isStandalone) {
        mostrarBannerPWA();
    }
});

// Mostrar el banner automáticamente en móviles tras 1.2 segundos
document.addEventListener('DOMContentLoaded', () => {
    const isMobile = window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && !isStandalone) {
        setTimeout(() => {
            mostrarBannerPWA();
        }, 1200);
    }
});

// 4. CREAR EL BANNER FLOTANTE DE INSTALACIÓN
function mostrarBannerPWA() {
    if (isStandalone) return;
    if (document.getElementById('pwa-install-banner')) return;

    const bannerDismissed = localStorage.getItem('sira_pwa_dismissed');
    if (bannerDismissed && (Date.now() - parseInt(bannerDismissed)) < 43200000) { // 12 horas
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <img src="icons/icon-192.png" alt="SIRA App" style="width: 44px; height: 44px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); flex-shrink: 0;">
            <div style="overflow: hidden;">
                <strong style="display: block; font-size: 0.92rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Instalar App SIRA</strong>
                <span style="font-size: 0.78rem; color: #94a3b8; display: block;">Acceso rápido y monitor en vivo</span>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button id="btnPwaAction" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(59,130,246,0.4);">
                <i class="fa-solid fa-download"></i> Instalar
            </button>
            <button id="btnPwaClose" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; font-size: 1rem; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;

    Object.assign(banner.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '480px',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(59, 130, 246, 0.45)',
        boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.8), 0 0 25px rgba(59, 130, 246, 0.25)',
        borderRadius: '16px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: '99999',
        animation: 'pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    });

    document.body.appendChild(banner);

    document.getElementById('btnPwaAction').addEventListener('click', () => {
        window.instalarPWA();
    });

    document.getElementById('btnPwaClose').addEventListener('click', () => {
        banner.remove();
        localStorage.setItem('sira_pwa_dismissed', Date.now().toString());
    });
}

// 5. GUÍA Y DISPARADOR UNIVERSAL DE INSTALACIÓN
window.instalarPWA = async function() {
    // Caso 1: Navegador interno (WhatsApp, Discord, etc.)
    if (esNavegadorInterno()) {
        if (window.Swal) {
            Swal.fire({
                title: 'Abre en tu Navegador',
                html: `
                    <p style="color: #cbd5e1; font-size: 0.92rem; line-height: 1.5;">
                        Estás navegando dentro de WhatsApp o Discord, lo cual bloquea la instalación de aplicaciones y la cámara.
                    </p>
                    <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 12px; margin-top: 14px; text-align: left; font-size: 0.88rem; color: #93c5fd;">
                        <strong>Para instalarla:</strong><br>
                        1. Toca los tres puntos <i class="fa-solid fa-ellipsis-vertical"></i> arriba a la derecha.<br>
                        2. Elige <strong>"Abrir en Chrome"</strong> (en Android) o <strong>"Abrir en Safari"</strong> (en iPhone).
                    </div>
                `,
                icon: 'warning',
                confirmButtonColor: '#3b82f6',
                confirmButtonText: 'Entendido'
            });
        } else {
            alert("Para instalar la app, toca los tres puntos arriba y selecciona 'Abrir en Chrome' o 'Abrir en Safari'.");
        }
        return;
    }

    // Caso 2: Prompt nativo disponible (Android / Chrome)
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log(`PWA: Resultado: ${outcome}`);
        deferredInstallPrompt = null;
        const b = document.getElementById('pwa-install-banner');
        if (b) b.remove();
        return;
    }

    // Caso 3: iPhone / iPad (Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        if (window.Swal) {
            Swal.fire({
                title: 'Instalar en tu iPhone / iPad',
                html: `
                    <div style="text-align: left; font-size: 0.92rem; line-height: 1.6; color: #cbd5e1;">
                        <p style="margin-bottom: 12px;">Para tener SIRA en tu pantalla de inicio en pantalla completa:</p>
                        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px;">
                            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">1</span>
                                <span>Toca el botón <strong>Compartir</strong> <i class="fa-solid fa-arrow-up-from-bracket text-primary"></i> abajo en Safari.</span>
                            </div>
                            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">2</span>
                                <span>Desliza y selecciona <strong>"Añadir a la pantalla de inicio"</strong> <i class="fa-regular fa-square-plus text-success"></i>.</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">3</span>
                                <span>Pulsa <strong>Añadir</strong> en la esquina superior derecha.</span>
                            </div>
                        </div>
                    </div>
                `,
                icon: 'info',
                confirmButtonColor: '#3b82f6',
                confirmButtonText: '¡Listo, voy a hacerlo!'
            });
        } else {
            alert("En Safari, toca el botón de Compartir y selecciona 'Añadir a pantalla de inicio'.");
        }
        return;
    }

    // Caso 4: Android Chrome que no disparó el prompt automáticamente
    if (window.Swal) {
        Swal.fire({
            title: 'Instalar Aplicación SIRA',
            html: `
                <div style="text-align: left; font-size: 0.92rem; line-height: 1.6; color: #cbd5e1;">
                    <p style="margin-bottom: 10px;">Para añadir el acceso directo de SIRA a tu dispositivo:</p>
                    <ol style="padding-left: 20px; margin: 0;">
                        <li>Toca los tres puntos <i class="fa-solid fa-ellipsis-vertical" style="color: #38bdf8;"></i> en la esquina superior derecha del navegador.</li>
                        <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                        <li>Confirma en <strong>Instalar</strong>.</li>
                    </ol>
                </div>
            `,
            icon: 'info',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'Entendido'
        });
    } else {
        alert("En el menú de tres puntos (⋮) de tu navegador, selecciona 'Instalar aplicación' o 'Agregar a la pantalla principal'.");
    }
};

window.addEventListener('appinstalled', () => {
    console.log('🎉 SIRA PWA ha sido instalada exitosamente');
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
});
