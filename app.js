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
    let elem = document.documentElement;
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(e => { console.log("Fullscreen blocked: ", e); });
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }
}

// ==========================
// BOT COUNT SELECTORS
// ==========================
let botCount = 1; // Solo mode bot count (home screen not shown anymore, kept for solo)

// Unified Admin / Host UI Adjustments
document.querySelectorAll('.admin-adj').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        const delta = parseInt(e.target.getAttribute('data-delta'));
        const min = parseInt(e.target.getAttribute('data-min'));
        const max = parseInt(e.target.getAttribute('data-max'));
        const input = document.getElementById(targetId);
        const display = document.getElementById(targetId + '-display');

        let current = parseInt(input.value);
        let next = Math.max(min, Math.min(max, current + delta));
        input.value = next;

        // Custom display formatting
        if (e.target.hasAttribute('data-isblind')) {
            display.innerText = `${next} / ${next * 2}`;
        } else if (e.target.hasAttribute('data-istimer')) {
            display.innerText = next === 0 ? 'Nie' : `Alle ${next} Runden`;
        } else {
            display.innerText = next;
        }
        playSound('click');
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
    gameState.players = []; // reset (host is NOT a player anymore)

    // Check for localhost warning
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('localhost-warning').style.display = 'block';
    } else {
        document.getElementById('localhost-warning').style.display = 'none';
    }

    initHost((roomId) => {
        gameState.hostId = roomId;
        myPlayerId = 'host';

        const hostUrl = `${window.location.origin}${window.location.pathname}#join?room=${roomId}`;
        showHostQR(hostUrl);
        updateLobbyUI();
        document.getElementById('lobby-id').innerText = roomId;
    }, (peerId, data) => {
        if (data.type === 'admin_start_game') {
            // Admin triggered start
            setupBotsAndBlinds(data.config);
            startGame();
        } else {
            handleClientAction(peerId, data);
        }
    }, (peerId) => {
        // New player connected
        let isFirst = gameState.players.length === 0;

        gameState.players.push({
            id: peerId, name: `Spieler ${gameState.players.length + 1}${isFirst ? ' 👑' : ''}`,
            chips: 1000, bet: 0, cards: [], active: true, folded: false, isBot: false
        });

        if (isFirst) {
            // Grant admin rights to the first connected player
            sendTo(peerId, { type: 'admin_granted' });
        }

        updateLobbyUI();
        broadcastGameState();
    });
});

document.getElementById('btn-admin-start').addEventListener('click', () => {
    playSound('click');
    const config = {
        bots: parseInt(document.getElementById('admin-bot-count').value),
        startingChips: parseInt(document.getElementById('admin-chip-count').value),
        smallBlind: parseInt(document.getElementById('admin-blind-base').value),
        blindTimer: parseInt(document.getElementById('admin-blind-timer').value)
    };
    sendToHost({ type: 'admin_start_game', config: config });
});

function setupBotsAndBlinds(config) {
    // 1. Reset players to only human clients
    gameState.players = gameState.players.filter(p => !p.isBot);

    // 2. Set starting chips for everyone
    gameState.players.forEach(p => {
        p.chips = config.startingChips || 1000;
        p.bet = 0;
    });

    // 3. Add bots with the same starting chips
    const numBots = Math.max(0, config.bots);
    for (let i = 0; i < numBots; i++) {
        gameState.players.push({
            id: `bot_${i}`, name: BOT_NAMES[i % BOT_NAMES.length], chips: config.startingChips || 1000, bet: 0,
            cards: [], active: true, folded: false, isBot: true
        });
    }

    // 4. Save blind rules
    gameState.baseSmallBlind = config.smallBlind || 10;
    gameState.blindTimer = config.blindTimer || 0;
    gameState.roundCount = 0;
}

function updateLobbyUI() {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    gameState.players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = p.name;
        list.appendChild(li);
    });

    // The player array length in lobby includes bots if they were added.
    let humanCount = gameState.players.length;
    document.getElementById('player-count').innerText = humanCount;

    // Broadcast the updated count to the Admin screen if it exists
    let adminPlayerCountEl = document.getElementById('admin-player-count');
    if (adminPlayerCountEl) adminPlayerCountEl.innerText = humanCount;
}

// ==========================
// GAME LOGIC
// ==========================
function startGame() {
    gameState.phase = 'pre-flop';
    gameState.pot = 0;
    gameState.deck = shuffle(createDeck());
    gameState.communityCards = [];
    gameState.roundCount = (gameState.roundCount || 0) + 1;

    // Calculate dynamic blinds
    let sbVal = gameState.baseSmallBlind || 10;
    let bbVal = sbVal * 2;

    // Blind Escalation: Double blinds every 'blindTimer' rounds if timer > 0
    if (gameState.blindTimer > 0) {
        let multipliers = Math.floor((gameState.roundCount - 1) / gameState.blindTimer);
        if (multipliers > 0) {
            let factor = Math.pow(2, multipliers);
            sbVal *= factor;
            bbVal *= factor;
            addLog(`📈 Blinds erhöht auf ${sbVal} / ${bbVal}!`);
        }
    }

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
        p.actedInPhase = false;
    });

    gameState.dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    let sbIndex = (gameState.dealerIndex + 1) % gameState.players.length;
    let bbIndex = (gameState.dealerIndex + 2) % gameState.players.length;
    gameState.turnIndex = (gameState.dealerIndex + 3) % gameState.players.length; // UTG acts first

    // Post blinds
    let sb = gameState.players[sbIndex];
    let bb = gameState.players[bbIndex];
    let sbAmount = Math.min(sbVal, sb.chips);
    let bbAmount = Math.min(bbVal, bb.chips);
    sb.chips -= sbAmount; sb.bet = sbAmount;
    bb.chips -= bbAmount; bb.bet = bbAmount;
    gameState.currentBet = bbAmount;

    addLog(`--- Runde ${gameState.roundCount}! Blinds: ${sbVal}/${bbVal} ---`);
    broadcastGameState();
    renderGame(gameState, myPlayerId);

    // Bot-turn check after blinds
    scheduleBotTurn();
}

function nextPhase() {
    // Gather all bets into the main pot
    gameState.players.forEach(p => {
        gameState.pot += p.bet;
        p.bet = 0;
    });
    gameState.currentBet = 0;

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

    // First active player after dealer starts
    gameState.turnIndex = gameState.dealerIndex;
    gameState.players.forEach(p => p.actedInPhase = false);
    goToNextActivePlayer();

    // If only 1 player is left who is not all-in, and everyone else is all in, we can auto-resolve
    let playersWithAction = gameState.players.filter(p => !p.folded && p.chips > 0);
    if (playersWithAction.length <= 1) {
        // Fast forward to showdown
        addLog(`→ Fast Forward to Showdown (All-In)`);
        while (gameState.phase !== 'showdown') {
            if (gameState.phase === 'flop') {
                gameState.communityCards.push(gameState.deck.pop());
                gameState.phase = 'turn';
            } else if (gameState.phase === 'turn') {
                gameState.communityCards.push(gameState.deck.pop());
                gameState.phase = 'river';
            } else if (gameState.phase === 'river') {
                gameState.communityCards.push(gameState.deck.pop());
                gameState.phase = 'showdown';
                resolveShowdown();
                return;
            }
        }
        return;
    }

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
    let activePlayers = gameState.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
        // Everyone else folded
        gameState.players.forEach(p => { gameState.pot += p.bet; p.bet = 0; });
        activePlayers[0].chips += gameState.pot;
        gameState.pot = 0;
        addLog(`${activePlayers[0].name} gewinnt kampflos.`);
        broadcastGameState();
        renderGame(gameState, myPlayerId);
        setTimeout(() => startGame(), 2500);
        return;
    }

    // Check if round is complete:
    // Every active player must have acted this phase AND either called the max bet or gone all-in
    let roundComplete = true;
    for (let p of gameState.players) {
        if (!p.folded) {
            if (!p.actedInPhase) roundComplete = false;
            // if they still have chips and haven't matched the current bet, not done
            if (p.chips > 0 && p.bet < gameState.currentBet) {
                roundComplete = false;
            }
        }
    }

    if (roundComplete) {
        nextPhase();
        return;
    }

    goToNextActivePlayer();

    // Safety check - if we looped back and everyone is allin/folded, next phase immediately
    let playersWithAction = gameState.players.filter(p => !p.folded && p.chips > 0 && (p.bet < gameState.currentBet || !p.actedInPhase));
    if (playersWithAction.length === 0) {
        nextPhase();
        return;
    }

    broadcastGameState();
    renderGame(gameState, myPlayerId);
    scheduleBotTurn();
}

function goToNextActivePlayer() {
    let loopProtect = 0;
    while (loopProtect < gameState.players.length) {
        gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
        let p = gameState.players[gameState.turnIndex];
        // skip if folded or all-in (chips === 0 and matched max possible for them)
        if (!p.folded && p.chips > 0) {
            break;
        }
        loopProtect++;
    }
}

function handleClientAction(peerId, action) {
    let pIdx = gameState.players.findIndex(p => p.id === peerId);
    if (pIdx === -1 || pIdx !== gameState.turnIndex || gameState.phase === 'showdown') return;

    let p = gameState.players[pIdx];
    p.actedInPhase = true;

    if (action.type === 'fold') {
        p.folded = true;
        addLog(`${p.name} foldet.`);
    } else if (action.type === 'call') {
        let toCall = gameState.currentBet - p.bet;
        let diff = Math.min(toCall, p.chips);
        p.chips -= diff;
        p.bet += diff;
        if (p.chips === 0) addLog(`${p.name} ALL-IN (Call).`);
        else addLog(diff === 0 ? `${p.name} checkt.` : `${p.name} callt ${diff}.`);
    } else if (action.type === 'raise') {
        let amount = action.amount;
        let totalVal = gameState.currentBet + amount;
        let toPutIn = totalVal - p.bet;
        // if the amount requested to raise exceeds chips, cap it at all in
        let diff = Math.min(toPutIn, p.chips);

        // Ensure minimum raise logic if not going all-in
        let callCurrent = gameState.currentBet - p.bet;
        let actualRaiseAdded = diff - callCurrent;

        p.chips -= diff;
        p.bet += diff;
        if (p.bet > gameState.currentBet) gameState.currentBet = p.bet;

        if (p.chips === 0) addLog(`${p.name} ALL-IN! (${p.bet})`);
        else addLog(`${p.name} erhöht um ${actualRaiseAdded} auf ${p.bet}.`);

        // Raising re-opens the action for everyone else still active
        gameState.players.forEach(op => {
            if (op.id !== p.id && !op.folded) op.actedInPhase = false;
        });
    }

    playSound('chip');
    advanceTurn();
}

function broadcastGameState() {
    if (soloMode) return;

    // 1. Send personalized state to all human clients
    gameState.players.forEach(p => {
        if (p.isBot) return;

        let stateCopy = JSON.parse(JSON.stringify(gameState));
        const myIdNorm = String(p.id).toLowerCase().trim();

        if (stateCopy.phase !== 'showdown') {
            stateCopy.players.forEach(op => {
                const opIdNorm = String(op.id).toLowerCase().trim();
                if (opIdNorm !== myIdNorm) {
                    op.cards = op.cards.map(() => 'hidden');
                }
            });
        }

        // Host Diagnostic Log
        const myPlayerInState = stateCopy.players.find(pl => String(pl.id).toLowerCase().trim() === myIdNorm);
        console.log(`📡 Broadcast to ${p.id}: Cards=${JSON.stringify(myPlayerInState?.cards || [])}`);

        sendTo(p.id, { type: 'state', state: stateCopy });
    });

    // 2. Render locally for the TV Host (Spectator View)
    let hostStateCopy = JSON.parse(JSON.stringify(gameState));
    if (hostStateCopy.phase !== 'showdown') {
        hostStateCopy.players.forEach(op => {
            op.cards = op.cards.map(() => 'hidden');
        });
    }
    renderGame(hostStateCopy, 'host');
}

// ==========================
// CLIENT JOIN
// ==========================
// Temporary storage for pending join
let pendingRoomId = null;
let pendingAdminStatus = false;

function connectToRoom(roomId) {
    document.getElementById('join-status').innerText = "Verbinde...";
    joinHost(roomId, (id) => {
        myPlayerId = id;
        pendingRoomId = roomId;
        showScreen('screen-tap-to-join');
    }, (data) => {
        if (data.type === 'state') {
            renderGame(data.state, myPlayerId);
        } else if (data.type === 'log') {
            addLog(data.msg);
        } else if (data.type === 'admin_granted') {
            pendingAdminStatus = true;
        }
    }, (err) => {
        alert(err);
        showScreen('screen-home');
    });
}

document.getElementById('btn-tap-to-join').addEventListener('click', () => {
    fullScreen();
    playSound('click');
    if (pendingAdminStatus) {
        showScreen('screen-admin-lobby');
    } else {
        showScreen('screen-game');
        document.getElementById('join-status').innerText = "Warte auf Spielstart durch Admin...";
    }
});

document.getElementById('btn-join').addEventListener('click', () => {
    fullScreen();
    playSound('click');
    showScreen('screen-join');
    startQRScanner((text) => {
        try {
            fullScreen(); // re-trigger on successful scan
            const urlMatch = text.match(/room=([^&]+)/);
            connectToRoom(urlMatch ? urlMatch[1] : text);
        } catch (e) {
            alert('Ungültiger QR Code');
        }
    });
});

document.getElementById('btn-manual-join').addEventListener('click', () => {
    fullScreen();
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
    if (state.phase === 'lobby') {
        const adminCount = document.getElementById('admin-player-count');
        if (adminCount) adminCount.innerText = state.players.length;
        return;
    }

    // Client-side console diagnostic
    if (myId !== 'host') {
        console.log("--- Received State Update ---");
        console.table(state.players.map(p => ({ id: p.id, cards: p.cards.join(','), chips: p.chips })));
    }

    showScreen('screen-game');
    document.getElementById('pot-info').innerText = 'Pot: ' + state.pot;

    const degEl = document.getElementById('debug-info');
    const debugIdEl = document.getElementById('debug-my-id');
    const myIdNorm = String(myId).toLowerCase().trim();

    if (debugIdEl) debugIdEl.innerText = myIdNorm.slice(0, 8);

    // UI Separation Logic
    const playerArea = document.getElementById('player-area');
    const table = document.getElementById('poker-table');
    const oppArea = document.getElementById('opponents-area');

    if (myId === 'host' && !soloMode) {
        // TV VIEW: Table only
        playerArea.style.display = 'none';
        table.style.display = 'flex';
        oppArea.style.display = 'flex';
        table.classList.add('host-view');
    } else {
        // PHONE VIEW: Controller only (Cards + Buttons)
        playerArea.style.display = 'flex';
        table.style.display = 'none';
        oppArea.style.display = 'none';
        table.classList.remove('host-view');
        playerArea.style.height = '100vh';
        playerArea.style.justifyContent = 'center';
    }

    if (degEl) {
        const found = state.players.some(p => String(p.id).toLowerCase().trim() === myIdNorm);
        degEl.innerText = `Phase: ${state.phase} | ID am Tisch gefunden: ${found ? 'JA' : 'NEIN'}`;
    }

    const commArea = document.getElementById('community-cards');
    commArea.innerHTML = '';
    state.communityCards.forEach(c => { commArea.innerHTML += getCardHTML(c); });

    oppArea.innerHTML = '';

    let turnPlayer = state.players[state.turnIndex];
    let isMyTurn = turnPlayer && turnPlayer.id === myId;

    let pFound = false;
    state.players.forEach((p, idx) => {
        if (String(p.id).toLowerCase().trim() === myIdNorm) {
            pFound = true;
            document.getElementById('my-name').innerText = p.name;
            document.getElementById('my-chips').innerText = `💰 ${p.chips}`;
            document.getElementById('my-current-bet').innerText = `Round Bet: ${p.bet}`;

            const myCardsArea = document.getElementById('my-cards');
            myCardsArea.innerHTML = '';
            if (p.cards && p.cards.length > 0) {
                p.cards.forEach(c => { myCardsArea.innerHTML += getCardHTML(c); });
            } else if (state.phase !== 'lobby') {
                myCardsArea.innerHTML = '<div style="color:red; font-size:0.8rem;">Warte auf Karten...</div>';
            }

            const controls = document.getElementById('controls');
            if (isMyTurn && state.phase !== 'showdown') {
                controls.classList.remove('controls-hidden');
            } else {
                controls.classList.add('controls-hidden');
            }

            let toCall = state.currentBet - p.bet;
            document.getElementById('btn-call').innerText = toCall > 0 ? `CALL ${toCall} (CHECK)` : 'CHECK';

            let minRaise = toCall > 0 ? toCall * 2 : 20;
            minRaise = Math.min(minRaise, p.chips);

            if (p.chips <= toCall) {
                document.getElementById('btn-call').innerText = `ALL-IN CALL (${p.chips})`;
                document.getElementById('btn-raise').disabled = true;
            } else {
                document.getElementById('btn-raise').disabled = false;
            }

            window.currentMinRaise = minRaise;
            window.currentMaxRaise = p.chips;

            if (window.currentRaiseAmount < minRaise) {
                updateRaiseDial(minRaise);
            }

        } else {
            let opDiv = document.createElement('div');
            let isActive = idx === state.turnIndex;
            opDiv.className = `opponent ${isActive ? 'active' : ''}`;
            let isBotP = p.isBot;

            let cardsHtml;
            if (state.phase === 'showdown' || (soloMode && isBotP)) {
                cardsHtml = p.cards.map(c => c === 'hidden'
                    ? '🂠'
                    : `<span class="${(c[1] === '♥' || c[1] === '♦') ? 'red' : ''}">${c[0] === 'T' ? '10' : c[0]}${c[1]}</span>`
                ).join(' ');
            } else {
                cardsHtml = p.cards.map(() => '🂠').join(' ');
            }

            opDiv.innerHTML = `
                <div>${p.name}</div>
                <div class="chip-count">💰 ${p.chips}</div>
                <div class="status">${p.folded ? '❌ Folded' : 'Bet: ' + p.bet}</div>
                <div style="font-size:1.4rem; letter-spacing:4px">${cardsHtml}</div>
            `;
            oppArea.appendChild(opDiv);
        }
    });

    if (myId !== 'host') {
        const adminCount = document.getElementById('admin-player-count');
        if (adminCount) adminCount.innerText = state.players.length;
    }
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
// ACTION BUTTONS & DIAL
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

// ROTARY DIAL LOGIC
const throwDial = document.getElementById('raise-dial');
const dialWheel = throwDial.querySelector('.dial-wheel');
const raiseAmtEl = document.getElementById('raise-amount');

window.currentRaiseAmount = 20;
window.currentMinRaise = 20;
window.currentMaxRaise = 1000;
let isDraggingDial = false;
let startAngle = 0;
let currentRotation = 0;

function getAngle(x, y, rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function updateRaiseDial(amt) {
    window.currentRaiseAmount = Math.max(window.currentMinRaise, Math.min(window.currentMaxRaise, amt));
    raiseAmtEl.innerText = window.currentRaiseAmount;
    if (window.currentRaiseAmount === window.currentMaxRaise) {
        raiseAmtEl.innerText += " (ALL-IN)";
        raiseAmtEl.style.color = "var(--danger)";
    } else {
        raiseAmtEl.style.color = "white";
    }
}

function onDialStart(e) {
    isDraggingDial = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startAngle = getAngle(clientX, clientY, throwDial.getBoundingClientRect()) - currentRotation;
    e.preventDefault();
}

function onDialMove(e) {
    if (!isDraggingDial) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newAngle = getAngle(clientX, clientY, throwDial.getBoundingClientRect());

    let delta = newAngle - startAngle;

    // Smooth endless looping delta (avoid jump at -180/180 degree split)
    let rotationDiff = delta - currentRotation;
    if (rotationDiff > 180) rotationDiff -= 360;
    if (rotationDiff < -180) rotationDiff += 360;

    currentRotation += rotationDiff;
    dialWheel.style.transform = `rotate(${currentRotation}deg)`;

    // Map rotation to raise amount (approx 10 chips per 10 degrees)
    // To allow reaching 1000+ chips easily, make it scale exponentially or just use a multiplier
    const range = window.currentMaxRaise - window.currentMinRaise;
    // 1 full rotation (360) = 50% of range
    const step = Math.floor(currentRotation / 5) * 10;

    let nextAmt = window.currentMinRaise + step;

    // Lock bounds visually based on dragging so they can reset by turning back
    if (nextAmt < window.currentMinRaise) {
        nextAmt = window.currentMinRaise;
    }
    if (nextAmt > window.currentMaxRaise) {
        nextAmt = window.currentMaxRaise;
    }

    updateRaiseDial(nextAmt);
}

function onDialEnd() {
    isDraggingDial = false;
    startAngle = currentRotation; // lock in the baseline
}

// Mouse events
throwDial.addEventListener('mousedown', onDialStart);
window.addEventListener('mousemove', onDialMove);
window.addEventListener('mouseup', onDialEnd);

// Touch events
throwDial.addEventListener('touchstart', onDialStart, { passive: false });
window.addEventListener('touchmove', onDialMove, { passive: false });
window.addEventListener('touchend', onDialEnd);


document.getElementById('btn-raise').addEventListener('click', () => {
    playSound('chip');
    let amount = window.currentRaiseAmount;
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
