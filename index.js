import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game/GameManager.js';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://meono-client.vercel.app',
];

const app = express();
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const gameManager = new GameManager();

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Exploding Kittens Server Running 🐱💣', rooms: gameManager.rooms.size });
});

io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  // ============ LOBBY EVENTS ============

  socket.on('create-room', ({ playerName }, callback) => {
    try {
      const roomCode = gameManager.createRoom(socket.id, playerName);
      socket.join(roomCode);
      console.log(`🏠 Room ${roomCode} created by ${playerName}`);
      callback({ success: true, roomCode });
      io.to(roomCode).emit('player-list-updated', gameManager.getPlayerList(roomCode));
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('join-room', ({ roomCode, playerName }, callback) => {
    try {
      const code = roomCode.toUpperCase().trim();
      gameManager.joinRoom(code, socket.id, playerName);
      socket.join(code);
      console.log(`👋 ${playerName} joined room ${code}`);
      callback({ success: true, roomCode: code });
      io.to(code).emit('player-list-updated', gameManager.getPlayerList(code));
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('start-game', ({ roomCode }, callback) => {
    try {
      const state = gameManager.startGame(roomCode, socket.id);
      console.log(`🎮 Game started in room ${roomCode}`);

      // Send personalized state to each player
      const room = gameManager.getRoom(roomCode);
      for (const [sid] of room.players) {
        io.to(sid).emit('game-started', state.serializeForPlayer(sid));
      }
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ============ GAME EVENTS ============

  socket.on('play-card', ({ roomCode, cardId, targetData }, callback) => {
    try {
      const room = gameManager.getRoom(roomCode);
      if (!room?.state) throw new Error('No active game');

      const result = room.state.playCard(socket.id, cardId, targetData || {});

      // If See the Future, send the future cards only to the player who played it
      if (result.futureCards) {
        io.to(socket.id).emit('see-the-future', { cards: result.futureCards });
      }

      // Broadcast updated state to all players
      broadcastState(roomCode, room);

      callback({ success: true, result: { type: result.type } });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('draw-card', ({ roomCode }, callback) => {
    try {
      const room = gameManager.getRoom(roomCode);
      if (!room?.state) throw new Error('No active game');

      const result = room.state.drawFromPile(socket.id);

      if (result.type === 'exploding_kitten') {
        if (result.hasDefuse) {
          // Tell the player they need to defuse
          io.to(socket.id).emit('must-defuse', {
            deckSize: result.deckSize,
          });
          // Tell others someone drew an EK
          socket.to(roomCode).emit('player-drew-ek', {
            playerId: socket.id,
            hasDefuse: true,
          });
        } else {
          // Player eliminated
          io.to(roomCode).emit('player-eliminated', {
            playerId: socket.id,
            playerName: room.state.players.get(socket.id)?.name,
          });

          if (result.winner) {
            io.to(roomCode).emit('game-over', {
              winnerId: result.winner,
              winnerName: room.state.players.get(result.winner)?.name,
            });
          }
        }
      } else {
        // Safe draw - send the drawn card privately
        io.to(socket.id).emit('card-drawn', { card: result.card });
      }

      broadcastState(roomCode, room);
      callback({ success: true, type: result.type });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('defuse-response', ({ roomCode, insertPosition }, callback) => {
    try {
      const room = gameManager.getRoom(roomCode);
      if (!room?.state) throw new Error('No active game');

      room.state.handleDefuse(socket.id, insertPosition);
      io.to(roomCode).emit('player-defused', {
        playerId: socket.id,
        playerName: room.state.players.get(socket.id)?.name,
      });

      broadcastState(roomCode, room);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('favor-response', ({ roomCode, cardId }, callback) => {
    try {
      const room = gameManager.getRoom(roomCode);
      if (!room?.state) throw new Error('No active game');

      room.state.handleFavorGive(socket.id, cardId);
      broadcastState(roomCode, room);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('steal-target', ({ roomCode, targetId }, callback) => {
    try {
      const room = gameManager.getRoom(roomCode);
      if (!room?.state) throw new Error('No active game');

      const result = room.state.handleSteal(socket.id, targetId);
      // Send stolen card info privately to the stealer
      io.to(socket.id).emit('steal-result', { card: result.stolenCard });

      broadcastState(roomCode, room);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ============ DISCONNECT ============

  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    const result = gameManager.handleDisconnect(socket.id);
    if (result && !result.roomDeleted) {
      io.to(result.roomCode).emit(
        'player-list-updated',
        gameManager.getPlayerList(result.roomCode)
      );
      const room = gameManager.getRoom(result.roomCode);
      if (room?.state?.phase === 'playing') {
        broadcastState(result.roomCode, room);
      }
    }
  });
});

/**
 * Broadcast personalized game state to each player in the room.
 */
function broadcastState(roomCode, room) {
  if (!room?.state) return;
  for (const [sid] of room.players) {
    io.to(sid).emit('game-state-updated', room.state.serializeForPlayer(sid));
  }
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🐱💣 Exploding Kittens Server running on http://localhost:${PORT}\n`);
});
