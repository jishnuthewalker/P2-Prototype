import * as dom from './dom.js';
import * as ui from './ui.js';
import * as socket from './socket.js';
import * as canvas from './canvas.js';
import * as uiInteractions from './uiInteractions.js';
import * as constants from './constants.js';
const { VIEWS, SOCKET_EVENTS } = constants; // Destructure for easier use

// --- State ---
let currentPlayer = null; // { id, name, score }
let currentRoom = null;
let isHost = false;

// --- Initialization ---
function init() {
    console.log("Game initializing...");
    ui.showView(VIEWS.INITIAL_SETUP);
    setupEventListeners();
    // Don't connect socket here initially. Connect on create/join.
}

// --- Event Listeners ---
function setupEventListeners() {
    // Initial Setup
    dom.createRoomBtn.addEventListener('click', handleCreateRoom);
    dom.joinRoomBtn.addEventListener('click', handleJoinRoom);

    // Lobby
    dom.lobbyStartGameBtn.addEventListener('click', handleStartGame);
    dom.leaveRoomBtn.addEventListener('click', handleLeaveRoom);

    // Game Area
    // TODO: Add game area listeners (canvas, guess, chat, etc.)
    dom.toggleScoreBtn.addEventListener('click', uiInteractions.toggleScoreboard);
    dom.toggleDrawingBtn.addEventListener('click', () => uiInteractions.toggleSection('drawing-content'));
    dom.toggleChatBtn.addEventListener('click', () => uiInteractions.toggleSection('chat-content'));
    dom.endGameBtn.addEventListener('click', handleLeaveRoom); // Changed to leave room for simplicity now
}

/** Sets up listeners for events coming FROM the server */
function setupSocketListeners() {
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, handleRoomUpdate);
    // TODO: Add listeners for other events like gameStarted, newTurn, chatUpdate, etc.
    // socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    // socket.on(SOCKET_EVENTS.NEW_TURN, handleNewTurn);
    // socket.on(SOCKET_EVENTS.CHAT_UPDATE, handleChatUpdate);
    // socket.on(SOCKET_EVENTS.GUESS_RESULT, handleGuessResult);
    // socket.on(SOCKET_EVENTS.SCORE_UPDATE, handleScoreUpdate);
    // socket.on(SOCKET_EVENTS.TIMER_UPDATE, ui.updateTimerDisplay); // Direct UI update if simple
    // socket.on(SOCKET_EVENTS.GAME_OVER, handleGameOver);
    // socket.on('yourTurnToDraw', handleYourTurn); // Custom event from gameLogic
    // socket.on(SOCKET_EVENTS.DRAWING_UPDATE, canvas.handleIncomingDrawData); // Pass drawing data to canvas module
    // socket.on(SOCKET_EVENTS.CLEAR_CANVAS_UPDATE, canvas.clearCanvas); // Clear canvas on remote instruction
}

// --- Event Handlers ---

function handleCreateRoom() {
    const playerName = dom.playerNameInput.value.trim();
    if (!playerName) {
        ui.showSetupError("Please enter your name.");
        return;
    }
    // Store name, ID will come from server
    currentPlayer = { name: playerName, id: null, score: 0 };
    isHost = true;
    console.log(`Player ${playerName} attempting to create room...`);
    ui.hideSetupError();

    socket.connect(); // Connect the socket
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, playerName, (response) => {
        console.log("Create room response:", response);
        if (response.success) {
            currentPlayer.id = socket.socket.id; // Use the actual socket ID
            currentRoom = {
                id: response.roomId,
                players: response.players,
                hostId: response.hostId,
                settings: { scoreGoal: constants.DEFAULT_SCORE_GOAL } // Use default initially
            };
            setupSocketListeners(); // Register listeners AFTER successful connection/room creation
            ui.updateLobbyView(currentRoom, currentPlayer.id, isHost);
            ui.showView(VIEWS.LOBBY);
        } else {
            ui.showSetupError(response.message || "Failed to create room.");
            socket.disconnect(); // Disconnect on failure
            isHost = false;
            currentPlayer = null;
        }
    });
}

function handleJoinRoom() {
    const playerName = dom.playerNameInput.value.trim();
    const roomId = dom.roomIdInput.value.trim().toUpperCase();
    if (!playerName) {
        ui.showSetupError("Please enter your name.");
        return;
    }
    if (!roomId || roomId.length !== 4) { // Assuming 4-digit codes
        ui.showSetupError("Please enter a valid 4-digit room code.");
        return;
    }
    // Store name, ID will come from server
    currentPlayer = { name: playerName, id: null, score: 0 };
    isHost = false;
    console.log(`Player ${playerName} attempting to join room ${roomId}...`);
    ui.hideSetupError();

    socket.connect(); // Connect the socket
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomId, playerName, (response) => {
        console.log("Join room response:", response);
        if (response.success) {
            currentPlayer.id = socket.socket.id; // Use the actual socket ID
            currentRoom = {
                id: response.roomId,
                players: response.players,
                hostId: response.hostId,
                settings: { scoreGoal: constants.DEFAULT_SCORE_GOAL } // Use default initially, server might send updated one later
            };
            setupSocketListeners(); // Register listeners AFTER successful connection/room join
            ui.updateLobbyView(currentRoom, currentPlayer.id, isHost);
            ui.showView(VIEWS.LOBBY);
        } else {
            ui.showSetupError(response.message || "Failed to join room.");
            socket.disconnect(); // Disconnect on failure
            currentPlayer = null;
        }
    });
}

function handleStartGame() {
    if (!isHost) {
        console.warn("Only the host can start the game.");
        return;
    }
    const scoreGoal = parseInt(dom.lobbyScoreGoalInput.value, 10);
    if (isNaN(scoreGoal) || scoreGoal < 10) {
        alert("Please set a valid score goal (minimum 10)."); // Simple alert for now
        return;
    }
    console.log(`Host requesting to start game with score goal: ${scoreGoal}`);
    // Emit event to server, server will validate and broadcast 'gameStarted' if successful
    socket.emit(SOCKET_EVENTS.START_GAME, currentRoom.id, scoreGoal);
    // Do not transition view here, wait for 'gameStarted' event from server
}

function handleLeaveRoom() {
    console.log("Leaving room...");
    // TODO: Emit 'leaveRoom' event? Server handles disconnect anyway.
    // For now, just disconnect locally. Server will detect disconnect.
    socket.disconnect();

    // Reset state and go back to initial setup
    currentPlayer = null;
    currentRoom = null;
    isHost = false;
    ui.resetLobbyView();
    // TODO: Reset game view elements if leaving from game area
    ui.showView(VIEWS.INITIAL_SETUP);
}

// --- Socket Event Handlers ---

/** Handles updates to the room state (player list, host change, etc.) */
function handleRoomUpdate(data) {
    console.log("Received room update:", data);
    if (!currentRoom || currentRoom.id !== data.roomId) {
        console.warn("Received room update for wrong/unknown room.");
        return;
    }
    // Update local state
    currentRoom.players = data.players;
    currentRoom.hostId = data.hostId;
    // Update host status for current player
    isHost = currentPlayer && currentPlayer.id === currentRoom.hostId;

    // Re-render the lobby view with the new data
    // TODO: Check if we are in the lobby view before updating it?
    ui.updateLobbyView(currentRoom, currentPlayer?.id, isHost);

    // TODO: If game is active, update player scores list in game view too
    // if (currentRoom.gameState?.isGameActive) {
    //     ui.updatePlayerScores(currentRoom.players, currentRoom.settings.scoreGoal);
    // }
}

// TODO: Implement handlers for other socket events (gameStarted, newTurn, etc.)
// function handleGameStarted(data) { ... ui.showView(VIEWS.GAME_AREA); canvas.initCanvas(); ... }
// function handleNewTurn(data) { ... ui.updateTurnDisplay(...); canvas.setDrawingEnabled(...); ... }
// function handleChatUpdate(data) { ... ui.addChatMessage(...); ... }
// function handleGuessResult(data) { ... ui.addChatMessage(...); ... }
// function handleScoreUpdate(data) { ... ui.updatePlayerScores(...); ... }
// function handleGameOver(data) { ... ui.showNotification(...); ui.showView(VIEWS.LOBBY); ... }
// function handleYourTurn(data) { ... ui.updateTurnDisplay(...); /* Store word */ ... }


// --- Game Actions ---

function handleEndGame() { // Renamed from original handleEndGame which was removed
    console.log("Ending game...");
    // TODO: Emit 'endGame' to server (if host) or handle leaving
    // For now, just go back to lobby
    ui.showView(constants.VIEWS.LOBBY);
    // Maybe show final scores?
}


// --- Start the app ---
init();