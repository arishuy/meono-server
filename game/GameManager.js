import { GameState } from './GameState.js';
import { generateRoomCode } from '../utils/roomCode.js';

/**
 * Manages all active game rooms.
 */
export class GameManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> { state: GameState, players: Map<socketId, {id, name}> }
  }

  createRoom(socketId, playerName) {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    this.rooms.set(roomCode, {
      state: null,
      players: new Map([[socketId, { id: socketId, name: playerName }]]),
      hostId: socketId,
    });

    return roomCode;
  }

  joinRoom(roomCode, socketId, playerName) {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.state && room.state.phase === 'playing') {
      throw new Error('Game already in progress');
    }
    if (room.players.size >= 5) throw new Error('Room is full (max 5 players)');
    if (room.players.has(socketId)) throw new Error('Already in room');

    room.players.set(socketId, { id: socketId, name: playerName });
    return true;
  }

  startGame(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== socketId) throw new Error('Only the host can start');
    if (room.players.size < 2) throw new Error('Need at least 2 players');

    const players = [...room.players.values()];
    room.state = new GameState(roomCode, players);
    room.state.startGame();

    return room.state;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomBySocket(socketId) {
    for (const [code, room] of this.rooms) {
      if (room.players.has(socketId)) {
        return { roomCode: code, room };
      }
    }
    return null;
  }

  getPlayerList(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
    }));
  }

  handleDisconnect(socketId) {
    const found = this.getRoomBySocket(socketId);
    if (!found) return null;

    const { roomCode, room } = found;

    if (room.state && room.state.phase === 'playing') {
      // Mark as disconnected but keep in game
      const player = room.state.players.get(socketId);
      if (player) player.connected = false;
    } else {
      // Remove from lobby
      room.players.delete(socketId);
      // If host left, assign new host
      if (room.hostId === socketId && room.players.size > 0) {
        room.hostId = room.players.keys().next().value;
      }
    }

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, roomDeleted: true };
    }

    return { roomCode, roomDeleted: false };
  }

  removeRoom(roomCode) {
    this.rooms.delete(roomCode);
  }
}
