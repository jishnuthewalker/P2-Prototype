// Removed getDomElements import, it's handled in main.js now
import * as ui from './ui.js';
import * as socket from './socket.js';
import * as canvas from './canvas.js';
import * as constants from './constants.js';
import * as state from './state.js';
import * as uiInteractions from './uiInteractions.js'; // Needed for toggle handlers

const { VIEWS, SOCKET_EVENTS } = constants;

// Variable to hold DOM element references, populated by registerDOMListeners
let domElements;

// --- DOM Event Handlers ---

// These handlers now rely on the module-level 'domElements' being populated
// by registerDOMListeners before they are called via event listeners.

function handleCreateRoom() {
    // Check if domElements was populated during initialization
    if (!domElements?.playerNameInput) { // Check a specific required element
        console.error("DOM elements not available in handleCreateRoom. Initialization might have failed.");
        ui.showSetupError("Initialization error. Please refresh.");
        return;
    }
    const playerName = domElements.playerNameInput.value.trim();
    if (!playerName) {
        ui.showSetupError("Please enter your name.");
        return;
    }
    // Set initial player state (ID will come after connection)
    state.setPlayer({ name: playerName, id: null, score: 0 });
    state.setHost(true); // Creator is initially the host
    console.log(`Player ${playerName} attempting to create room...`);
    ui.hideSetupError(); // Pass domElements if needed by ui function

    // Connect the socket first
    socket.connect();

    // Define connection handlers specifically for this room creation attempt
    const handleConnect = () => {
        console.log("Socket connected for room creation, now emitting CREATE_ROOM...");
        const potentialId = socket.getSocketId();
        if (!potentialId) {
             console.error("Socket connected, but ID is not available via getSocketId(). Check socket.js implementation.");
             ui.showSetupError("Connected, but failed to get session ID. Please try again."); // Pass domElements if needed
             removeConnectListeners(); // Clean up listeners *before* disconnecting
             socket.disconnect();
             state.resetState(); // Reset state on failure
             return;
        }
        // Update player state with the received ID
        state.setPlayer({ ...state.getPlayer(), id: potentialId });

        // Emit CREATE_ROOM with player name and their assigned socket ID
        socket.emit(SOCKET_EVENTS.CREATE_ROOM, { playerName: state.getPlayer().name, playerId: state.getPlayer().id }, (response) => {
            console.log("Create room response:", response);
            if (response.success) {
                // Update room state
                state.setRoom({
                    id: response.roomId,
                    players: response.players,
                    hostId: response.hostId,
                    settings: { scoreGoal: constants.DEFAULT_SCORE_GOAL } // Use default initially
                    // gameState will be updated by server events later
                });
                registerSocketListeners(); // Register game-specific listeners AFTER successful room creation

                // --- Clipboard Copy Logic ---
                const roomIdToCopy = response.roomId;
                // Ensure domElements is accessible here (it should be via closure)
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(roomIdToCopy).then(() => {
                        console.log(`Room ID ${roomIdToCopy} copied to clipboard.`);
                        // Check domElements again just before using it inside async callback
                        if (domElements) {
                            ui.showNotification(domElements, `Room code ${roomIdToCopy} copied!`, 'success', 2500);
                        } else {
                             console.warn("domElements not available when trying to show copy success notification.");
                        }
                    }).catch(err => {
                        console.error('Clipboard API Error: Failed to copy room ID automatically.', err);
                        // Show a notification that copying failed, but the room was created.
                        if (domElements) {
                             ui.showNotification(domElements, `Room ${roomIdToCopy} created. (Copy failed)`, 'info', 3000);
                        } else {
                             console.warn("domElements not available when trying to show copy failure notification.");
                        }
                    });
                } else {
                    console.warn("Clipboard API (writeText) not available in this browser/context.");
                     if (domElements) {
                         ui.showNotification(domElements, `Room ${roomIdToCopy} created. (Copy N/A)`, 'info', 3000);
                    } else {
                         console.warn("domElements not available when trying to show copy N/A notification.");
                    }
                }
                // --- End Clipboard Copy Logic ---

                // Pass domElements to UI functions that need them
                ui.updateLobbyView(domElements);
                ui.showView(VIEWS.LOBBY, domElements);
            } else {
                ui.showSetupError(response.message || "Failed to create room."); // Pass domElements if needed
                socket.disconnect(); // Disconnect on failure
                state.resetState(); // Reset state
            }
            removeConnectListeners(); // Clean up listeners after operation completes (success or fail)
        });
    };

    const handleConnectError = (error) => {
        console.error('Failed to connect to create room:', error);
        ui.showSetupError(`Failed to connect: ${error.message || 'Unknown error'}`); // Pass domElements if needed
        state.resetState(); // Reset state as connection failed
        removeConnectListeners(); // Clean up listeners
        // No need to disconnect, connection failed
    };

    // Function to remove these specific listeners later
    const removeConnectListeners = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
    };

    // Use .on and manage removal with .off via removeConnectListeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
}

function handleJoinRoom() {
    // Check if domElements was populated
    if (!domElements?.playerNameInput || !domElements?.roomIdInput) {
        console.error("DOM elements not available in handleJoinRoom. Initialization might have failed.");
        ui.showSetupError("Initialization error. Please refresh.");
        return;
    }
    const playerName = domElements.playerNameInput.value.trim();
    const roomId = domElements.roomIdInput.value.trim().toUpperCase();
    if (!playerName) {
        ui.showSetupError("Please enter your name.");
        return;
    }
    if (!roomId || roomId.length !== 4) { // Assuming 4-digit codes
        ui.showSetupError("Please enter a valid 4-digit room code.");
        return;
    }
    // Set initial player state (ID will come after connection)
    state.setPlayer({ name: playerName, id: null, score: 0 });
    state.setHost(false); // Joiner is not initially the host
    console.log(`Player ${playerName} attempting to join room ${roomId}...`);
    ui.hideSetupError(); // Pass domElements if needed

    // Connect the socket first
    socket.connect();

     // Define connection handlers specifically for this room join attempt
    const handleConnect = () => {
        console.log("Socket connected for room join, now emitting JOIN_ROOM...");
        const potentialId = socket.getSocketId();
         if (!potentialId) {
             console.error("Socket connected, but ID is not available via getSocketId(). Check socket.js implementation.");
             ui.showSetupError("Connected, but failed to get session ID. Please try again."); // Pass domElements if needed
             removeConnectListeners(); // Clean up listeners *before* disconnecting
             socket.disconnect();
             state.resetState(); // Reset state on failure
             return;
        }
         // Update player state with the received ID
        state.setPlayer({ ...state.getPlayer(), id: potentialId });

        // Emit JOIN_ROOM
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomId, playerName, (response) => {
            console.log("Join room response:", response);
            if (response.success) {
                // Update room state
                state.setRoom({
                    id: response.roomId,
                    players: response.players,
                    hostId: response.hostId,
                    settings: { scoreGoal: constants.DEFAULT_SCORE_GOAL } // Use default initially
                });
                registerSocketListeners(); // Register listeners AFTER successful connection/room join
                // Pass domElements to UI functions
                ui.updateLobbyView(domElements);
                ui.showView(VIEWS.LOBBY, domElements);
            } else {
                ui.showSetupError(response.message || "Failed to join room."); // Pass domElements if needed
                socket.disconnect(); // Disconnect on failure
                state.resetState(); // Reset state
            }
             removeConnectListeners(); // Clean up listeners
        });
    };

     const handleConnectError = (error) => {
        console.error('Failed to connect to join room:', error);
        ui.showSetupError(`Failed to connect: ${error.message || 'Unknown error'}`); // Pass domElements if needed
        state.resetState(); // Reset state as connection failed
        removeConnectListeners(); // Clean up listeners
    };

     // Function to remove these specific listeners later
    const removeConnectListeners = () => {
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
    };

     // Use .on and manage removal with .off via removeConnectListeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
}


function handleStartGame() {
    // Check if domElements was populated
    if (!domElements?.lobbyScoreGoalInput) {
        console.error("DOM elements not available in handleStartGame. Initialization might have failed.");
        alert("Initialization error. Please refresh.");
        return;
    }
    if (!state.isCurrentUserHost()) {
        console.warn("Only the host can start the game.");
        // Maybe show a message to the user?
        return;
    }
    const currentRoom = state.getRoom();
    if (!currentRoom) {
        console.error("Cannot start game, not in a room.");
        return;
    }
     if (currentRoom.players.length < 2) {
        alert("You need at least 2 players to start the game."); // Simple alert for now
        return;
    }

    const scoreGoal = parseInt(domElements.lobbyScoreGoalInput.value, 10);
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
    socket.disconnect(); // Server will detect disconnect and handle cleanup

    // Reset state and go back to initial setup
    state.resetState();
    // Pass domElements to UI functions
    ui.resetLobbyView(domElements);
    ui.resetGameView(domElements);
    canvas.clearCanvas(); // Clear canvas drawing
    canvas.setDrawingEnabled(false); // Disable drawing
    ui.showView(VIEWS.INITIAL_SETUP, domElements);
}

function handleSendMessage() {
    // Check if domElements was populated
    if (!domElements?.chatInput) {
        console.error("DOM elements not available in handleSendMessage. Initialization might have failed.");
        return;
    }
    const message = domElements.chatInput.value.trim();
    const room = state.getRoom();
    if (message && room) {
        socket.emit(SOCKET_EVENTS.SEND_MESSAGE, room.id, message);
        domElements.chatInput.value = ''; // Clear input field
    }
}

function handleSendGuess() {
     // Check if domElements was populated
     if (!domElements?.guessInput) {
        console.error("DOM elements not available in handleSendGuess. Initialization might have failed.");
        return;
    }
     const guess = domElements.guessInput.value.trim();
     const room = state.getRoom();
     if (guess && room && !state.isCurrentUserDrawing()) { // Don't allow drawer to guess
         socket.emit(SOCKET_EVENTS.SEND_GUESS, room.id, guess);
         domElements.guessInput.value = ''; // Clear input field
     }
}

function handleClearCanvasClick() {
    const room = state.getRoom();
    if (room && state.isCurrentUserDrawing()) {
        socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, room.id);
        // Canvas clears locally via CLEAR_CANVAS_UPDATE broadcast from server
    }
}

// --- Socket Event Handlers ---
// These generally don't interact directly with DOM elements fetched at startup,
// but rather call UI functions (which now need domElements passed to them).

/** Handles updates to the room state (player list, host change, etc.) */
function handleRoomUpdate(data) {
    console.log("Received room update:", data);
    const currentRoom = state.getRoom();
    if (!currentRoom || currentRoom.id !== data.roomId) {
        console.warn("Received room update for wrong/unknown room.");
        return;
    }
    // Update local state using state module functions
    state.updatePlayerList(data.players);
    state.updateHostId(data.hostId);

    // Re-render the lobby view with the new data
    // Check if we are in the lobby view before updating it
    // Need domElements to check view visibility reliably if needed, or pass it to ui.updateLobbyView
    if (domElements?.gameLobbyView?.style.display !== 'none') {
        ui.updateLobbyView(domElements); // Pass domElements
    }

    // If game is active, update player scores list in game view too
    if (domElements?.gameAreaView?.style.display !== 'none') { // Check if game view is active
        ui.updatePlayerScores(domElements); // Pass domElements
    }
}

function handlePlayerLeft(data) {
    console.log("Player left:", data);
    const room = state.getRoom();
    if (room) {
        ui.addChatMessage(domElements, data.playerName, 'left the room.', 'system'); // Pass domElements
        // Room state (player list, host) is updated via ROOM_UPDATE event handled above
    }
}

function handleNewHost(data) {
     console.log("New host:", data);
     const room = state.getRoom();
     if (room) {
         state.updateHostId(data.hostId); // Update state
         ui.addChatMessage(domElements, data.hostName, 'is now the host.', 'system'); // Pass domElements
         // Update lobby view if visible
         if (domElements?.gameLobbyView?.style.display !== 'none') {
             ui.updateLobbyView(domElements); // Pass domElements
         }
         // Update game view elements if game is active
         // ui.updateGameViewForHost(state.isCurrentUserHost()); // Example
     }
}

function handleGameStarted(data) {
    console.log("Game started:", data);
    const room = state.getRoom();
    if (room && domElements) { // Ensure domElements is available
        // Update room state with game details if needed (e.g., score goal)
        if (room.settings) room.settings.scoreGoal = data.scoreGoal;
        else room.settings = { scoreGoal: data.scoreGoal };
        // state.setGameActive(true); // TODO: Implement game active flag

        ui.resetGameView(domElements); // Pass domElements
        ui.updatePlayerScores(domElements); // Pass domElements
        ui.showView(VIEWS.GAME_AREA, domElements); // Pass domElements
        canvas.initCanvas(domElements.drawingCanvas); // Pass canvas element if needed
        canvas.clearCanvas(); // Ensure canvas is clear at start
    } else {
        console.error("Cannot handle game started: Room or DOM elements missing.");
    }
}

function handleNewTurn(data) {
    console.log("New turn:", data);
    const room = state.getRoom();
    const player = state.getPlayer();
    if (room && player && domElements) { // Ensure domElements is available
        const isDrawing = player.id === data.drawerId;
        state.setDrawing(isDrawing);
        state.setCurrentWord(null); // Clear previous word

        ui.updateTurnDisplay(domElements, data.drawerName); // Pass domElements
        ui.updateTimerDisplay(domElements, data.timeLeft); // Pass domElements
        canvas.setDrawingEnabled(isDrawing); // Enable/disable drawing controls
        canvas.clearCanvas(); // Clear canvas for the new turn
        ui.clearGuessInput(domElements); // Pass domElements
        ui.addChatMessage(domElements, data.drawerName, 'is drawing!', 'system'); // Pass domElements
    } else {
         console.error("Cannot handle new turn: Room, player, or DOM elements missing.");
    }
}

function handleYourTurn(data) {
    console.log("It's your turn to draw:", data);
    state.setCurrentWord(data.word); // Store the word { script, latin }
    if (domElements) {
        ui.showWordToDrawer(domElements, data.word); // Pass domElements
    } else {
        console.error("Cannot show word to drawer: DOM elements missing.");
    }
}

function handleChatUpdate(data) {
    console.log("Chat message received:", data);
    if (domElements) {
        ui.addChatMessage(domElements, data.sender, data.message, data.type || 'chat'); // Pass domElements
    } else {
        console.error("Cannot add chat message: DOM elements missing.");
    }
}

function handleGuessResult(data) {
    console.log("Guess result:", data);
    const room = state.getRoom();
    if (room && domElements) { // Ensure domElements is available
        if (data.isCorrect) {
            ui.addChatMessage(domElements, data.playerName, `guessed the word! (+${data.pointsAwarded} points)`, 'correct-guess'); // Pass domElements
            // Score update happens via SCORE_UPDATE event
            // If current player guessed correctly, maybe disable guess input?
            if (state.getPlayer()?.id === data.playerId) {
                ui.disableGuessInput(domElements); // Pass domElements
            }
        }
        // Incorrect guesses are already shown via CHAT_UPDATE from the server's handleGuess
    } else {
        console.error("Cannot handle guess result: Room or DOM elements missing.");
    }
}

function handleScoreUpdate(data) {
    console.log("Score update:", data);
    const room = state.getRoom();
    if (room && domElements) { // Ensure domElements is available
        state.updatePlayerList(data.players); // Update scores in local state
        ui.updatePlayerScores(domElements); // Pass domElements
    } else {
        console.error("Cannot handle score update: Room or DOM elements missing.");
    }
}

function handleGameOver(data) {
    console.log("Game over:", data);
    // state.setGameActive(false); // TODO: Implement game active flag
    state.setDrawing(false);
    state.setCurrentWord(null);
    canvas.setDrawingEnabled(false);

    if (domElements) {
        ui.showNotification(domElements, `Game Over! ${data.reason}`, 'info', 5000); // Pass domElements
    } else {
        console.error("Cannot show game over notification: DOM elements missing.");
    }

    // Transition back to lobby after a delay?
    setTimeout(() => {
        const room = state.getRoom();
        const player = state.getPlayer();
        if (room && player && domElements) { // Ensure domElements is available
             // Reset scores in local state before going to lobby? Or keep them?
             // room.players.forEach(p => p.score = 0);
             // state.updatePlayerList(room.players);
             ui.updateLobbyView(domElements); // Pass domElements
             ui.showView(VIEWS.LOBBY, domElements); // Pass domElements
        } else {
            // If state is somehow lost, go back to setup
             console.warn("State lost or DOM elements missing after game over, returning to initial setup.");
             if (domElements) {
                 ui.showView(VIEWS.INITIAL_SETUP, domElements); // Pass domElements
             } else {
                 // Absolute fallback if even domElements is lost
                 document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;"><h1>Error</h1><p>Application state lost. Please refresh.</p></div>';
             }
        }
    }, 5000); // 5-second delay before returning to lobby
}

function handleServerError(data) {
    console.error("Server error:", data);
    if (domElements) {
        ui.showNotification(domElements, `Server Error: ${data.message || 'Unknown error'}`, 'error'); // Pass domElements
    }
    // Decide what to do - disconnect? Show setup?
}

// --- Registration Functions ---

/** Registers listeners for events coming FROM the server */
export function registerSocketListeners() {
    // Make sure to use socket.on, not socket.once, for persistent listeners
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, handleRoomUpdate);
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, handlePlayerLeft);
    socket.on(SOCKET_EVENTS.NEW_HOST, handleNewHost);
    socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(SOCKET_EVENTS.NEW_TURN, handleNewTurn);
    socket.on(SOCKET_EVENTS.YOUR_TURN_TO_DRAW, handleYourTurn);
    socket.on(SOCKET_EVENTS.DRAWING_UPDATE, canvas.handleIncomingDrawData); // Pass drawing data to canvas module
    socket.on(SOCKET_EVENTS.CLEAR_CANVAS_UPDATE, canvas.clearCanvas); // Clear canvas on remote instruction
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleChatUpdate);
    socket.on(SOCKET_EVENTS.GUESS_RESULT, handleGuessResult);
    socket.on(SOCKET_EVENTS.SCORE_UPDATE, handleScoreUpdate);
    socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
        if (domElements) ui.updateTimerDisplay(domElements, data.timeLeft); // Pass domElements
    });
    socket.on(SOCKET_EVENTS.GAME_OVER, handleGameOver);
    socket.on(SOCKET_EVENTS.ERROR, handleServerError);

    // Standard disconnect/error handling
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        console.log(`Disconnected from server: ${reason}`);
        if (domElements) {
            ui.showNotification(domElements, 'Disconnected from server.', 'error'); // Pass domElements
            state.resetState();
            ui.resetLobbyView(domElements); // Pass domElements
            ui.resetGameView(domElements); // Pass domElements
            canvas.clearCanvas();
            canvas.setDrawingEnabled(false);
            ui.showView(VIEWS.INITIAL_SETUP, domElements); // Pass domElements
        } else {
             console.error("Disconnected, but DOM elements were not available for UI reset.");
             document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;"><h1>Disconnected</h1><p>Please refresh the page.</p></div>';
        }
    });
     socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
         console.error('Connection Error:', error);
         if (domElements) {
             // Avoid showing setup error if already connected and it's a reconnect error
             if (!state.getRoom()) { // Only show setup error if not in a room/game
                ui.showSetupError(`Connection failed: ${error.message}`); // Pass domElements if needed
             } else {
                 ui.showNotification(domElements, `Connection error: ${error.message}`, 'error'); // Pass domElements
             }
             state.resetState();
             ui.showView(VIEWS.INITIAL_SETUP, domElements); // Pass domElements
         } else {
              console.error("Connection error, but DOM elements were not available for UI reset.");
              document.body.innerHTML = '<div style="padding: 20px; text-align: center; font-family: sans-serif; color: red;"><h1>Connection Error</h1><p>Please refresh the page.</p></div>';
         }
     });
}

/**
 * Registers DOM event listeners.
 * @param {Object.<string, HTMLElement>} fetchedElements - The object containing fetched DOM elements from main.js.
 */
export function registerDOMListeners(fetchedElements) {
    // Assign the fetched elements to the module-level variable
    domElements = fetchedElements;

    // Check if essential elements were found (using the passed object)
    // Added more checks based on usage
    if (!domElements || !domElements.createRoomBtn || !domElements.joinRoomBtn ||
        !domElements.lobbyStartGameBtn || !domElements.leaveRoomBtn || !domElements.toggleScoreBtn ||
        !domElements.toggleDrawingBtn || !domElements.toggleChatBtn || !domElements.endGameBtn ||
        !domElements.chatInput || !domElements.guessSendBtn || !domElements.guessInput ||
        !domElements.clearCanvasBtn || !domElements.colorPicker || !domElements.brushSizeSlider)
    {
        console.error("Failed to find one or more essential DOM elements during registration. Check HTML IDs and dom.js getDomElements function.");
        // Potentially show a more specific error to the user based on which element is missing
        ui.showNotification(domElements, "Critical UI element missing. Application cannot start.", "error", 10000); // Show persistent error
        return; // Stop registration
    }

    console.log("Registering DOM listeners with fetched elements:", domElements); // Debug log

    // Initial Setup
    domElements.createRoomBtn.addEventListener('click', handleCreateRoom);
    domElements.joinRoomBtn.addEventListener('click', handleJoinRoom);

    // Lobby
    domElements.lobbyStartGameBtn.addEventListener('click', handleStartGame);
    // Ensure leaveRoomBtn exists before adding listener (it's used in two places)
    if (domElements.leaveRoomBtn) {
        domElements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
    } else {
        console.warn("Lobby leaveRoomBtn not found during listener registration.");
    }


    // Game Area - Buttons
    domElements.toggleScoreBtn.addEventListener('click', () => uiInteractions.toggleScoreboard(domElements)); // Pass domElements if needed by interaction
    domElements.toggleDrawingBtn.addEventListener('click', () => uiInteractions.toggleSection('drawing-content'));
    domElements.toggleChatBtn.addEventListener('click', () => uiInteractions.toggleSection('chat-content'));
     // Ensure endGameBtn exists before adding listener (it's used in two places)
    if (domElements.endGameBtn) {
        domElements.endGameBtn.addEventListener('click', handleLeaveRoom);
    } else {
        console.warn("Game Area endGameBtn not found during listener registration.");
    }


    // Game Area - Inputs/Actions
    domElements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    domElements.guessSendBtn.addEventListener('click', handleSendGuess);
    domElements.guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendGuess();
    });
    domElements.clearCanvasBtn.addEventListener('click', handleClearCanvasClick);

    // Add listeners for drawing tools
    domElements.colorPicker.addEventListener('input', (e) => canvas.setCurrentColor(e.target.value));
    domElements.brushSizeSlider.addEventListener('input', (e) => canvas.setBrushSize(e.target.value));

    // TODO: Add listeners for other game controls if any
    // Example: domElements.showLetterBtn.addEventListener('click', handleShowLetter);
    if (domElements.showLetterBtn) {
        // Placeholder: Define handleShowLetter if needed, or call ui function directly
        // domElements.showLetterBtn.addEventListener('click', () => ui.showWordToDrawer(domElements, state.getCurrentWord()));
        console.log("Note: showLetterBtn found, listener not fully implemented yet.");
    }
}