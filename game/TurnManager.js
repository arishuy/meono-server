/**
 * Manages turn order, attack stacking, and skip logic.
 */
export class TurnManager {
  /**
   * @param {string[]} playerIds - ordered list of player IDs
   */
  constructor(playerIds) {
    this.playerIds = [...playerIds];
    this.currentIndex = 0;
    this.turnsRemaining = 1; // normally 1 turn per player
    this.direction = 1; // 1 = forward
  }

  get currentPlayerId() {
    return this.playerIds[this.currentIndex];
  }

  /**
   * Advance to the next turn.
   * If turnsRemaining > 1, the same player goes again.
   * Otherwise, move to the next alive player.
   *
   * @param {Set<string>} deadPlayers - set of eliminated player IDs
   */
  nextTurn(deadPlayers = new Set()) {
    this.turnsRemaining--;

    if (this.turnsRemaining > 0) {
      // Same player goes again (Attack effect)
      return this.currentPlayerId;
    }

    // Move to next alive player
    this.turnsRemaining = 1;
    this._advanceToNextAlive(deadPlayers);
    return this.currentPlayerId;
  }

  /**
   * Skip the current turn (Skip card).
   * Decrements turnsRemaining. If 0, advances to next player.
   */
  skipTurn(deadPlayers = new Set()) {
    this.turnsRemaining--;

    if (this.turnsRemaining <= 0) {
      this.turnsRemaining = 1;
      this._advanceToNextAlive(deadPlayers);
    }

    return this.currentPlayerId;
  }

  /**
   * Apply Attack card: end current player's turn, give next player +2 turns.
   */
  applyAttack(deadPlayers = new Set()) {
    const stackedTurns = this.turnsRemaining; // remaining turns carry over
    this._advanceToNextAlive(deadPlayers);
    this.turnsRemaining = stackedTurns + 1; // +2 turns total, but current counts as 1
    return this.currentPlayerId;
  }

  /**
   * Remove a player from the turn order (elimination).
   */
  eliminatePlayer(playerId) {
    const idx = this.playerIds.indexOf(playerId);
    if (idx === -1) return;

    this.playerIds.splice(idx, 1);

    // Adjust currentIndex if needed
    if (this.playerIds.length === 0) return;
    if (this.currentIndex >= this.playerIds.length) {
      this.currentIndex = 0;
    }
  }

  /**
   * Internal: advance index to the next alive player.
   */
  _advanceToNextAlive(deadPlayers) {
    if (this.playerIds.length === 0) return;
    
    let attempts = 0;
    do {
      this.currentIndex = (this.currentIndex + this.direction + this.playerIds.length) % this.playerIds.length;
      attempts++;
    } while (deadPlayers.has(this.currentPlayerId) && attempts < this.playerIds.length);
  }

  /**
   * Get serializable state.
   */
  serialize() {
    return {
      currentPlayerId: this.currentPlayerId,
      turnsRemaining: this.turnsRemaining,
      playerOrder: [...this.playerIds],
    };
  }
}
