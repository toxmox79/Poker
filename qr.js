let html5QrCode;

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

function startQRScanner(onSuccess) {
    const readerContainer = document.getElementById("reader");
    readerContainer.innerHTML = ""; // Clear existing

    try {
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start({ facingMode: "environment" }, config,
            (decodedText) => {
                html5QrCode.stop().then(() => {
                    onSuccess(decodedText);
                }).catch(err => console.error("Filter stop error", err));
            },
            (errorMessage) => {
                // Ignore general parse errors as they fire continuously
            }
        ).catch(err => {
            document.getElementById('join-status').innerText = "Kamerazugriff verweigert oder Error: " + err;
            console.error("QR Start Error:", err);
        });
    } catch (e) {
        document.getElementById('join-status').innerText = "QR Scanner Init Error: " + e.message;
    }
}
