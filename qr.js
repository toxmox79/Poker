let html5QrCode = null;
let isScannerRunning = false;

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

async function stopQRScanner() {
    if (html5QrCode && isScannerRunning) {
        try {
            await html5QrCode.stop();
            isScannerRunning = false;
        } catch (err) {
            console.warn("Scanner stop error (might be already stopped):", err);
        }
    }
}

async function startQRScanner(onSuccess) {
    // 1. Ensure any previous instance is stopped and cleared
    await stopQRScanner();
    const readerContainer = document.getElementById("reader");
    readerContainer.innerHTML = "";

    try {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.start({ facingMode: "environment" }, config,
            async (decodedText) => {
                isScannerRunning = true; // Mark as running so stop knows to act
                await stopQRScanner();
                onSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore parse errors
            }
        );
        isScannerRunning = true;
    } catch (e) {
        isScannerRunning = false;
        document.getElementById('join-status').innerText = "QR Scanner Error: " + e.message;
        console.error("Scanner Start Error:", e);
    }
}
