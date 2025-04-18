const MAX_PLAYERS = 8; // Consider moving this to constants if used elsewhere

// In-memory storage for game rooms
const rooms = {};

/**
 * Generates a simple 4-digit room ID.
 * @returns {string} A 4-digit room ID.
 */
function generateRoomId() {
    // Simple 4-digit room ID generator
    return Math.floor(1000 + Math.random() * 9000).toString();
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
             turnTimerId: null, // Timer ID will be managed by gameLogic/server
             timeLeft: 0,
             scoreGoal: 50, // Default goal
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
    const newPlayer = { id: socket.id, name: playerName, score: 0 };
    room.players.push(newPlayer);
    socket.join(room.id); // Player joins the socket.io room
    console.log(`[RoomManager] Player ${playerName} (${socket.id}) joined room ${room.id}`);
    return newPlayer;
}

/**
 * Removes a player from any room they might be in.
 * Determines if the room becomes empty or needs a new host.
 * Does NOT handle game logic adjustments (e.g., ending game, new turn).
 * Does NOT handle socket emissions.
 * @param {string} socketId - The socket ID of the player to remove.
 * @returns {object | null} An object containing details of the removal, or null if player wasn't found.
 *          Format: { roomId: string, removedPlayer: object, isRoomEmpty: boolean, newHost: object | null }
 */
function removePlayer(socketId) {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const playerIndex = room.players.findIndex(p => p.id === socketId);

        if (playerIndex !== -1) {
            const removedPlayer = room.players.splice(playerIndex, 1)[0];
            console.log(`[RoomManager] Player ${removedPlayer.name} removed from room ${roomId}`);

            let isRoomEmpty = false;
            let newHost = null;

            if (room.players.length === 0) {
                console.log(`[RoomManager] Room ${roomId} is empty, deleting.`);
                 // Clear timer reference if it exists (timer itself cleared elsewhere)
                if (room.gameState.turnTimerId) {
                     room.gameState.turnTimerId = null;
                }
                delete rooms[roomId];
                isRoomEmpty = true;
            } else {
                 // If host left, assign a new host
                 if (room.hostId === socketId) {
                     newHost = room.players[0]; // Assign the next player as host
                     room.hostId = newHost.id;
                     console.log(`[RoomManager] New host for room ${roomId}: ${newHost.name}`);
                 }
            }
            return { roomId, removedPlayer, isRoomEmpty, newHost };
        }
    }
    return null; // Player not found in any room
}

module.exports = {
    getRoom,
    createNewRoom,
    addPlayerToRoom,
    removePlayer,
    MAX_PLAYERS // Export if needed for validation in server.js
};