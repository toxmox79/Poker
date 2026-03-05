// Audio
const sounds = {
    click: document.getElementById('snd-click'),
    chip: document.getElementById('snd-chip'),
    card: document.getElementById('snd-card')
};

function playSound(type) {
    if (sounds[type] && sounds[type].readyState >= 2) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(e => { });
    }
}

// UI Navigation
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function fullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => { });
    }
}

// ==========================
// BOT COUNT SELECTORS
// ==========================
let botCount = 1; // Solo mode bot count (home screen not shown anymore, kept for solo)

// Host-screen bot selector
let hostBotCount = 0;
document.querySelectorAll('.host-bot-adj').forEach(btn => {
    btn.addEventListener('click', () => {
        let delta = parseInt(btn.dataset.delta);
        hostBotCount = Math.max(0, Math.min(2, hostBotCount + delta));
        document.getElementById('host-bot-count').value = hostBotCount;
        document.getElementById('host-bot-count-display').innerText = hostBotCount;
        // Allow starting with bots even without human guests
        if (hostBotCount > 0) {
            document.getElementById('btn-start').disabled = false;
        } else if (gameState.players.filter(p => !p.isBot).length < 2) {
            document.getElementById('btn-start').disabled = true;
        }
        // Sync live bot list in game state lobby
        updateHostBots();
    });
});

function updateHostBots() {
    // Remove existing bots, then add correct number
    gameState.players = gameState.players.filter(p => !p.isBot);
    for (let i = 0; i < hostBotCount; i++) {
        gameState.players.push({
            id: `bot_${i}`, name: BOT_NAMES[i], chips: 1000, bet: 0,
            cards: [], active: true, folded: false, isBot: true
        });
    }
    updateLobbyUI();
}


// ==========================
// GAME STATE
// ==========================
let gameState = {
    hostId: null,
    phase: 'lobby',
    pot: 0,
    currentBet: 0,
    communityCards: [],
    players: [], // { id, name, chips, cards, bet, active, folded, isBot }
    turnIndex: 0,
    dealerIndex: 0,
    deck: []
};
let myPlayerId = null;
let soloMode = false;

// ==========================
// BOT NAMES
// ==========================
const BOT_NAMES = ['🤖 Alex', '🤖 Max'];

// ==========================
// BOT AI LOGIC
// ==========================
function botDecide(botPlayer) {
    const currentBet = gameState.currentBet;
    const toCall = currentBet - botPlayer.bet;
    const hand = [...botPlayer.cards, ...gameState.communityCards];
    const handScore = evaluateHand(hand);

    // Simple AI heuristic based on hand score
    const rand = Math.random();

    // Strong hand: raise
    if (handScore > 60 && rand < 0.5) {
        const raiseAmount = Math.min(botPlayer.chips, 20 + Math.floor(rand * 80));
        return { type: 'raise', amount: raiseAmount };
    }
    // Medium: call
    if (handScore > 45 || toCall === 0) {
        return { type: 'call' };
    }
    // Weak: maybe fold
    if (rand < 0.6) {
        return { type: 'fold' };
    }
    return { type: 'call' };
}

function scheduleBotTurn() {
    const p = gameState.players[gameState.turnIndex];
    if (!p || !p.isBot) return;

    // Delay 1–2s to simulate thinking
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
        // Re-check it's still the bot's turn (could have changed)
        const current = gameState.players[gameState.turnIndex];
        if (!current || !current.isBot) return;

        const action = botDecide(current);
        handleClientAction(current.id, action);
    }, delay);
}

// ==========================
// SOLO MODE
// ==========================
document.getElementById('btn-solo').addEventListener('click', () => {
    fullScreen();
    playSound('click');
    soloMode = true;
    myPlayerId = 'host';
    isHost = true;

    gameState.players = [];
    // Human player
    gameState.players.push({
        id: 'host', name: 'Du', chips: 1000, bet: 0,
        cards: [], active: true, folded: false, isBot: false
    });
    // Add bots
    const numBots = Math.max(1, botCount); // at least 1 bot in solo
    for (let i = 0; i < numBots; i++) {
        gameState.players.push({
            id: `bot_${i}`, name: BOT_NAMES[i], chips: 1000, bet: 0,
            cards: [], active: true, folded: false, isBot: true
        });
    }

    startGame();
});

// ==========================
// HOST MULTIPLAYER
// ==========================
document.getElementById('btn-host').addEventListener('click', () => {
    fullScreen();
    playSound('click');
    showScreen('screen-host');
    soloMode = false;
    hostBotCount = 0;
    gameState.players = []; // reset

    initHost((roomId) => {
        gameState.hostId = roomId;
        myPlayerId = 'host';
        gameState.players.unshift({
            id: 'host', name: 'Host Player', chips: 1000, bet: 0,
            cards: [], active: true, folded: false, isBot: false
        });

        const hostUrl = `${window.location.origin}${window.location.pathname}#join?room=${roomId}`;
        showHostQR(hostUrl);
        updateLobbyUI();
        document.getElementById('lobby-id').innerText = roomId;
        // Start only enabled once bots or guests are added
    }, (peerId, data) => {
        handleClientAction(peerId, data);
    }, (peerId) => {
        gameState.players.push({
            id: peerId, name: `Spieler ${gameState.players.length + 1}`,
            chips: 1000, bet: 0, cards: [], active: true, folded: false, isBot: false
        });
        updateLobbyUI();
        document.getElementById('btn-start').disabled = false;
        broadcastGameState();
    });
});

document.getElementById('btn-start').addEventListener('click', () => {
    playSound('click');
    // In host multiplayer, sync the selected bot count before starting
    if (!soloMode) {
        updateHostBots();
    }
    startGame();
});

function updateLobbyUI() {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    gameState.players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = p.name;
        list.appendChild(li);
    });
    document.getElementById('player-count').innerText = gameState.players.length;
}

// ==========================
// GAME LOGIC
// ==========================
function startGame() {
    gameState.phase = 'pre-flop';
    gameState.pot = 0;
    gameState.deck = shuffle(createDeck());
    gameState.communityCards = [];

    // Remove bankrupt players
    gameState.players = gameState.players.filter(p => p.chips > 0);
    if (gameState.players.length < 2) {
        const winner = gameState.players[0];
        addLog(`🏆 ${winner ? winner.name : 'Unbekannt'} gewinnt das Spiel!`);
        return;
    }

    gameState.players.forEach(p => {
        p.cards = [gameState.deck.pop(), gameState.deck.pop()];
        p.bet = 0;
        p.active = true;
        p.folded = false;
    });

    gameState.dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    let sbIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    let bbIndex = (gameState.dealerIndex + 2) % gameState.players.length;
    gameState.turnIndex = (gameState.dealerIndex + 3) % gameState.players.length;

    // Post blinds
    let sb = gameState.players[sbIndex];
    let bb = gameState.players[bbIndex];
    let sbAmount = Math.min(10, sb.chips);
    let bbAmount = Math.min(20, bb.chips);
    sb.chips -= sbAmount; sb.bet = sbAmount;
    bb.chips -= bbAmount; bb.bet = bbAmount;
    gameState.pot += sbAmount + bbAmount;
    gameState.currentBet = bbAmount;

    addLog(`--- Neue Runde! Dealer: ${gameState.players[gameState.dealerIndex].name} ---`);
    broadcastGameState();
    renderGame(gameState, myPlayerId);

    // Bot-turn check after blinds
    scheduleBotTurn();
}

function nextPhase() {
    if (gameState.phase === 'pre-flop') {
        gameState.phase = 'flop';
        gameState.communityCards.push(gameState.deck.pop(), gameState.deck.pop(), gameState.deck.pop());
    } else if (gameState.phase === 'flop') {
        gameState.phase = 'turn';
        gameState.communityCards.push(gameState.deck.pop());
    } else if (gameState.phase === 'turn') {
        gameState.phase = 'river';
        gameState.communityCards.push(gameState.deck.pop());
    } else if (gameState.phase === 'river') {
        gameState.phase = 'showdown';
        resolveShowdown();
        return;
    }

    // Reset bets for new phase
    gameState.currentBet = 0;
    gameState.players.forEach(p => { p.bet = 0; });
    gameState.turnIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    skipFoldedOrBankruptPlayers();

    addLog(`→ Phase: ${gameState.phase}`);
    broadcastGameState();
    renderGame(gameState, myPlayerId);
    scheduleBotTurn();
}

function resolveShowdown() {
    // Reveal all cards in render
    addLog('--- Showdown! ---');
    let bestScore = -1;
    let winners = [];

    gameState.players.forEach((p, idx) => {
        if (!p.folded && p.chips >= 0) {
            let score = evaluateHand([...p.cards, ...gameState.communityCards]);
            if (score > bestScore) {
                bestScore = score;
                winners = [idx];
            } else if (score === bestScore) {
                winners.push(idx);
            }
        }
    });

    let prize = Math.floor(gameState.pot / (winners.length || 1));
    winners.forEach(i => {
        gameState.players[i].chips += prize;
        addLog(`🏆 ${gameState.players[i].name} gewinnt ${prize} Chips!`);
    });

    gameState.pot = 0;
    broadcastGameState();
    renderGame(gameState, myPlayerId);

    setTimeout(() => {
        startGame();
    }, 4000);
}

function log(msg) {
    if (!soloMode) broadcast({ type: 'log', msg: msg });
    addLog(msg);
}

function advanceTurn() {
    let activePlayers = gameState.players.filter(p => !p.folded && p.chips >= 0);
    if (activePlayers.length === 1) {
        activePlayers[0].chips += gameState.pot;
        gameState.pot = 0;
        addLog(`${activePlayers[0].name} gewinnt kampflos.`);
        broadcastGameState();
        renderGame(gameState, myPlayerId);
        setTimeout(() => startGame(), 2500);
        return;
    }

    // Check if all active bettors are square
    let roundComplete = true;
    for (let p of gameState.players) {
        if (!p.folded && p.chips > 0 && p.bet < gameState.currentBet) {
            roundComplete = false; break;
        }
    }

    if (roundComplete) {
        nextPhase();
        return;
    }

    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
    skipFoldedOrBankruptPlayers();

    broadcastGameState();
    renderGame(gameState, myPlayerId);
    scheduleBotTurn();
}

function skipFoldedOrBankruptPlayers() {
    let loopProtect = 0;
    while (loopProtect < gameState.players.length + 1) {
        let p = gameState.players[gameState.turnIndex];
        if (p.folded || p.chips === 0) {
            gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
        } else {
            break;
        }
        loopProtect++;
    }
}

function handleClientAction(peerId, action) {
    let pIdx = gameState.players.findIndex(p => p.id === peerId);
    if (pIdx === -1 || pIdx !== gameState.turnIndex || gameState.phase === 'showdown') return;

    let p = gameState.players[pIdx];

    if (action.type === 'fold') {
        p.folded = true;
        addLog(`${p.name} foldet.`);
    } else if (action.type === 'call') {
        let toCall = gameState.currentBet - p.bet;
        let diff = Math.min(toCall, p.chips);
        p.chips -= diff;
        p.bet += diff;
        gameState.pot += diff;
        addLog(diff === 0 ? `${p.name} checkt.` : `${p.name} callt ${diff}.`);
    } else if (action.type === 'raise') {
        let amount = action.amount;
        let totalVal = gameState.currentBet + amount;
        let toPutIn = totalVal - p.bet;
        let diff = Math.min(toPutIn, p.chips);
        p.chips -= diff;
        p.bet += diff;
        gameState.pot += diff;
        if (p.bet > gameState.currentBet) gameState.currentBet = p.bet;
        addLog(`${p.name} erhöht um ${amount}.`);
    }

    playSound('chip');
    advanceTurn();
}

function broadcastGameState() {
    if (soloMode) return; // no network in solo mode
    gameState.players.forEach(p => {
        if (p.isBot) return; // no network for bots
        let stateCopy = JSON.parse(JSON.stringify(gameState));
        if (stateCopy.phase !== 'showdown') {
            stateCopy.players.forEach(op => {
                if (op.id !== p.id) op.cards = op.cards.map(() => 'hidden');
            });
        }
        if (p.id === 'host') {
            // host re-renders locally
        } else {
            sendTo(p.id, { type: 'state', state: stateCopy });
        }
    });
}

// ==========================
// CLIENT JOIN
// ==========================
function connectToRoom(roomId) {
    document.getElementById('join-status').innerText = "Verbinde...";
    joinHost(roomId, (id) => {
        myPlayerId = id;
        showScreen('screen-game');
    }, (data) => {
        if (data.type === 'state') {
            renderGame(data.state, myPlayerId);
        } else if (data.type === 'log') {
            addLog(data.msg);
        }
    }, (err) => {
        alert(err);
        showScreen('screen-home');
    });
}

document.getElementById('btn-join').addEventListener('click', () => {
    fullScreen();
    playSound('click');
    showScreen('screen-join');
    startQRScanner((text) => {
        try {
            const urlMatch = text.match(/room=([^&]+)/);
            connectToRoom(urlMatch ? urlMatch[1] : text);
        } catch (e) {
            alert('Ungültiger QR Code');
        }
    });
});

document.getElementById('btn-manual-join').addEventListener('click', () => {
    let code = document.getElementById('manual-room-id').value;
    if (code) {
        if (html5QrCode) html5QrCode.stop().catch(e => { });
        connectToRoom(code);
    }
});

// ==========================
// RENDER
// ==========================
function renderGame(state, myId) {
    showScreen('screen-game');
    document.getElementById('pot-info').innerText = 'Pot: ' + state.pot;

    const commArea = document.getElementById('community-cards');
    commArea.innerHTML = '';
    state.communityCards.forEach(c => { commArea.innerHTML += getCardHTML(c); });

    const oppArea = document.getElementById('opponents-area');
    oppArea.innerHTML = '';

    let turnPlayer = state.players[state.turnIndex];
    let isMyTurn = turnPlayer && turnPlayer.id === myId;

    state.players.forEach((p, idx) => {
        if (p.id === myId) {
            document.getElementById('my-name').innerText = p.name;
            document.getElementById('my-chips').innerText = `💰 ${p.chips}`;
            document.getElementById('current-bet').innerText = `Bet: ${p.bet}`;

            const myCardsArea = document.getElementById('my-cards');
            myCardsArea.innerHTML = '';
            p.cards.forEach(c => { myCardsArea.innerHTML += getCardHTML(c); });

            const controls = document.getElementById('controls');
            if (isMyTurn && state.phase !== 'showdown') {
                controls.classList.remove('controls-hidden');
            } else {
                controls.classList.add('controls-hidden');
            }

            let toCall = state.currentBet - p.bet;
            document.getElementById('btn-call').innerText = toCall > 0 ? `Call ${toCall}` : 'Check';

        } else {
            let opDiv = document.createElement('div');
            let isActive = idx === state.turnIndex;
            opDiv.className = `opponent ${isActive ? 'active' : ''}`;
            let isBotP = p.isBot;

            // Show cards at showdown, or hidden face-down
            let cardsHtml;
            if (state.phase === 'showdown' || (soloMode && isBotP)) {
                // In solo showdown, reveal bot cards
                cardsHtml = p.cards.map(c => c === 'hidden'
                    ? '🂠'
                    : `<span class="${(c[1] === '♥' || c[1] === '♦') ? 'red' : ''}">${c[0] === 'T' ? '10' : c[0]}${c[1]}</span>`
                ).join(' ');
            } else {
                cardsHtml = p.cards.map(() => '🂠').join(' ');
            }

            opDiv.innerHTML = `
                <div>${p.name}${isBotP ? '' : ''}</div>
                <div class="chip-count">💰 ${p.chips}</div>
                <div class="status">${p.folded ? '❌ Folded' : 'Bet: ' + p.bet}</div>
                <div style="font-size:1.4rem; letter-spacing:4px">${cardsHtml}</div>
            `;
            oppArea.appendChild(opDiv);
        }
    });
}

function addLog(msg) {
    const logBox = document.getElementById('game-log');
    const div = document.createElement('div');
    div.innerText = msg;
    logBox.appendChild(div);
    // keep last 8 lines shown
    while (logBox.children.length > 8) logBox.removeChild(logBox.firstChild);
}

// ==========================
// ACTION BUTTONS
// ==========================
document.getElementById('btn-fold').addEventListener('click', () => {
    playSound('click');
    if (isHost || soloMode) handleClientAction(myPlayerId, { type: 'fold' });
    else sendToHost({ type: 'fold' });
});

document.getElementById('btn-call').addEventListener('click', () => {
    playSound('chip');
    if (isHost || soloMode) handleClientAction(myPlayerId, { type: 'call' });
    else sendToHost({ type: 'call' });
});

const raiseSlider = document.getElementById('raise-slider');
raiseSlider.addEventListener('input', (e) => {
    document.getElementById('raise-amount').innerText = e.target.value;
});

document.getElementById('btn-raise').addEventListener('click', () => {
    playSound('chip');
    let amount = parseInt(raiseSlider.value);
    if (isHost || soloMode) handleClientAction(myPlayerId, { type: 'raise', amount });
    else sendToHost({ type: 'raise', amount });
});

// ==========================
// URL JOIN PARSE
// ==========================
window.addEventListener('load', () => {
    if (window.location.hash.startsWith('#join?room=')) {
        const roomId = window.location.hash.split('room=')[1];
        if (roomId) {
            document.getElementById('manual-room-id').value = roomId;
            showScreen('screen-join');
        }
    }
});
