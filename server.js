const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3001;
const MAX_PLAYERS = 8;

// --- Require Game Logic ---
const gameLogic = require('./gameLogic');

// --- Constants for Socket Events ---
// Define event names used for communication
const EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    CREATE_ROOM: 'createRoom',
    JOIN_ROOM: 'joinRoom',
    ROOM_UPDATE: 'roomUpdate', // Sent to client after joining/creation or when room changes
    PLAYER_JOINED: 'playerJoined', // Broadcast when a player joins
    PLAYER_LEFT: 'playerLeft',   // Broadcast when a player leaves
    NEW_HOST: 'newHost',       // Broadcast when host changes
    UPDATE_PLAYER_LIST: 'updatePlayerList', // Send updated list on changes
    START_GAME: 'startGame',
    DRAWING: 'drawing',
    DRAWING_UPDATE: 'drawingUpdate', // Broadcast drawing data
    CLEAR_CANVAS: 'clearCanvas',
    CLEAR_CANVAS_UPDATE: 'clearCanvasUpdate', // Broadcast clear canvas
    GUESS: 'guess',
    CHAT_MESSAGE: 'chatMessage',
    CHAT_UPDATE: 'chatUpdate', // Broadcast chat message
    // Game specific events (ensure these match gameLogic.js if needed there)
    GAME_STARTED: 'gameStarted',
    NEW_TURN: 'newTurn',
    GUESS_RESULT: 'guessResult',
    SCORE_UPDATE: 'scoreUpdate',
    TIMER_UPDATE: 'timerUpdate',
    GAME_OVER: 'gameOver'
};

// Serve static files (HTML, CSS) from the root directory
app.use(express.static(__dirname));
// Serve JavaScript files from the src directory
app.use('/src', express.static(__dirname + '/src'));
// Serve the Socket.IO client library from node_modules
app.use('/socket.io', express.static(__dirname + '/node_modules/socket.io/client-dist'));

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/Kaliyo.html');
});

// In-memory storage for game rooms
const rooms = {};

// --- Helper Functions ---
function generateRoomId() {
    // Simple 4-digit room ID generator
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function getRoom(roomId) {
    return rooms[roomId];
}

function createNewRoom(hostSocketId) {
     let roomId = generateRoomId();
     while (rooms[roomId]) { // Ensure unique room ID
         roomId = generateRoomId();
     }
     rooms[roomId] = {
         id: roomId,
         players: [], // List of { id: socket.id, name: playerName, score: 0 }
         hostId: hostSocketId,
         gameState: { // Initialize game state structure
             isGameActive: false,
             currentDrawerId: null,
             currentWord: null,
             turnStartTime: null,
             turnTimerId: null,
             timeLeft: 0,
             scoreGoal: 50, // Default goal
             teamScore: 0,
             currentPlayerIndex: -1,
         },
     };
     console.log(`Room created: ${roomId} by ${hostSocketId}`);
     return rooms[roomId];
}

function addPlayerToRoom(room, socket, playerName) {
    const newPlayer = { id: socket.id, name: playerName, score: 0 };
    room.players.push(newPlayer);
    socket.join(room.id);
    console.log(`Player ${playerName} (${socket.id}) joined room ${room.id}`);
    return newPlayer;
}

function removePlayerFromRoom(socketId) {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const playerIndex = room.players.findIndex(p => p.id === socketId);

        if (playerIndex !== -1) {
            const removedPlayer = room.players.splice(playerIndex, 1)[0];
            console.log(`Player ${removedPlayer.name} removed from room ${roomId}`);

            // Notify others in the room
            io.to(roomId).emit(EVENTS.PLAYER_LEFT, { playerId: socketId, playerName: removedPlayer.name });

            // If room is empty, delete it
            if (room.players.length === 0) {
                console.log(`Room ${roomId} is empty, deleting.`);
                 // Ensure timer is cleared if game was active
                if (room.gameState.turnTimerId) {
                    clearInterval(room.gameState.turnTimerId);
                }
                delete rooms[roomId];
            } else {
                 // If host left, assign a new host
                 if (room.hostId === socketId) {
                     room.hostId = room.players[0].id;
                     console.log(`New host for room ${roomId}: ${room.players[0].name}`);
                     io.to(roomId).emit(EVENTS.NEW_HOST, { hostId: room.hostId, hostName: room.players[0].name });
                 }
                 // Broadcast the full room update to ensure state consistency
                 const roomUpdateData = {
                     roomId: room.id,
                     players: room.players,
                     hostId: room.hostId
                 };
                 io.to(roomId).emit(EVENTS.ROOM_UPDATE, roomUpdateData);
                 // Note: We keep PLAYER_LEFT emission above for chat message clarity on client

                 // --- Game Logic Integration for Player Leaving ---
                 if (room.gameState.isGameActive) {
                     if (room.players.length < 2) {
                         // End game if not enough players
                         console.log(`Only one player left in active game room ${roomId}, ending game.`);
                         gameLogic.endGame(io, room, "Not enough players left.");
                     } else if (room.gameState.currentDrawerId === socketId) {
                         // Start new turn if the drawer left
                         console.log(`Drawer left room ${roomId}, starting new turn.`);
                         gameLogic.startNewTurn(io, room);
                     }
                 }
                 // --- End Game Logic Integration ---
            }
            return { roomId, removedPlayerName: removedPlayer.name };
        }
    }
    return null;
}


// --- Socket Connection Handler ---
io.on(EVENTS.CONNECTION, (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Room Management Handlers ---
    socket.on(EVENTS.CREATE_ROOM, (playerName, callback) => {
        if (typeof callback !== 'function') return;
        try {
            const room = createNewRoom(socket.id);
            const newPlayer = addPlayerToRoom(room, socket, playerName);
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId
            };
            callback({ success: true, ...roomUpdateData });
            socket.emit(EVENTS.ROOM_UPDATE, roomUpdateData);
        } catch (error) {
            console.error("Error creating room:", error);
            callback({ success: false, message: "Server error creating room." });
        }
    });

    socket.on(EVENTS.JOIN_ROOM, (roomId, playerName, callback) => {
        if (typeof callback !== 'function') return;
        const room = getRoom(roomId);
        if (!room) {
            return callback({ success: false, message: 'Room not found.' });
        }
        if (room.players.length >= MAX_PLAYERS) {
             return callback({ success: false, message: 'Room is full.' });
        }
        // Prevent joining active game? Or allow spectating? For now, allow joining.

        try {
            const newPlayer = addPlayerToRoom(room, socket, playerName);
            const roomUpdateData = {
                roomId: room.id,
                players: room.players,
                hostId: room.hostId
                // TODO: If game is active, send current game state to joining player?
            };
            callback({ success: true, ...roomUpdateData });
            socket.emit(EVENTS.ROOM_UPDATE, roomUpdateData); // Send update to the joining player

            // Also broadcast the full ROOM_UPDATE to everyone else in the room
            // This ensures all clients (including host) have the latest player list
            // to correctly update UI elements like the start button.
            socket.to(roomId).emit(EVENTS.ROOM_UPDATE, roomUpdateData);
        } catch (error) {
             console.error(`Error joining room ${roomId}:`, error);
             callback({ success: false, message: "Server error joining room." });
        }
    });

    // --- Game Logic Event Handlers ---
    socket.on(EVENTS.START_GAME, (roomId, scoreGoal) => {
        const room = getRoom(roomId);
        // Validation: Only host can start, game not active, enough players
        if (!room || room.hostId !== socket.id || room.gameState.isGameActive) {
            console.log(`Start game rejected for room ${roomId}. Conditions not met.`);
            // Optionally send error back to host
            return;
        }
        if (room.players.length < 2) {
             console.log(`Start game rejected for room ${roomId}. Not enough players.`);
             // Optionally send error back to host
             return;
        }
        // Delegate to gameLogic module
        gameLogic.startGame(io, room, scoreGoal);
    });

    socket.on(EVENTS.DRAWING, (roomId, drawingData) => {
        // Basic broadcast - validation might be needed (e.g., is sender the current drawer?)
        socket.to(roomId).emit(EVENTS.DRAWING_UPDATE, drawingData);
    });

     socket.on(EVENTS.CLEAR_CANVAS, (roomId) => {
        const room = getRoom(roomId);
        // Validation: Only current drawer can clear
        if (room && room.gameState.isGameActive && room.gameState.currentDrawerId === socket.id) {
            socket.to(roomId).emit(EVENTS.CLEAR_CANVAS_UPDATE);
        }
    });

    socket.on(EVENTS.GUESS, (roomId, guessText) => {
        const room = getRoom(roomId);
        // Basic validation
        if (!room || !room.gameState.isGameActive || socket.id === room.gameState.currentDrawerId) {
            return;
        }
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            return; // Player not found
        }
        // Delegate to gameLogic module
        gameLogic.handleGuess(io, room, player, guessText);
    });

    socket.on(EVENTS.CHAT_MESSAGE, (roomId, messageText) => {
        const room = getRoom(roomId);
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        const playerName = player ? player.name : 'Spectator'; // Handle case where player might not be found?

        console.log(`Chat received in room ${roomId} from ${playerName} (${socket.id}): ${messageText}`);
        // Basic broadcast
        io.to(roomId).emit(EVENTS.CHAT_UPDATE, {
             sender: playerName,
             message: messageText,
             type: 'chat'
        });
    });


    // --- Disconnect Handler ---
    socket.on(EVENTS.DISCONNECT, () => {
        console.log(`User disconnected: ${socket.id}`);
        removePlayerFromRoom(socket.id); // Handles cleanup, notifications, and game state changes
    });
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});