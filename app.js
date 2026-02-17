// PWA: Service Worker + instalación
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}

var installPrompt;
var installWrapper = document.getElementById('installWrapper');
var installBtn = document.getElementById('installBtn');
var installDismiss = document.getElementById('installDismiss');

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installPrompt = e;
    if (!localStorage.getItem('arcadeInstallDismissed')) {
        installWrapper.classList.add('visible');
    }
});

if (installBtn) installBtn.addEventListener('click', async function () {
    if (!installPrompt) return;
    installPrompt.prompt();
    var result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') installWrapper.classList.remove('visible');
    installPrompt = null;
});

if (installDismiss) installDismiss.addEventListener('click', function () {
    installWrapper.classList.remove('visible');
    localStorage.setItem('arcadeInstallDismissed', 'true');
});

window.addEventListener('appinstalled', function () {
    installWrapper.classList.remove('visible');
    localStorage.setItem('arcadeInstallDismissed', 'true');
});
