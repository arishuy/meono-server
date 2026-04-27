import { CARD_TYPES, CARD_COUNTS, CAT_CARD_TYPES } from './CardTypes.js';

let cardIdCounter = 0;

function createCard(type) {
  return { id: `card_${++cardIdCounter}`, type };
}

/**
 * Fisher-Yates shuffle (in-place, returns mutated array)
 */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Create the base deck (NO Exploding Kittens, NO initial Defuses dealt)
 */
export function createBaseDeck() {
  const deck = [];
  for (const [type, count] of Object.entries(CARD_COUNTS)) {
    for (let i = 0; i < count; i++) {
      deck.push(createCard(type));
    }
  }
  return deck;
}

/**
 * Deal initial hands.
 * Each player gets 1 Defuse + (cardsPerPlayer - 1) random cards from the shuffled deck.
 * Returns { hands: { [playerId]: Card[] }, remainingDeck: Card[] }
 */
export function dealCards(deck, playerIds, cardsPerPlayer = 7) {
  const shuffled = shuffle([...deck]);
  const hands = {};

  // Remove all Defuse cards from the shuffled deck first
  const defuses = shuffled.filter((c) => c.type === CARD_TYPES.DEFUSE);
  const withoutDefuses = shuffled.filter((c) => c.type !== CARD_TYPES.DEFUSE);

  // Give each player 1 Defuse
  for (const pid of playerIds) {
    hands[pid] = [defuses.pop()];
  }

  // Deal (cardsPerPlayer - 1) cards to each player from the remaining deck
  const drawCount = cardsPerPlayer - 1;
  for (const pid of playerIds) {
    for (let i = 0; i < drawCount; i++) {
      if (withoutDefuses.length > 0) {
        hands[pid].push(withoutDefuses.pop());
      }
    }
  }

  // Remaining defuses go back into the deck
  const remaining = [...withoutDefuses, ...defuses];

  return { hands, remainingDeck: remaining };
}

/**
 * Insert Exploding Kittens at random positions in the deck.
 */
export function insertExplodingKittens(deck, count) {
  const result = [...deck];
  for (let i = 0; i < count; i++) {
    const ek = createCard(CARD_TYPES.EXPLODING_KITTEN);
    const pos = Math.floor(Math.random() * (result.length + 1));
    result.splice(pos, 0, ek);
  }
  return result;
}

/**
 * Draw the top card from the deck.
 * Returns { card, deck } where deck is the new array without the drawn card.
 */
export function drawCard(deck) {
  if (deck.length === 0) return { card: null, deck };
  const newDeck = [...deck];
  const card = newDeck.shift(); // top of deck = index 0
  return { card, deck: newDeck };
}

/**
 * Peek at the top N cards of the deck without removing them.
 */
export function peekCards(deck, n = 3) {
  return deck.slice(0, Math.min(n, deck.length));
}

/**
 * Insert a card at a specific position in the deck.
 * position 0 = top, position deck.length = bottom
 */
export function insertCardAt(deck, card, position) {
  const clamped = Math.max(0, Math.min(position, deck.length));
  const newDeck = [...deck];
  newDeck.splice(clamped, 0, card);
  return newDeck;
}

/**
 * Check if a player has a pair of the same cat card type.
 */
export function findPairs(hand) {
  const typeCounts = {};
  for (const card of hand) {
    if (CAT_CARD_TYPES.includes(card.type)) {
      typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
    }
  }
  return Object.entries(typeCounts)
    .filter(([, count]) => count >= 2)
    .map(([type]) => type);
}

/**
 * Remove a card from a hand by card ID. Returns { card, hand }.
 */
export function removeCardFromHand(hand, cardId) {
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { card: null, hand };
  const newHand = [...hand];
  const [card] = newHand.splice(idx, 1);
  return { card, hand: newHand };
}

/**
 * Remove cards by type (for pairs). Removes exactly `count` cards of `type`.
 */
export function removeCardsByType(hand, type, count = 2) {
  const newHand = [...hand];
  const removed = [];
  for (let i = newHand.length - 1; i >= 0 && removed.length < count; i--) {
    if (newHand[i].type === type) {
      removed.push(...newHand.splice(i, 1));
    }
  }
  return { removed, hand: newHand };
}
