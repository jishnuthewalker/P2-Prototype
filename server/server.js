const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Import path module

// --- Local Modules ---
const EVENTS = require('./constants');
const roomManager = require('./roomManager');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3001;

// --- Static File Serving ---
// Get the project root directory (one level up from server/)
const projectRoot = path.join(__dirname, '..');

// Serve static files (HTML, CSS) from the project root
app.use(express.static(projectRoot));
// Serve JavaScript files from the src directory (relative to project root)
app.use('/src', express.static(path.join(projectRoot, 'src')));
// Serve the Socket.IO client library from node_modules (relative to project root)
app.use('/socket.io', express.static(path.join(projectRoot, 'node_modules/socket.io/client-dist')));

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'Kaliyo.html'));
});


// --- Socket Connection Handler ---
io.on(EVENTS.CONNECTION, (socket) => {
    console.log(`[Server] User connected: ${socket.id}`);

    // --- Room Management Handlers ---
    socket.on(EVENTS.CREATE_ROOM, (payload, callback) => {
        console.log(`[Server] Received ${EVENTS.CREATE_ROOM} from ${socket.id}`, payload);
        // Validate payload and callback
        if (typeof payload !== 'object' || !payload.playerName || typeof callback !== 'function') {
            console.error("[Server] Invalid CREATE_ROOM payload or callback:", payload);
            if (typeof callback === 'function') {
                 callback({ success: false, message: "Invalid request data." });
            }
            return;
        }
        const { playerName } = payload;

        try {
            const room = roomManager.createNewRoom(socket.id);
            const newPlayer = roomManager.addPlayerToRoom(room, socket, playerName); // socket.join happens here
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId
            };
            console.log(`[Server] Room ${room.id} created successfully by ${playerName} (${socket.id})`);
            callback({ success: true, ...roomUpdateData }); // Respond to creator
            // No need to emit ROOM_UPDATE here, creator gets it via callback
        } catch (error) {
            console.error("[Server] Error creating room:", error);
            callback({ success: false, message: "Server error creating room." });
        }
    });

    socket.on(EVENTS.JOIN_ROOM, (roomId, playerName, callback) => {
        console.log(`[Server] Received ${EVENTS.JOIN_ROOM} for room ${roomId} from ${socket.id}`, playerName);
        if (typeof callback !== 'function') {
            console.warn(`[Server] JOIN_ROOM request from ${socket.id} missing callback.`);
            return;
        }
        const room = roomManager.getRoom(roomId);
        if (!room) {
            console.log(`[Server] Join rejected: Room ${roomId} not found.`);
            return callback({ success: false, message: 'Room not found.' });
        }
        if (room.players.length >= roomManager.MAX_PLAYERS) {
             console.log(`[Server] Join rejected: Room ${roomId} is full.`);
             return callback({ success: false, message: 'Room is full.' });
        }
        // TODO: Prevent joining active game?

        try {
            const newPlayer = roomManager.addPlayerToRoom(room, socket, playerName); // socket.join happens here
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId
                // TODO: If game is active, send current game state to joining player?
            };
            console.log(`[Server] Player ${playerName} (${socket.id}) joined room ${roomId} successfully.`);
            callback({ success: true, ...roomUpdateData }); // Respond to joiner

            // Broadcast the update to others in the room
            socket.to(roomId).emit(EVENTS.ROOM_UPDATE, roomUpdateData);
            // Consider emitting PLAYER_JOINED for chat notification?
            // io.to(roomId).emit(EVENTS.PLAYER_JOINED, { playerId: newPlayer.id, playerName: newPlayer.name });
        } catch (error) {
             console.error(`[Server] Error joining room ${roomId}:`, error);
             callback({ success: false, message: "Server error joining room." });
        }
    });

    // --- Game Logic Event Handlers ---
    socket.on(EVENTS.START_GAME, (roomId, scoreGoal) => {
        console.log(`[Server] Received ${EVENTS.START_GAME} for room ${roomId} from ${socket.id}`);
        const room = roomManager.getRoom(roomId);
        // Validation: Only host can start, game not active, enough players
        if (!room || room.hostId !== socket.id || room.gameState.isGameActive) {
            console.log(`[Server] Start game rejected for room ${roomId}. Conditions not met (Host: ${room?.hostId}, Socket: ${socket.id}, Active: ${room?.gameState.isGameActive}).`);
            // Optionally send error back to host
            return;
        }
        if (room.players.length < 2) {
             console.log(`[Server] Start game rejected for room ${roomId}. Not enough players (${room.players.length}).`);
             // Optionally send error back to host
             return;
        }
        // Delegate to gameLogic module
        gameLogic.startGame(io, room, scoreGoal);
    });

    // Client sends 'draw_data'
    socket.on(EVENTS.DRAW_DATA, (roomId, drawingData) => {
        // Basic broadcast - validation might be needed (e.g., is sender the current drawer?)
        const room = roomManager.getRoom(roomId);
        if (room && room.gameState.isGameActive && room.gameState.currentDrawerId === socket.id) {
            socket.to(roomId).emit(EVENTS.DRAWING_UPDATE, drawingData);
        } else {
             console.warn(`[Server] Received ${EVENTS.DRAW_DATA} from non-drawer or inactive game in room ${roomId}`);
        }
    });

     socket.on(EVENTS.CLEAR_CANVAS, (roomId) => {
        console.log(`[Server] Received ${EVENTS.CLEAR_CANVAS} for room ${roomId} from ${socket.id}`);
        const room = roomManager.getRoom(roomId);
        // Validation: Only current drawer can clear
        if (room && room.gameState.isGameActive && room.gameState.currentDrawerId === socket.id) {
            io.to(roomId).emit(EVENTS.CLEAR_CANVAS_UPDATE); // Broadcast to all including sender
        } else {
            console.warn(`[Server] Received ${EVENTS.CLEAR_CANVAS} from non-drawer or inactive game in room ${roomId}`);
        }
    });

    // Client sends 'send_guess'
    socket.on(EVENTS.SEND_GUESS, (roomId, guessText) => {
        // console.log(`[Server] Received ${EVENTS.SEND_GUESS} for room ${roomId} from ${socket.id}: ${guessText}`); // Can be noisy
        const room = roomManager.getRoom(roomId);
        // Basic validation
        if (!room || !room.gameState.isGameActive || socket.id === room.gameState.currentDrawerId) {
            // console.log(`[Server] Guess rejected: Game not active or guesser is drawer.`);
            return;
        }
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.error(`[Server] Player ${socket.id} not found in room ${roomId} for guess.`);
            return; // Player not found
        }
        // Delegate to gameLogic module
        gameLogic.handleGuess(io, room, player, guessText);
    });

    // Client sends 'send_message'
    socket.on(EVENTS.SEND_MESSAGE, (roomId, messageText) => {
        console.log(`[Server] Received ${EVENTS.SEND_MESSAGE} for room ${roomId} from ${socket.id}`);
        const room = roomManager.getRoom(roomId);
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        const playerName = player ? player.name : 'Spectator';

        // Basic broadcast - Server sends 'chat_message'
        io.to(roomId).emit(EVENTS.CHAT_MESSAGE, {
             sender: playerName,
             message: messageText,
             type: 'chat' // Differentiate from system messages or guess results
        });
    });


    // --- Disconnect Handler ---
    socket.on(EVENTS.DISCONNECT, () => {
        console.log(`[Server] User disconnected: ${socket.id}`);
        const removalInfo = roomManager.removePlayer(socket.id);

        if (removalInfo) {
            const { roomId, removedPlayer, isRoomEmpty, newHost } = removalInfo;

            // If room still exists, get its current state for game logic checks
            const room = roomManager.getRoom(roomId);

            // Notify others in the room that the player left
            io.to(roomId).emit(EVENTS.PLAYER_LEFT, {
                playerId: socket.id,
                playerName: removedPlayer.name
            });

            if (!isRoomEmpty && room) { // Check if room still exists after removal
                 // If host left, notify about the new host
                 if (newHost) {
                     io.to(roomId).emit(EVENTS.NEW_HOST, {
                         hostId: newHost.id,
                         hostName: newHost.name
                     });
                 }
                 // Broadcast the full room update to ensure state consistency
                 const roomUpdateData = {
                     roomId: room.id,
                     players: room.players,
                     hostId: room.hostId
                 };
                 io.to(roomId).emit(EVENTS.ROOM_UPDATE, roomUpdateData);

                 // --- Game Logic Integration for Player Leaving ---
                 if (room.gameState.isGameActive) {
                     if (room.players.length < 2) {
                         // End game if not enough players remain
                         console.log(`[Server] Only one player left in active game room ${roomId}, ending game.`);
                         // Ensure timer is cleared before ending game
                         if (room.gameState.turnTimerId) {
                            clearInterval(room.gameState.turnTimerId);
                            room.gameState.turnTimerId = null;
                         }
                         gameLogic.endGame(io, room, "Not enough players left.");
                     } else if (room.gameState.currentDrawerId === socket.id) {
                         // Start new turn immediately if the drawer left
                         console.log(`[Server] Drawer left room ${roomId}, starting new turn.`);
                         // Ensure timer is cleared before starting new turn
                          if (room.gameState.turnTimerId) {
                            clearInterval(room.gameState.turnTimerId);
                            room.gameState.turnTimerId = null;
                         }
                         gameLogic.startNewTurn(io, room);
                     }
                 }
                 // --- End Game Logic Integration ---
            } else if (isRoomEmpty) {
                 console.log(`[Server] Room ${roomId} was deleted as it became empty.`);
            }
        } else {
             console.log(`[Server] Disconnected user ${socket.id} was not found in any room.`);
        }
    });
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});