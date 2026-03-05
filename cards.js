// =============================================================
// SVG Card Deck – htdebeer/SVG-cards (Public Domain / LGPL)
// Sprite URL: https://raw.githubusercontent.com/htdebeer/SVG-cards/master/svg-cards.svg
// Card viewport in sprite: 169.075 × 244.640 units
// =============================================================

const SVG_CARDS_URL = './assets/svg-cards.svg';

// Aspect ratio of the card sprite (width/height)
const CARD_ASPECT = 169.075 / 244.640;

// Map our internal rank letters → htdebeer rank IDs
const RANK_MAP = {
    'A': '1',
    '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9',
    'T': '10',
    'J': 'jack',
    'Q': 'queen',
    'K': 'king'
};

// Map our suit symbols → htdebeer suit names
const SUIT_MAP = {
    '♠': 'spade',
    '♥': 'heart',
    '♦': 'diamond',
    '♣': 'club'
};

/**
 * Returns an inline SVG <use> element referencing the htdebeer sprite.
 * cardString: e.g. "A♠", "T♥", "K♦", "hidden"
 */
function getCardHTML(cardString) {
    const svgId = cardString === 'hidden' || !cardString
        ? 'back'
        : `${RANK_MAP[cardString[0]]}_${SUIT_MAP[cardString[1]]}`;

    return `
        <svg class="card-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169.075 244.640"
             role="img" aria-label="${cardString === 'hidden' ? 'hidden card' : cardString}">
            <use href="${SVG_CARDS_URL}#${svgId}"/>
        </svg>`;
}

// =============================================================
// Deck helpers
// =============================================================

const Suits = ['♠', '♥', '♦', '♣'];
const Ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (let s of Suits) {
        for (let r of Ranks) {
            deck.push(r + s);
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// =============================================================
// Texas Hold'em 7-Card Evaluator
// Returns a numerical score that correctly ranks any valid 5-card combo out of 7.
// Higher score = better hand. Solves exact tie-breakers (kickers).
// =============================================================

function evaluateHand(cards) {
    if (!cards || cards.length === 0) return 0;

    // Filter out hidden cards
    let visibleCards = cards.filter(c => c !== 'hidden');
    if (visibleCards.length === 0) return 0;

    const rankVals = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

    // Parse into objects for easier sorting/filtering
    let parsed = visibleCards.map(c => ({
        str: c,
        rank: rankVals[c[0]],
        suit: c[1]
    }));

    // Sort descending by rank
    parsed.sort((a, b) => b.rank - a.rank);

    // Group by rank and suit
    let byRank = {};
    let bySuit = {};
    parsed.forEach(c => {
        byRank[c.rank] = (byRank[c.rank] || 0) + 1;
        bySuit[c.suit] = (bySuit[c.suit] || []).concat(c);
    });

    // Arrays of ranks sorted by count, then by rank
    let rankCounts = Object.entries(byRank).map(e => ({ rank: parseInt(e[0]), count: e[1] }));
    rankCounts.sort((a, b) => b.count - a.count || b.rank - a.rank);

    // Check Flush
    let flushSuit = Object.keys(bySuit).find(s => bySuit[s].length >= 5);
    let flushCards = flushSuit ? bySuit[flushSuit].slice(0, 5) : null;

    // Check Straight helper
    function getStraight(cardArr) {
        let uniqueRanks = [...new Set(cardArr.map(c => c.rank))].sort((a, b) => b - a);
        if (uniqueRanks.includes(14)) uniqueRanks.push(1); // Ace can be low

        let straightHigh = -1;
        let pCheck = 0;
        for (let i = 0; i < uniqueRanks.length - 4; i++) {
            if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
                straightHigh = uniqueRanks[i];
                break;
            }
        }
        return straightHigh;
    }

    let straightHigh = getStraight(parsed);
    let straightFlushHigh = flushCards ? getStraight(bySuit[flushSuit]) : -1;

    // Evaluator helper (returns base score + hex representation of 5 key cards for exact kicker ties)
    // Base Scores: 
    // High Card: 1, Pair: 2, Two Pair: 3, 3-of-a-Kind: 4, Straight: 5, Flush: 6, Full House: 7, Quads: 8, Straight Flush: 9
    function makeScore(base, c1, c2, c3, c4, c5) {
        // Build a hex string where each card rank is a hex digit (2-E). 
        // e.g. base 9, cards A, K, Q, J, T -> 0x9EDCBA
        // Since we need to fit in Javascript max safe integer, hex string is perfect.
        let hex = base.toString(16) +
            c1.toString(16) +
            c2.toString(16) +
            c3.toString(16) +
            c4.toString(16) +
            c5.toString(16);
        return parseInt(hex, 16);
    }

    // 1. Straight Flush
    if (straightFlushHigh > -1) {
        return makeScore(9, straightFlushHigh, 0, 0, 0, 0);
    }

    // 2. Quads
    if (rankCounts[0].count === 4) {
        let kicker = rankCounts[1].rank;
        return makeScore(8, rankCounts[0].rank, kicker, 0, 0, 0);
    }

    // 3. Full House
    if (rankCounts[0].count === 3 && rankCounts.length > 1 && rankCounts[1].count >= 2) {
        return makeScore(7, rankCounts[0].rank, rankCounts[1].rank, 0, 0, 0);
    }

    // 4. Flush
    if (flushCards) {
        return makeScore(6, flushCards[0].rank, flushCards[1].rank, flushCards[2].rank, flushCards[3].rank, flushCards[4].rank);
    }

    // 5. Straight
    if (straightHigh > -1) {
        return makeScore(5, straightHigh, 0, 0, 0, 0);
    }

    // 6. 3 of a Kind
    if (rankCounts[0].count === 3) {
        let kickers = parsed.filter(c => c.rank !== rankCounts[0].rank).slice(0, 2);
        let k1 = kickers[0] ? kickers[0].rank : 0;
        let k2 = kickers[1] ? kickers[1].rank : 0;
        return makeScore(4, rankCounts[0].rank, k1, k2, 0, 0);
    }

    // 7. Two Pair
    if (rankCounts[0].count === 2 && rankCounts.length > 1 && rankCounts[1].count === 2) {
        let kicker = parsed.find(c => c.rank !== rankCounts[0].rank && c.rank !== rankCounts[1].rank);
        let kRank = kicker ? kicker.rank : 0;
        return makeScore(3, rankCounts[0].rank, rankCounts[1].rank, kRank, 0, 0);
    }

    // 8. One Pair
    if (rankCounts[0].count === 2) {
        let kickers = parsed.filter(c => c.rank !== rankCounts[0].rank).slice(0, 3);
        let k1 = kickers[0] ? kickers[0].rank : 0;
        let k2 = kickers[1] ? kickers[1].rank : 0;
        let k3 = kickers[2] ? kickers[2].rank : 0;
        return makeScore(2, rankCounts[0].rank, k1, k2, k3, 0);
    }

    // 9. High Card
    let hc = parsed.slice(0, 5);
    let r1 = hc[0] ? hc[0].rank : 0;
    let r2 = hc[1] ? hc[1].rank : 0;
    let r3 = hc[2] ? hc[2].rank : 0;
    let r4 = hc[3] ? hc[3].rank : 0;
    let r5 = hc[4] ? hc[4].rank : 0;

    return makeScore(1, r1, r2, r3, r4, r5);
}
