# Poker Game Night (PWA) ♠♥♦♣

Eine Dual-Hosting-fähige Progressive Web App (PWA) für lokales Multiplayer Texas Hold'em Poker. Funktioniert wie Amazon Luna GameNight, jedoch rein im Browser über WebRTC – ganz ohne Backend!

![PWA fähig](https://img.shields.io/badge/PWA-Ready-success)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow)

## 📡 Dual-Hosting Varianten

### 1. Global (GitHub Pages) [Empfohlen]
Nutze das verlässliche und sichere HTTPS-Hosting via GitHub:
1. Klicke auf `Use this template` oder clone dieses Repository.
2. Gehe in deinem GitHub Repository auf **Settings > Pages**.
3. Wähle **Deploy from a branch** und wähle deinen `main` Branch (Ordner: `/root` oder `/docs`).
4. Klicke **Save**. Die App ist in wenigen Minuten unter `https://dein-username.github.io/poker/` erreichbar.
*(Vorteil: HTTPS wird für die Kamera-Erlaubnis beim Scannen des QR-Codes von vielen Browsern zwingend vorausgesetzt!)*

### 2. Lokal (Fritzbox USB-NAS)
Perfekt für Partys ohne Internet, extrem niedrige Latenz (<50ms):
1. Formatiere einen USB-Stick in `FAT32` oder `NTFS`.
2. Kopiere den gesamten Inhalt dieses Repositories in einen Ordner namens `/poker` auf den Stick.
3. Stecke den USB-Stick in die Fritzbox und aktiviere die **NAS-Funktion** (Heimnetzfreigabe).
4. Die App ist lokal erreichbar unter: `http://fritz.box/poker/` oder `http://192.168.178.1/poker/`.
*(Hinweis: Die App erkennt `fritz.box` / `192.168.` automatisch und priorisiert lokales P2P-Routing ohne STUN-Server).*

---

## 🎮 Features
* **Host-Modus:** Ein Spieler (z.B. auf einem Hisense TV oder Tablet) öffnet die App und klickt auf "Host". Es wird ein Lobby-QR-Code generiert.
* **Join-Modus:** Andere Spieler scannen den Code mit dem Smartphone und treten dem Spiel sofort bei (Kamera-Erlaubnis erforderlich). Alternativ kann die Room-ID manuell eingegeben werden.
* **PWA & Offline:** Caching durch Service Worker, offline installierbar (Home-Screen).
* **Texas Hold'em Logic:** Hand-Cards, Gemeinschaftskarten (Flop, Turn, River), Pot-Berechnung, Fold/Call/Raise-Aktionen.

## 🛠️ Tech-Stack
* **Vanilla JS, HTML5, CSS3** (Kein Build-Step erforderlich)
* **WebRTC:** Peer-to-Peer Kommunikation (mit [PeerJS](https://peerjs.com/))
* **QR-Codes:** `qrcode.js` (Host-Generierung) & `html5-qrcode` (Scanner)

## 🚀 Test-Skript (Simuliere das Spiel)
1. Öffne `index.html` im Browser (am besten über einen lokalen Server wie Live Server).
2. Klicke auf **Host Game** (Dieses Fenster ist jetzt der Tisch / Host).
3. Öffne 3 weitere Inkognito-Fenster, gehe zur gleichen URL.
4. Klicke in den neuen Fenstern auf **Join Game** und gib die **Room ID** aus dem Host-Fenster manuell ein.
5. Im Host-Fenster klicke auf **Spiel Starten**.

Viel Spaß beim Spielen! ♠♥♦♣
