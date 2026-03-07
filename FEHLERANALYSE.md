# Poker Game Night - Fehleranalyse

## 🔍 Gefundene Fehler und Probleme

### 1. **KRITISCH: Scripts werden zu früh initialisiert** ⚠️
**Problem:** In `app.js` werden Event-Listener mit `document.querySelectorAll()` am oberen Bereich registriert, aber die HTML-Elemente existieren noch nicht.

**Linie:** `app.js` Zeile 49-73 (`.admin-adj` Button Event-Listener)
```javascript
document.querySelectorAll('.admin-adj').forEach(btn => {
    btn.addEventListener('click', (e) => { ... });
});
```

**Ursache:** Die Event-Listener werden beim Laden von `app.js` registriert, aber `.admin-adj` Buttons existieren erst später im HTML.

**Lösung:** Diese Event-Listener müssen in einen `DOMContentLoaded` Event oder am Ende der Datei verschoben werden.

---

### 2. **KRITISCH: Fehlende `hostBotCount` Variable**
**Problem:** In `app.js` Zeile 235 wird `hostBotCount` verwendet, ist aber nirgends initialisiert.
```javascript
for (let i = 0; i < hostBotCount; i++) {  // hostBotCount ist undefined!
```

**Lösung:** Folgende Zeile zu Beginn hinzufügen:
```javascript
let hostBotCount = 0;
```

---

### 3. **FEHLER: `updateLobbyUI()` ist undefiniert**
**Problem:** Mehrere Funktionen rufen `updateLobbyUI()` auf (z.B. Zeile 77, 246), aber die Funktion wird nach `startHostMode()` definiert.

**Linie:** Wird aufgerufen, bevor definiert.

**Lösung:** Die Funktionsdefinition muss vor der ersten Nutzung stehen.

---

### 4. **FEHLER: `broadcastGameState()` wird vor Definition aufgerufen**
**Problem:** Zeile 246 ruft `broadcastGameState()` auf, wird aber erst später definiert.

**Lösung:** Alle Funktionsdefinitionen sollten vor ihren Aufrufen stehen.

---

### 5. **WARNUNG: Undefined `currentMaxRaise` in Raise-Handler**
**Problem:** In app.js Zeile 888:
```javascript
} else if (action === 'allin') {
    payload.type = 'raise';
    payload.amount = window.currentMaxRaise;  // ← Undefined!
```

**Lösung:** Sollte `myPlayer.chips` sein:
```javascript
payload.amount = myPlayer.chips + (state.currentBet - myPlayer.bet);
```

---

### 6. **HTML/CSS: Fehlende `bg-color` CSS Variable**
**Problem:** In `index.html` wird `var(--bg-color)` verwendet, aber nicht in CSS definiert.

**Lösung:** In `style.css` definieren.

---

### 7. **FEHLER: `hostBotCount` Initialisierung fehlt in `startHostMode()`**
**Problem:** Zeile 217 setzt `hostBotCount = 0`, aber danach wird in Zeile 235 die alte `numBots` Variable verwendet, nicht `hostBotCount`.

```javascript
hostBotCount = 0;  // aber später wird `numBots` nicht mit diesem Wert gesetzt!
```

---

### 8. **Scripts Ladereihenfolge prüfen**
Die Scripts werden in dieser Reihenfolge geladen:
1. `cardmeister.js` ✅
2. `webrtc.js` ✅
3. `qr.js` ✅
4. `cards.js` ✅
5. `app.js` ⚠️ (verwendet all die obigen, aber Event-Listener zu früh registriert)

---

## 📋 Zusammenfassung der Fixes

| Problem | Kategorie | Schweregrad |
|---------|-----------|------------|
| Event-Listener zu früh registriert | Logic | 🔴 Kritisch |
| `hostBotCount` undefined | Logic | 🔴 Kritisch |
| `updateLobbyUI()` undefined beim Aufruf | Sequential | 🔴 Kritisch |
| `broadcastGameState()` undefined beim Aufruf | Sequential | 🔴 Kritisch |
| `currentMaxRaise` undefined | Logic | 🟠 Wichtig |
| Fehlende CSS Variablen | Styling | 🟡 Minor |

---

## ✅ Empfohlene Fixes

1. Wrap alle Event-Listener in `DOMContentLoaded`
2. Initialisiere `hostBotCount = 0` am Anfang von `app.js`
3. Verschiebe Funktionsdefinitionen vor ihre Nutzung
4. Fixe `currentMaxRaise` in All-In Handler
5. Definiere fehlende CSS Variablen
