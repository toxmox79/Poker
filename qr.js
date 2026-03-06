let html5QrCode = null;
let isScannerRunning = false;
let isScannerInitializing = false;

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
 * Robustly stops the scanner and clears the internal state/DOM.
 */
async function stopQRScanner() {
    if (html5QrCode) {
        try {
            if (isScannerRunning) {
                await html5QrCode.stop();
            }
            // Aggressive cleanup for mobile stability
            html5QrCode.clear();
            html5QrCode = null;
            isScannerRunning = false;
            const reader = document.getElementById("reader");
            if (reader) reader.innerHTML = "";
        } catch (err) {
            console.warn("Scanner stop/clear error:", err);
            html5QrCode = null; // Force reset anyway
            isScannerRunning = false;
        }
    }
}

async function startQRScanner(onSuccess) {
    if (isScannerInitializing) return;
    isScannerInitializing = true;

    // 1. Full cleanup before starting fresh
    await stopQRScanner();

    try {
        const reader = document.getElementById("reader");
        if (!reader) throw new Error("Reader element not found");

        // Always create a NEW instance to avoid reused state crashes
        html5QrCode = new Html5Qrcode("reader");

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            async (decodedText) => {
                isScannerRunning = true;
                await stopQRScanner();
                onSuccess(decodedText);
            },
            () => { /* ignore parse errors */ }
        );

        isScannerRunning = true;
    } catch (e) {
        isScannerRunning = false;
        html5QrCode = null;
        document.getElementById('join-status').innerText = "Kamera-Fehler: " + e.message;
        console.error("Scanner Start Error:", e);
    } finally {
        isScannerInitializing = false;
    }
}
