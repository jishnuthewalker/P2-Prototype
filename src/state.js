// --- Application State Management ---

let state = {
    currentPlayer: null, // { id: string, name: string, score: number }
    currentRoom: null,   // { id: string, players: Player[], hostId: string, gameState: GameState, settings?: object }
    isHost: false,
    isDrawing: false,    // Is the current player the drawer?
    currentWord: null,   // The word the current player needs to draw (if drawer)
    // Add other relevant state properties as needed
};

export function getPlayer() {
    return state.currentPlayer;
}

export function setPlayer(player) {
    state.currentPlayer = player;
}

export function getRoom() {
    return state.currentRoom;
}

export function setRoom(room) {
    state.currentRoom = room;
    // Update isHost based on the new room state
    state.isHost = state.currentPlayer?.id === room?.hostId;
}

export function isCurrentUserHost() {
    return state.isHost;
}

export function setHost(isHost) {
    state.isHost = isHost;
}

export function isCurrentUserDrawing() {
    return state.isDrawing;
}

export function setDrawing(isDrawing) {
    state.isDrawing = isDrawing;
}

export function getCurrentWord() {
    return state.currentWord;
}

export function setCurrentWord(word) {
    state.currentWord = word;
}

export function resetState() {
    state = {
        currentPlayer: null,
        currentRoom: null,
        isHost: false,
        isDrawing: false,
        currentWord: null,
    };
    console.log("Client state reset.");
}

// Function to update player list within the current room state
export function updatePlayerList(players) {
    if (state.currentRoom) {
        state.currentRoom.players = players;
        // Re-check host status in case the player list update affects it
        // (though host change should ideally come via NEW_HOST event)
        state.isHost = state.currentPlayer?.id === state.currentRoom?.hostId;
    }
}

// Function to update a specific player's score
export function updatePlayerScore(playerId, newScore) {
     if (state.currentRoom && state.currentRoom.players) {
        const player = state.currentRoom.players.find(p => p.id === playerId);
        if (player) {
            player.score = newScore;
        }
    }
     // Also update current player's score if it's them
     if (state.currentPlayer && state.currentPlayer.id === playerId) {
        state.currentPlayer.score = newScore;
     }
}

// Function to update the host ID
export function updateHostId(newHostId) {
    if (state.currentRoom) {
        state.currentRoom.hostId = newHostId;
        state.isHost = state.currentPlayer?.id === newHostId;
    }
}

// Add more specific state update functions as needed