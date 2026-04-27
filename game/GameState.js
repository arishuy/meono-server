import { CARD_TYPES, CARD_META, CAT_CARD_TYPES } from './CardTypes.js';
import {
  createBaseDeck,
  dealCards,
  insertExplodingKittens,
  shuffle,
  drawCard,
  peekCards,
  insertCardAt,
  removeCardFromHand,
  removeCardsByType,
  findPairs,
} from './Deck.js';
import { TurnManager } from './TurnManager.js';

export class GameState {
  constructor(roomCode, players) {
    this.roomCode = roomCode;
    this.players = new Map(); // playerId -> { id, name, hand, alive, connected }
    this.drawPile = [];
    this.discardPile = [];
    this.turnManager = null;
    this.phase = 'lobby'; // lobby | playing | finished
    this.winner = null;
    this.pendingAction = null; // { type, playerId, data }
    this.activityLog = [];
    this.hostId = null;

    for (const p of players) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        hand: [],
        alive: true,
        connected: true,
      });
      if (!this.hostId) this.hostId = p.id;
    }
  }

  /**
   * Initialize the game: create deck, deal cards, insert Exploding Kittens.
   */
  startGame() {
    const playerIds = this.getAlivePlayerIds();
    if (playerIds.length < 2) throw new Error('Need at least 2 players');

    // Create and shuffle deck
    const baseDeck = createBaseDeck();
    const { hands, remainingDeck } = dealCards(baseDeck, playerIds, 7);

    // Give hands to players
    for (const [pid, hand] of Object.entries(hands)) {
      this.players.get(pid).hand = hand;
    }

    // Insert Exploding Kittens = (players - 1)
    const ekCount = playerIds.length - 1;
    this.drawPile = shuffle(insertExplodingKittens(remainingDeck, ekCount));
    this.discardPile = [];

    // Initialize turn manager
    this.turnManager = new TurnManager(playerIds);
    this.phase = 'playing';
    this.pendingAction = null;

    this.addLog(`🎮 Game started with ${playerIds.length} players!`);
    this.addLog(`💣 ${ekCount} Exploding Kitten(s) shuffled into the deck.`);

    return this;
  }

  // -------------- Card Actions ----------------

  /**
   * Play a card from the current player's hand.
   */
  playCard(playerId, cardId, targetData = {}) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) throw new Error('Invalid player');
    if (this.turnManager.currentPlayerId !== playerId && !this._isNopePlay(cardId, player)) {
      throw new Error('Not your turn');
    }
    if (this.pendingAction && this.pendingAction.type !== 'nope_window') {
      throw new Error('Resolve pending action first');
    }

    const { card, hand: newHand } = removeCardFromHand(player.hand, cardId);
    if (!card) throw new Error('Card not in hand');

    player.hand = newHand;
    this.discardPile.push(card);

    const meta = CARD_META[card.type];
    const result = { type: card.type, playerId, card };

    switch (card.type) {
      case CARD_TYPES.ATTACK:
        this.addLog(`⚔️ ${player.name} played Attack!`);
        const nextPid = this.turnManager.applyAttack(this.getDeadPlayerIds());
        result.nextPlayer = nextPid;
        result.turnsRemaining = this.turnManager.turnsRemaining;
        break;

      case CARD_TYPES.SKIP:
        this.addLog(`⏭️ ${player.name} played Skip!`);
        this.turnManager.skipTurn(this.getDeadPlayerIds());
        break;

      case CARD_TYPES.SEE_THE_FUTURE:
        this.addLog(`🔮 ${player.name} is seeing the future...`);
        result.futureCards = peekCards(this.drawPile, 3);
        break;

      case CARD_TYPES.SHUFFLE:
        this.addLog(`🔀 ${player.name} shuffled the deck!`);
        this.drawPile = shuffle(this.drawPile);
        break;

      case CARD_TYPES.FAVOR: {
        const targetId = targetData.targetPlayerId;
        const target = this.players.get(targetId);
        if (!target || !target.alive) throw new Error('Invalid target');
        this.addLog(`🙏 ${player.name} asks ${target.name} for a Favor!`);
        this.pendingAction = {
          type: 'favor_give',
          requesterId: playerId,
          targetId: targetId,
        };
        result.pendingAction = this.pendingAction;
        break;
      }

      case CARD_TYPES.NOPE:
        this.addLog(`🚫 ${player.name} played NOPE!`);
        result.noped = true;
        break;

      default:
        // Cat card - check if it's a pair play
        if (CAT_CARD_TYPES.includes(card.type)) {
          // Need to verify the player has another card of the same type
          const secondCard = player.hand.find((c) => c.type === card.type);
          if (!secondCard) {
            // Put the card back - can't play a single cat card
            player.hand.push(card);
            this.discardPile.pop();
            throw new Error('Cat cards must be played as pairs');
          }
          // Remove the second card
          const { card: second, hand: h2 } = removeCardFromHand(player.hand, secondCard.id);
          player.hand = h2;
          this.discardPile.push(second);

          this.addLog(`🐱 ${player.name} played a pair of ${meta.name}!`);
          this.pendingAction = {
            type: 'steal_choose',
            playerId: playerId,
            cardType: card.type,
          };
          result.pendingAction = this.pendingAction;
        }
        break;
    }

    return result;
  }

  /**
   * Current player draws a card from the draw pile.
   */
  drawFromPile(playerId) {
    if (this.turnManager.currentPlayerId !== playerId) {
      throw new Error('Not your turn');
    }
    if (this.pendingAction) throw new Error('Resolve pending action first');

    const { card, deck } = drawCard(this.drawPile);
    if (!card) throw new Error('Draw pile is empty');
    this.drawPile = deck;

    const player = this.players.get(playerId);

    if (card.type === CARD_TYPES.EXPLODING_KITTEN) {
      this.addLog(`💥 ${player.name} drew an Exploding Kitten!`);

      // Check for Defuse
      const hasDefuse = player.hand.some((c) => c.type === CARD_TYPES.DEFUSE);
      if (hasDefuse) {
        this.pendingAction = {
          type: 'defuse_insert',
          playerId,
          explodingKittenCard: card,
        };
        return {
          type: 'exploding_kitten',
          hasDefuse: true,
          playerId,
          deckSize: this.drawPile.length,
        };
      } else {
        // Player is eliminated
        this._eliminatePlayer(playerId);
        return {
          type: 'exploding_kitten',
          hasDefuse: false,
          playerId,
          eliminated: true,
          winner: this.winner,
        };
      }
    }

    // Safe card - add to hand and end turn
    player.hand.push(card);
    this.addLog(`${player.name} drew a card.`);
    this.turnManager.nextTurn(this.getDeadPlayerIds());

    return {
      type: 'safe_draw',
      card,
      playerId,
    };
  }

  /**
   * Handle Defuse response: remove Defuse from hand, reinsert Exploding Kitten.
   */
  handleDefuse(playerId, insertPosition) {
    if (!this.pendingAction || this.pendingAction.type !== 'defuse_insert') {
      throw new Error('No pending defuse action');
    }
    if (this.pendingAction.playerId !== playerId) {
      throw new Error('Not your defuse action');
    }

    const player = this.players.get(playerId);
    const defuseCard = player.hand.find((c) => c.type === CARD_TYPES.DEFUSE);
    if (!defuseCard) throw new Error('No Defuse card!');

    // Remove Defuse from hand and discard it
    const { hand: newHand } = removeCardFromHand(player.hand, defuseCard.id);
    player.hand = newHand;
    this.discardPile.push(defuseCard);

    // Reinsert Exploding Kitten into the deck
    const ekCard = this.pendingAction.explodingKittenCard;
    this.drawPile = insertCardAt(this.drawPile, ekCard, insertPosition);

    this.addLog(`🛡️ ${player.name} defused the Exploding Kitten!`);
    this.pendingAction = null;

    // End turn
    this.turnManager.nextTurn(this.getDeadPlayerIds());

    return { success: true };
  }

  /**
   * Handle Favor response: target player gives a card to requester.
   */
  handleFavorGive(targetId, cardId) {
    if (!this.pendingAction || this.pendingAction.type !== 'favor_give') {
      throw new Error('No pending favor action');
    }
    if (this.pendingAction.targetId !== targetId) {
      throw new Error('Not your favor action');
    }

    const target = this.players.get(targetId);
    const requester = this.players.get(this.pendingAction.requesterId);

    const { card, hand: newHand } = removeCardFromHand(target.hand, cardId);
    if (!card) throw new Error('Invalid card');

    target.hand = newHand;
    requester.hand.push(card);

    this.addLog(`🙏 ${target.name} gave a card to ${requester.name}.`);
    this.pendingAction = null;

    return { success: true, cardType: card.type };
  }

  /**
   * Handle steal: take a random card from target player (cat pair).
   */
  handleSteal(playerId, targetId) {
    if (!this.pendingAction || this.pendingAction.type !== 'steal_choose') {
      throw new Error('No pending steal action');
    }
    if (this.pendingAction.playerId !== playerId) {
      throw new Error('Not your steal action');
    }

    const target = this.players.get(targetId);
    const stealer = this.players.get(playerId);

    if (!target || !target.alive || target.hand.length === 0) {
      this.pendingAction = null;
      throw new Error('Cannot steal from this player');
    }

    // Random card
    const randomIdx = Math.floor(Math.random() * target.hand.length);
    const { card, hand: newHand } = removeCardFromHand(target.hand, target.hand[randomIdx].id);
    target.hand = newHand;
    stealer.hand.push(card);

    this.addLog(`🐱 ${stealer.name} stole a card from ${target.name}!`);
    this.pendingAction = null;

    return { success: true, stolenCard: card };
  }

  // -------------- Helpers ----------------

  _eliminatePlayer(playerId) {
    const player = this.players.get(playerId);
    player.alive = false;
    this.addLog(`💀 ${player.name} has been eliminated!`);

    // Discard their hand
    this.discardPile.push(...player.hand);
    player.hand = [];

    this.turnManager.eliminatePlayer(playerId);

    // Check for winner
    const alive = this.getAlivePlayerIds();
    if (alive.length === 1) {
      this.winner = alive[0];
      this.phase = 'finished';
      const winnerPlayer = this.players.get(this.winner);
      this.addLog(`🏆 ${winnerPlayer.name} wins the game!`);
    } else {
      this.turnManager.nextTurn(this.getDeadPlayerIds());
    }
  }

  _isNopePlay(cardId, player) {
    const card = player.hand.find((c) => c.id === cardId);
    return card && card.type === CARD_TYPES.NOPE;
  }

  getAlivePlayerIds() {
    return [...this.players.entries()]
      .filter(([, p]) => p.alive)
      .map(([id]) => id);
  }

  getDeadPlayerIds() {
    return new Set(
      [...this.players.entries()]
        .filter(([, p]) => !p.alive)
        .map(([id]) => id)
    );
  }

  addLog(message) {
    this.activityLog.push({
      message,
      timestamp: Date.now(),
    });
    // Keep last 50 logs
    if (this.activityLog.length > 50) {
      this.activityLog = this.activityLog.slice(-50);
    }
  }

  /**
   * Serialize the game state for a specific player.
   * Other players' hands are hidden (only card count shown).
   */
  serializeForPlayer(playerId) {
    const playersData = [];
    for (const [id, p] of this.players) {
      playersData.push({
        id,
        name: p.name,
        cardCount: p.hand.length,
        alive: p.alive,
        connected: p.connected,
        hand: id === playerId ? p.hand : undefined, // only show own hand
        isHost: id === this.hostId,
      });
    }

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      players: playersData,
      myHand: this.players.get(playerId)?.hand || [],
      drawPileCount: this.drawPile.length,
      discardPile: this.discardPile.slice(-1), // only top card
      discardPileCount: this.discardPile.length,
      currentPlayerId: this.turnManager?.currentPlayerId || null,
      turnsRemaining: this.turnManager?.turnsRemaining || 0,
      isMyTurn: this.turnManager?.currentPlayerId === playerId,
      pendingAction: this.pendingAction,
      winner: this.winner,
      activityLog: this.activityLog.slice(-20),
    };
  }
}
