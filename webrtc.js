// Netzwerk-Erkennung
const isLocal = window.location.hostname === 'fritz.box' || window.location.hostname.startsWith('192.168.') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

console.log(isLocal ? 'Fritzbox-Modus aktiv (Lokal)' : 'Global-Modus aktiv (GitHub Pages)');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('network-info').innerText = isLocal ? 'Lokaler Modus (Fritzbox / LAN)' : 'Globaler Modus (GitHub Pages / Internet)';

    if (!isLocal && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        alert("Warnung: Webcams funktionieren in vielen Browsern nur über HTTPS. Bitte nutze GitHub Pages (HTTPS).");
    }
});

const peerConfig = isLocal ? {
    iceServers: [] // Lokaler Modus: Kein TURN/STUN notwendig, Priorität auf P2P im WLAN (<50ms)
} : {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

let peer;
let isHost = false;
let connections = {}; // Host: Speichert alle Verbindungen (Schlüssel: peerId)
let hostConnection;   // Client: Speichert Verbindung zum Host

// Host initialisieren
function initHost(onReady, onData, onConnection) {
    isHost = true;
    peer = new Peer(undefined, { config: peerConfig, debug: 2 });

    peer.on('open', (id) => {
        console.log('Host ID:', id);
        onReady(id);
    });

    peer.on('connection', (conn) => {
        connections[conn.peer] = conn;

        conn.on('open', () => {
            console.log('Client joined:', conn.peer);
            onConnection(conn.peer);
        });

        conn.on('data', (data) => {
            onData(conn.peer, data);
        });

        conn.on('close', () => {
            delete connections[conn.peer];
            console.log('Client left:', conn.peer);
            // Notify game about disconnect
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}

// Host sendet Update an alle Clients
function broadcast(data) {
    if (!isHost) return;
    Object.values(connections).forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

// Host sendet Update spezifisch an einen Client (zB private Karten)
function sendTo(peerId, data) {
    const conn = connections[peerId];
    if (conn && conn.open) {
        conn.send(data);
    }
}

// Client beitreten
function joinHost(hostId, onReady, onData, onError) {
    isHost = false;
    peer = new Peer(undefined, { config: peerConfig, debug: 2 });

    peer.on('open', (id) => {
        console.log('My ID:', id);
        hostConnection = peer.connect(hostId);

        hostConnection.on('open', () => {
            console.log('Connected to Host!');
            onReady(id);
        });

        hostConnection.on('data', (data) => {
            onData(data);
        });

        hostConnection.on('close', () => {
            console.log('Host disconnected.');
            onError('Host hat das Spiel beendet.');
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        onError("Verbindungsfehler: " + err.type);
    });
}

function sendToHost(data) {
    if (hostConnection && hostConnection.open) {
        hostConnection.send(data);
    }
}
