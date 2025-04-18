const { MAX_PLAYERS, DEFAULT_SCORE_GOAL } = require('./constants'); // Import constants

// In-memory storage for game rooms
const rooms = {};

/**
 * Generates a simple 4-digit room ID. Ensures uniqueness.
 * @returns {string} A unique 4-digit room ID.
 */
function generateRoomId() {
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop in unlikely scenario
    while (attempts < maxAttempts) {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        if (!rooms[roomId]) {
            return roomId;
        }
        attempts++;
    }
    // Fallback or error if unique ID couldn't be generated (highly unlikely)
    console.error("[RoomManager] Failed to generate a unique room ID after multiple attempts.");
    // Consider throwing an error or using a more robust ID generation method if this becomes an issue
    return `ERR_${Date.now()}`;
}

/**
 * Retrieves a room by its ID.
 * @param {string} roomId - The ID of the room.
 * @returns {object | undefined} The room object or undefined if not found.
 */
function getRoom(roomId) {
    return rooms[roomId];
}

/**
 * Creates a new room object and stores it.
 * @param {string} hostSocketId - The socket ID of the host creating the room.
 * @returns {object} The newly created room object.
 */
function createNewRoom(hostSocketId) {
     const roomId = generateRoomId();
     if (roomId.startsWith('ERR_')) {
         // Handle error from generateRoomId if necessary
         throw new Error("Failed to generate unique room ID.");
     }
     rooms[roomId] = {
         id: roomId,
         players: [], // List of { id: socket.id, name: playerName, score: 0 }
         hostId: hostSocketId,
         // Initialize game state structure consistently with gameLogic
         gameState: {
             isGameActive: false,
             currentDrawerId: null,
             currentWord: null, // { script, latin }
             turnStartTime: null,
             turnTimerId: null,
             timeLeft: 0,
             scoreGoal: DEFAULT_SCORE_GOAL, // Use constant
             teamScore: 0,
             currentPlayerIndex: -1,
         },
     };
     console.log(`[RoomManager] Room created: ${roomId} by ${hostSocketId}`);
     return rooms[roomId];
}

/**
 * Adds a player to a specified room.
 * Assumes validation (room exists, not full) happens before calling.
 * @param {object} room - The room object to add the player to.
 * @param {object} socket - The socket object of the joining player.
 * @param {string} playerName - The name of the joining player.
 * @returns {object} The new player object.
 */
function addPlayerToRoom(room, socket, playerName) {
    if (!room || !socket || !playerName) {
        console.error("[RoomManager] addPlayerToRoom called with invalid arguments.");
        // Consider throwing an error or returning null
        return null;
    }
    const newPlayer = { id: socket.id, name: playerName, score: 0 };
    room.players.push(newPlayer);
    socket.join(room.id); // Player joins the socket.io room
    console.log(`[RoomManager] Player ${playerName} (${socket.id}) joined room ${room.id}. Players: ${room.players.length}`);
    return newPlayer;
}

/**
 * Removes a player from any room they might be in.
 * Determines if the room becomes empty or needs a new host.
 * Does NOT handle game logic adjustments or socket emissions.
 * @param {string} socketId - The socket ID of the player to remove.
 * @returns {object | null} An object containing details of the removal, or null if player wasn't found.
 *          Format: { roomId: string, removedPlayer: object, isRoomEmpty: boolean, newHost: object | null }
 */
function removePlayer(socketId) {
    let removalInfo = null;
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const playerIndex = room.players.findIndex(p => p.id === socketId);

        if (playerIndex !== -1) {
            const removedPlayer = room.players.splice(playerIndex, 1)[0];
            console.log(`[RoomManager] Player ${removedPlayer.name} (${socketId}) removed from room ${roomId}. Remaining: ${room.players.length}`);

            let isRoomEmpty = false;
            let newHost = null;

            if (room.players.length === 0) {
                console.log(`[RoomManager] Room ${roomId} is empty, deleting.`);
                // Timer should be cleared by gameLogic/server.js before this point if game was active
                delete rooms[roomId];
                isRoomEmpty = true;
            } else {
                 // If host left, assign the next player in the list as host
                 if (room.hostId === socketId) {
                     newHost = room.players[0]; // Simple reassignment
                     room.hostId = newHost.id;
                     console.log(`[RoomManager] New host for room ${roomId}: ${newHost.name} (${newHost.id})`);
                 }
            }
            removalInfo = { roomId, removedPlayer, isRoomEmpty, newHost };
            break; // Player found and removed, exit loop
        }
    }
    return removalInfo; // Return null if player wasn't found in any room
}

module.exports = {
    getRoom,
    createNewRoom,
    addPlayerToRoom,
    removePlayer,
    MAX_PLAYERS // Export constant for validation in server.js
};