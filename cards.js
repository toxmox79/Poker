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

// Simple hand scorer (sum of rank values + small random tiebreaker)
function evaluateHand(cards) {
    if (!cards || cards.length === 0) return 0;
    const rankVals = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    let score = 0;
    for (let c of cards) {
        if (c === 'hidden') continue;
        score += (rankVals[c[0]] || 0);
    }
    return score + Math.random() * 0.99; // tiny random to break exact ties
}
