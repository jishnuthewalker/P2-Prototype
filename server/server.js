const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// --- Local Modules ---
// Import specific constants needed
const { MAX_PLAYERS, ...EVENTS } = require('./constants'); // Use rest syntax for EVENTS
const roomManager = require('./roomManager');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3001;

// --- Static File Serving ---
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));
app.use('/src', express.static(path.join(projectRoot, 'src')));
app.use('/socket.io', express.static(path.join(projectRoot, 'node_modules/socket.io/client-dist')));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'Kaliyo.html'));
});


/**
 * Creates a safe, serializable version of the room state for sending to clients.
 * Excludes internal server state like timer IDs.
 * @param {object} room - The full room object from roomManager.
 * @returns {object} A sanitized room state object suitable for emission.
 */
function sanitizeRoomStateForClient(room) {
    if (!room) return null;
    // Explicitly select properties to send, excluding sensitive/internal ones
    const sanitizedGameState = { ...room.gameState };
    delete sanitizedGameState.turnTimerId; // Remove the timer ID object
    delete sanitizedGameState.turnStartTime; // Client likely doesn't need this
    // delete sanitizedGameState.currentWord; // Maybe? Only drawer needs it, sent separately. Keep for now.
    // delete sanitizedGameState.currentPlayerIndex; // Internal logic state

    return {
        roomId: room.id,
        players: room.players, // Player list is generally safe
        hostId: room.hostId,
        settings: sanitizedGameState // Send the sanitized game state as settings/gameState
    };
}

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
            // Ensure room creation was successful before proceeding
            if (!room) {
                throw new Error("Room manager failed to create room.");
            }
            const newPlayer = roomManager.addPlayerToRoom(room, socket, playerName); // socket.join happens here
            if (!newPlayer) {
                 throw new Error("Room manager failed to add player.");
            }
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId,
                settings: room.gameState // Include initial settings like scoreGoal
            };
            console.log(`[Server] Room ${room.id} created successfully by ${playerName} (${socket.id})`);
            callback({ success: true, ...sanitizeRoomStateForClient(room) }); // Respond to creator with sanitized state
        } catch (error) {
            console.error("[Server] Error creating room:", error.message);
            callback({ success: false, message: error.message || "Server error creating room." });
        }
    });

    socket.on(EVENTS.JOIN_ROOM, (roomId, playerName, callback) => {
        console.log(`[Server] Received ${EVENTS.JOIN_ROOM} for room ${roomId} from ${socket.id}`, playerName);
        if (typeof callback !== 'function') {
            console.warn(`[Server] JOIN_ROOM request from ${socket.id} missing callback.`);
            return;
        }
        if (!roomId || !playerName) {
             return callback({ success: false, message: "Missing room ID or player name." });
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
            console.log(`[Server] Join rejected: Room ${roomId} not found.`);
            return callback({ success: false, message: 'Room not found.' });
        }
        // Use imported constant for validation
        if (room.players.length >= MAX_PLAYERS) {
             console.log(`[Server] Join rejected: Room ${roomId} is full (${room.players.length}/${MAX_PLAYERS}).`);
             return callback({ success: false, message: 'Room is full.' });
        }
        // TODO: Prevent joining active game? Add check here:
        // if (room.gameState.isGameActive) {
        //     return callback({ success: false, message: 'Game already in progress.' });
        // }

        try {
            const newPlayer = roomManager.addPlayerToRoom(room, socket, playerName); // socket.join happens here
             if (!newPlayer) {
                 throw new Error("Room manager failed to add player.");
            }
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId,
                settings: room.gameState // Send current settings
                // TODO: If game is active, send current game state to joining player?
            };
            console.log(`[Server] Player ${playerName} (${socket.id}) joined room ${roomId} successfully.`);
            const sanitizedState = sanitizeRoomStateForClient(room);
            callback({ success: true, ...sanitizedState }); // Respond to joiner with sanitized state

            // Broadcast the update to others in the room
            socket.to(roomId).emit(EVENTS.ROOM_UPDATE, sanitizedState); // Broadcast sanitized state
            // Notify chat that player joined
            io.to(roomId).emit(EVENTS.CHAT_MESSAGE, {
                sender: 'System',
                message: `${playerName} has joined the room.`,
                type: 'system'
            });
        } catch (error) {
             console.error(`[Server] Error joining room ${roomId}:`, error.message);
             callback({ success: false, message: error.message || "Server error joining room." });
        }
    });

    // --- Game Logic Event Handlers ---
    socket.on(EVENTS.START_GAME, (roomId, scoreGoal) => {
        console.log(`[Server] Received ${EVENTS.START_GAME} for room ${roomId} from ${socket.id} with goal ${scoreGoal}`);
        const room = roomManager.getRoom(roomId);

        // Validation
        if (!room) {
            console.warn(`[Server] Start game rejected: Room ${roomId} not found.`);
            return socket.emit(EVENTS.ERROR, { message: "Room not found." }); // Notify sender
        }
        if (room.hostId !== socket.id) {
             console.warn(`[Server] Start game rejected: Player ${socket.id} is not host of room ${roomId}.`);
             return socket.emit(EVENTS.ERROR, { message: "Only the host can start the game." });
        }
         if (room.gameState.isGameActive) {
             console.warn(`[Server] Start game rejected: Game already active in room ${roomId}.`);
             return socket.emit(EVENTS.ERROR, { message: "Game is already in progress." });
        }
        if (room.players.length < 2) {
             console.warn(`[Server] Start game rejected: Not enough players in room ${roomId} (${room.players.length}).`);
             return socket.emit(EVENTS.ERROR, { message: `Need at least 2 players to start (currently ${room.players.length}).` });
        }
        const parsedGoal = parseInt(scoreGoal, 10);
        if (isNaN(parsedGoal) || parsedGoal < 10) {
             console.warn(`[Server] Start game rejected: Invalid score goal ${scoreGoal}.`);
             return socket.emit(EVENTS.ERROR, { message: "Invalid score goal (minimum 10)." });
        }

        // Delegate to gameLogic module
        gameLogic.startGame(io, room, parsedGoal);
    });

    socket.on(EVENTS.DRAW_DATA, (roomId, drawingData) => {
        const room = roomManager.getRoom(roomId);

        // Basic validation
        if (!room) {
            console.warn(`[Server] ${EVENTS.DRAW_DATA}: Room ${roomId} not found for socket ${socket.id}.`);
            return; // Silently ignore if room doesn't exist
        }
        if (!room.gameState || !room.gameState.isGameActive) {
             console.warn(`[Server] ${EVENTS.DRAW_DATA}: Game not active in room ${roomId} for socket ${socket.id}.`);
             return; // Silently ignore if game not active
        }
        if (room.gameState.currentDrawerId !== socket.id) {
            console.warn(`[Server] ${EVENTS.DRAW_DATA}: Socket ${socket.id} is not the current drawer in room ${roomId}.`);
            return; // Silently ignore if sender is not the drawer
        }
        if (!Array.isArray(drawingData)) {
             console.warn(`[Server] ${EVENTS.DRAW_DATA}: Invalid drawingData format received from ${socket.id} in room ${roomId}. Expected Array.`);
             return; // Ignore malformed data
        }

        // Log data size (consider potential performance impact of stringify on very large data)
        try {
            const dataSize = JSON.stringify(drawingData).length;
            console.log(`[Server] ${EVENTS.DRAW_DATA}: Received ${drawingData.length} stroke groups (${dataSize} bytes) from drawer ${socket.id} for room ${roomId}. Broadcasting...`);
        } catch (e) {
             console.warn(`[Server] ${EVENTS.DRAW_DATA}: Could not stringify drawingData for size logging. Length: ${drawingData.length}`);
        }


        // Broadcast to others (excluding sender)
        try {
            // Use volatile flag? Might help if delivery isn't critical and server is overloaded
            // socket.volatile.to(roomId).emit(EVENTS.DRAWING_UPDATE, drawingData);
            socket.to(roomId).emit(EVENTS.DRAWING_UPDATE, drawingData);
        } catch (error) {
            // Catching errors here is difficult as emit is often async internally
            console.error(`[Server] ${EVENTS.DRAW_DATA}: Error trying to broadcast drawing update for room ${roomId}:`, error);
            // What action to take? Maybe log and continue?
        }
    });

     socket.on(EVENTS.CLEAR_CANVAS, (roomId) => {
        const room = roomManager.getRoom(roomId);
        // Validate sender is the current drawer
        if (room?.gameState?.isGameActive && room.gameState.currentDrawerId === socket.id) {
            io.to(roomId).emit(EVENTS.CLEAR_CANVAS_UPDATE); // Broadcast to all
        } else {
            // console.warn(`[Server] Received ${EVENTS.CLEAR_CANVAS} from invalid sender or state in room ${roomId}`);
        }
    });

    socket.on(EVENTS.SEND_GUESS, (roomId, guessText) => {
        const room = roomManager.getRoom(roomId);
        // Basic validation
        if (!room || !room.gameState.isGameActive || socket.id === room.gameState.currentDrawerId) {
            return; // Silently ignore invalid guesses
        }
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            console.error(`[Server] Player ${socket.id} not found in room ${roomId} when sending guess.`);
            return;
        }
        // Delegate to gameLogic module
        gameLogic.handleGuess(io, room, player, guessText);
    });

    socket.on(EVENTS.SEND_MESSAGE, (roomId, messageText) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return; // Ignore if room doesn't exist
        const player = room.players.find(p => p.id === socket.id);
        const playerName = player ? player.name : 'Spectator'; // Handle potential spectators?

        // Basic validation for message content? (e.g., length, profanity) - Optional
        if (typeof messageText !== 'string' || messageText.trim().length === 0) {
            return; // Ignore empty messages
        }

        // Broadcast chat message
        io.to(roomId).emit(EVENTS.CHAT_MESSAGE, {
             sender: playerName,
             message: messageText.trim(), // Send trimmed message
             type: 'chat'
        });
    });


    // --- Disconnect Handler ---
    socket.on(EVENTS.DISCONNECT, (reason) => {
        console.log(`[Server] User disconnected: ${socket.id}. Reason: ${reason}`);
        const removalInfo = roomManager.removePlayer(socket.id);

        if (removalInfo) {
            const { roomId, removedPlayer, isRoomEmpty, newHost } = removalInfo;

            // If room still exists after removal, handle updates
            const room = roomManager.getRoom(roomId); // Get potentially updated room state

            if (!isRoomEmpty && room) {
                 // Notify others in the room about the player leaving
                 io.to(roomId).emit(EVENTS.PLAYER_LEFT, {
                     playerId: socket.id,
                     playerName: removedPlayer.name
                 });

                 // Notify about new host if applicable
                 if (newHost) {
                     io.to(roomId).emit(EVENTS.NEW_HOST, {
                         hostId: newHost.id,
                         hostName: newHost.name
                     });
                 }

                 // Broadcast the updated room state
                 const roomUpdateData = {
                     roomId: room.id,
                     players: room.players,
                     hostId: room.hostId,
                     settings: room.gameState // Include settings
                 };
                 io.to(roomId).emit(EVENTS.ROOM_UPDATE, sanitizeRoomStateForClient(room)); // Broadcast sanitized state

                 // --- Delegate Game Logic Handling for Disconnect ---
                 // Pass the potentially updated room state and the ID of the disconnected player
                 gameLogic.handlePlayerDisconnect(io, room, socket.id);
                 // --- End Game Logic Delegation ---

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