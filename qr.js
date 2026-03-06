let html5QrCode = null;
let scannerTransitionQueue = Promise.resolve();

function showHostQR(url) {
    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';

    new QRCode(qrcodeContainer, {
        text: url,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('host-url').innerText = url;
}

/**
 * Robustly stops the scanner by queuing the action behind any pending transitions.
 */
async function stopQRScanner() {
    return (scannerTransitionQueue = scannerTransitionQueue.then(async () => {
        if (!html5QrCode) return;

        try {
            // Check state to avoid redundant or illegal stop calls
            // 2 = SCANNING, 3 = PAUSED
            const state = html5QrCode.getState();
            if (state === 2 || state === 3) {
                await html5QrCode.stop();
            }

            html5QrCode.clear();
            html5QrCode = null;
            const reader = document.getElementById("reader");
            if (reader) reader.innerHTML = "";
            console.log("Scanner stopped and cleared successfully.");
        } catch (err) {
            console.warn("Scanner stop/clear catch:", err);
            html5QrCode = null; // Force nullification to allow fresh starts
        }
    }).catch(err => {
        console.error("Transition Queue Error (Stop):", err);
        html5QrCode = null;
    }));
}

async function startQRScanner(onSuccess) {
    // 1. Queue the start action
    return (scannerTransitionQueue = scannerTransitionQueue.then(async () => {
        // Clear anything existing first within the queue
        if (html5QrCode) {
            const state = html5QrCode.getState();
            if (state === 2 || state === 3) await html5QrCode.stop();
            html5QrCode.clear();
        }

        const reader = document.getElementById("reader");
        if (!reader) return;

        html5QrCode = new Html5Qrcode("reader");
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    // Trigger stop (which will be queued)
                    stopQRScanner().then(() => onSuccess(decodedText));
                },
                () => { /* parse err ignore */ }
            );
            console.log("Scanner started successfully.");
        } catch (e) {
            console.error("Scanner Start Error:", e);
            document.getElementById('join-status').innerText = "Kamera-Fehler: " + e.message;
            html5QrCode = null;
        }
    }).catch(err => {
        console.error("Transition Queue Error (Start):", err);
        html5QrCode = null;
    }));
}
