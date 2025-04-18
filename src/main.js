import { createApp } from 'https://unpkg.com/petite-vue?module';
import * as socket from './socket.js';
import * as canvas from './canvas.js';
import * as constants from './constants.js';
import { populateHintModal } from './ui.js';
import { makeDraggable } from './uiInteractions.js'; // Import makeDraggable

const { VIEWS, SOCKET_EVENTS, DEFAULT_SCORE_GOAL } = constants;

// --- Main Application State and Logic ---
const appState = {
    // --- Reactive State Properties ---

    // Core App State
    currentView: VIEWS.INITIAL_SETUP,
    player: null, // { id, name, score }
    room: null,   // { id, players: [], hostId, settings: { scoreGoal } }
    messages: [], // { sender, message, type }
    roomTeamScore: 0, // Added to store team score directly from server

    // Game State Specific
    isDrawing: false,
    currentWord: null, // { script, latin } - for drawer only
    timeLeft: 0,

    // Input Models (Bound to HTML inputs)
    playerNameInput: '',
    roomIdInput: '',
    lobbyScoreGoalInput: DEFAULT_SCORE_GOAL,
    chatInput: '',
    guessInput: '',

    // UI Control State
    // Removed isScoreboardVisible, isDrawingVisible, isChatVisible as sections are no longer collapsible
    setupError: null,     // { message: string } | null
    notification: null, // { message: string, type: string, timeoutId: number | null } | null

    // Canvas Related State (mirrors defaults, controlled via methods)
    // currentColor: '#000000', // Removed - color is now theme-dependent
    brushSize: 3,
    isDarkMode: false, // Added for dark mode toggle

    // --- Computed Properties (Getters) ---

    /** Checks if the current player is the host of the room. */
    get isHost() {
        return this.player?.id === this.room?.hostId;
    },

    /** Checks if the game can be started (host, >= 2 players). */
    get canStartGame() {
        return this.isHost && this.room?.players?.length >= 2;
    },

    /** Returns the player list sorted alphabetically by name. */
    get playersSorted() {
        // Sort alphabetically, case-insensitive
        return this.room?.players?.slice().sort((a, b) => {
            const nameA = a.name.toUpperCase();
            const nameB = b.name.toUpperCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        }) || [];
    },

    /** Returns the current team score received from the server. */
    get teamScore() {
        return this.roomTeamScore || 0;
    },

    /** Gets the name of the current drawer, if any. */
    get currentDrawerName() {
        return this.room?.players?.find(p => p.id === this.room?.gameState?.currentDrawerId)?.name || '...';
    },

    /** Calculates the team progress percentage for the progress bar. */
    get teamProgressPercentage() {
        const goal = this.room?.settings?.scoreGoal || this.lobbyScoreGoalInput || 1; // Avoid division by zero
        const progress = (this.teamScore / goal) * 100;
        return Math.min(100, Math.max(0, progress)); // Clamp between 0 and 100
    },

    // --- Methods ---

    // UI Feedback Methods
    showError(message, isSetupError = false) {
        console.error("Error:", message);
        if (isSetupError) {
            this.setupError = { message };
        } else {
            this.showNotification(message, 'error');
        }
    },
    clearError() {
        this.setupError = null;
    },
    showNotification(message, type = 'info', duration = 3000) {
        // Clear previous timeout if one exists for the current notification object
        if (this.notification?.timeoutId) {
            clearTimeout(this.notification.timeoutId);
        }
        // Set the new notification message and type
        const newNotification = { message, type, timeoutId: null };
        this.notification = newNotification; // Make it reactive immediately

        // Set timeout to clear the message content later
        const timeoutId = setTimeout(() => {
            // Check if the *current* notification is the one this timeout was for
            if (this.notification === newNotification) {
               this.notification = null; // Clear the entire notification object
            }
        }, duration);

        // Store the timeout ID on the notification object
        newNotification.timeoutId = timeoutId;
    },

    // State Reset
    resetState() {
        console.log("Resetting client state...");
        this.player = null;
        this.room = null;
        this.isDrawing = false;
        this.currentWord = null;
        this.messages = [];
        this.timeLeft = 0;
        this.lobbyScoreGoalInput = DEFAULT_SCORE_GOAL;
        this.clearError();
        // Keep inputs like playerNameInput, roomIdInput as they are
    },

    // Core Actions (Setup & Lobby)
    createRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        if (!name) {
            return this.showError("Please enter your name.", true);
        }
        console.log(`Player ${name} attempting to create room...`);
        // Player object is created/updated in _emitWithAcknowledgement callback
        this.connectAndEmit(SOCKET_EVENTS.CREATE_ROOM, { playerName: name });
    },
    joinRoom() {
        this.clearError();
        const name = this.playerNameInput.trim();
        const roomId = this.roomIdInput.trim().toUpperCase();
        if (!name) {
            return this.showError("Please enter your name.", true);
        }
        if (!roomId || roomId.length !== 4) {
            return this.showError("Please enter a valid 4-digit room code.", true);
        }
        console.log(`Player ${name} attempting to join room ${roomId}...`);
        // Player object is created/updated in _emitWithAcknowledgement callback
        this.connectAndEmit(SOCKET_EVENTS.JOIN_ROOM, roomId, name);
    },
    leaveRoom() {
        console.log("Leaving room...");
        socket.disconnect(); // Server handles cleanup
        this.resetState();
        this.currentView = VIEWS.INITIAL_SETUP;
        canvas.clearCanvas(); // Ensure canvas module state is reset if needed
        canvas.setDrawingEnabled(false);
    },
    startGame() {
        if (!this.canStartGame) return;
        const goal = parseInt(this.lobbyScoreGoalInput, 10);
        if (isNaN(goal) || goal < 10) {
            return this.showNotification("Please set a valid score goal (minimum 10).", "error");
        }
        console.log(`Host requesting to start game in room ${this.room?.id} with score goal: ${goal}`);
        socket.emit(SOCKET_EVENTS.START_GAME, this.room.id, goal);
    },

    // In-Game Actions
    sendMessage() {
        const message = this.chatInput.trim();
        if (message && this.room) {
            socket.emit(SOCKET_EVENTS.SEND_MESSAGE, this.room.id, message);
            this.chatInput = '';
        }
    },
    sendGuess() {
        const guess = this.guessInput.trim();
        if (guess && this.room && !this.isDrawing) {
            console.log(`Sending guess: '${guess}' for room ${this.room.id}`);
            socket.emit(SOCKET_EVENTS.SEND_GUESS, this.room.id, guess);
            this.guessInput = '';
        }
    },
    clearCanvasClick() {
        if (this.room && this.isDrawing) {
            socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, this.room.id);
        }
    },

    // UI Toggles (Removed toggleScoreboard and toggleSection)

    // Canvas Event Handlers (Called from HTML @input)
    // handleColorChange(event) { // Removed
    //     this.currentColor = event.target.value;
    //     canvas.setCurrentColor(this.currentColor);
    // },
    handleBrushSizeChange(event) {
        this.brushSize = event.target.value;
        canvas.setBrushSize(this.brushSize);
    },

    // Dark Mode Logic
    initDarkMode() {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const storedPreference = localStorage.getItem('darkMode');
        if (storedPreference === 'true') {
            this.isDarkMode = true;
        } else if (storedPreference === 'false') {
            this.isDarkMode = false;
        } else {
            // If no preference stored, use system preference
            this.isDarkMode = prefersDark;
        }
        this.applyDarkMode();
    },
    applyDarkMode() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        }
        // Set canvas drawing color based on theme
        const drawingColor = this.isDarkMode ? '#FFFFFF' : '#000000';
        canvas.setCurrentColor(drawingColor);
        // Note: Canvas background is handled by Tailwind classes on the canvas element itself
    },
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        this.applyDarkMode();
    },

    // Hint Modal Logic
    toggleHintModal() {
        const modal = document.getElementById('hint-modal');
        if (modal) {
            modal.classList.toggle('hidden'); // Toggle Tailwind's hidden class
            // Alternatively, use a custom class like 'show-modal' if defined in CSS
            // modal.classList.toggle('show-modal');
        }
    },

    // --- Socket Connection and Emission Logic ---

    /** Connects if necessary, then emits an event expecting an acknowledgement. */
    connectAndEmit(event, ...args) {
        const isConnected = socket && socket.connected;
        if (isConnected) {
             console.log(`Socket already connected, emitting ${event} directly.`);
             this._emitWithAcknowledgement(event, ...args);
        } else {
            console.log(`Connecting socket before emitting ${event}...`);
            socket.connect(); // Attempt connection

            const handleConnect = () => {
                console.log(`Socket connected for ${event}, now emitting.`);
                this._emitWithAcknowledgement(event, ...args);
                removeConnectListeners();
            };
            const handleConnectError = (error) => {
                console.error(`Failed to connect for ${event}:`, error);
                this.showError(`Failed to connect: ${error.message || 'Unknown error'}`, true);
                this.resetState(); // Reset state on connection failure
                removeConnectListeners();
            };
            const removeConnectListeners = () => {
                socket.off('connect', handleConnect);
                socket.off('connect_error', handleConnectError);
            };

            // Add temporary listeners for this connection attempt
            socket.on('connect', handleConnect);
            socket.on('connect_error', handleConnectError);
        }
    },

    /** Internal helper to structure and send events expecting acknowledgement. */
    _emitWithAcknowledgement(event, ...args) {
        const socketId = socket.getSocketId(); // Get current socket ID
        if (!socketId) {
            // This case should ideally be prevented by the connect logic, but handle defensively
            return this.showError("Cannot emit: Socket connected but ID is missing.", true);
        }

        // Ensure player object exists with the correct ID before emitting
        if (!this.player || this.player.id !== socketId) {
             console.log(`Updating player object with current socket ID: ${socketId}`);
             this.player = { name: this.playerNameInput.trim() || 'Player', id: socketId, score: 0 };
        }

        // Prepare arguments for the actual socket.emit call
        const emitArgs = [];
        let payload = {};

        // Structure payload based on event type
        if (event === SOCKET_EVENTS.CREATE_ROOM) {
            payload = { playerName: this.player.name, playerId: this.player.id }; // Use current player state
            emitArgs.push(payload);
        } else if (event === SOCKET_EVENTS.JOIN_ROOM) {
            const [roomId, playerName] = args; // Original args from joinRoom method
            // Server expects roomId, playerName for validation/lookup
            emitArgs.push(roomId, playerName);
        } else {
             // Handle other potential ack events if needed
             if(args.length > 0) emitArgs.push(args[0]);
        }

        // Add the acknowledgement callback function as the last argument
        emitArgs.push((response) => {
            console.log(`Response for ${event}:`, response);
            if (response.success) {
                // Update local state based on successful room creation/join
                this.room = {
                    id: response.roomId,
                    players: response.players,
                    hostId: response.hostId,
                    // Initialize settings based on response or defaults
                    settings: { scoreGoal: response.settings?.scoreGoal || this.lobbyScoreGoalInput }
                };
                // Ensure local player object is updated with data from server (like initial score)
                this.player = response.players.find(p => p.id === this.player.id) || this.player;
                this.currentView = VIEWS.LOBBY; // Switch view
                this.registerSocketListeners(); // Register persistent listeners *after* successful join/create
            } else {
                this.showError(response.message || `Failed to ${event}.`, true);
                socket.disconnect(); // Disconnect on failure
                this.resetState();
            }
        });

        // Emit the event with structured arguments and callback
        socket.emit(event, ...emitArgs);
    },


    // --- Socket Event Listener Registration ---

    /** Registers all persistent listeners for server events. Called after joining/creating a room. */
    registerSocketListeners() {
        console.log("Registering persistent socket listeners...");
        const eventsToRegister = [
            SOCKET_EVENTS.ROOM_UPDATE, SOCKET_EVENTS.PLAYER_LEFT, SOCKET_EVENTS.NEW_HOST,
            SOCKET_EVENTS.GAME_STARTED, SOCKET_EVENTS.NEW_TURN, SOCKET_EVENTS.YOUR_TURN_TO_DRAW,
            SOCKET_EVENTS.DRAWING_UPDATE, SOCKET_EVENTS.CLEAR_CANVAS_UPDATE, SOCKET_EVENTS.CHAT_MESSAGE,
            SOCKET_EVENTS.GUESS_RESULT, SOCKET_EVENTS.SCORE_UPDATE, SOCKET_EVENTS.TIMER_UPDATE,
            SOCKET_EVENTS.GAME_OVER, SOCKET_EVENTS.ERROR, SOCKET_EVENTS.DISCONNECT
        ];

        // Remove potential old listeners first
        eventsToRegister.forEach(event => socket.off(event));

        // --- Add new listeners ---
        socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data) => {
            console.log("Socket: ROOM_UPDATE", data);
            if (this.room && this.room.id === data.roomId) {
                this.room.players = data.players;
                this.room.hostId = data.hostId;
                // Update self from list
                const updatedSelf = data.players.find(p => p.id === this.player?.id);
                if (updatedSelf) this.player = { ...updatedSelf };
            }
        });
        socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
             console.log("Socket: PLAYER_LEFT", data);
             this.messages.push({ sender: 'System', message: `${data.playerName} left the room.`, type: 'system' });
             // ROOM_UPDATE broadcast from server handles the actual player list update
        });
         socket.on(SOCKET_EVENTS.NEW_HOST, (data) => {
             console.log("Socket: NEW_HOST", data);
             if (this.room) {
                 this.room.hostId = data.hostId;
                 this.messages.push({ sender: 'System', message: `${data.hostName} is now the host.`, type: 'system' });
             }
        });
        socket.on(SOCKET_EVENTS.GAME_STARTED, (data) => {
            console.log("Socket: GAME_STARTED received", data);
            if (this.room) {
                 console.log("Updating view to GAME_AREA...");
                 this.room.settings.scoreGoal = data.scoreGoal;
                 this.currentView = VIEWS.GAME_AREA;
                 // Reset game-specific UI state
                 this.messages = [];
                 // No need to reset visibility flags anymore

                 // Wait for DOM update before initializing canvas
                 this.$nextTick(() => {
                    console.log("DOM updated, attempting to init canvas...");
                    const canvasEl = document.getElementById('drawing-canvas');
                    if (canvasEl) {
                        canvas.initCanvas(canvasEl, this.room.id);
                        // Set initial canvas color based on current theme
                        const initialDrawingColor = this.isDarkMode ? '#FFFFFF' : '#000000';
                        canvas.setCurrentColor(initialDrawingColor);
                        canvas.setBrushSize(this.brushSize);
                        canvas.clearCanvas();
                    } else {
                        console.error("Drawing canvas element not found after nextTick!");
                    }
                 });
             }
        });
        socket.on(SOCKET_EVENTS.NEW_TURN, (data) => {
            console.log("Socket: NEW_TURN", data);
             if (this.room && this.player) {
                 this.isDrawing = this.player.id === data.drawerId;
                 this.currentWord = null; // Reset word for non-drawers
                 this.timeLeft = data.timeLeft;
                 canvas.setDrawingEnabled(this.isDrawing);
                 canvas.clearCanvas();
                 this.guessInput = ''; // Clear guess input for everyone
                 this.messages.push({ sender: 'System', message: `${data.drawerName} is drawing!`, type: 'system' });
             }
        });
        socket.on(SOCKET_EVENTS.YOUR_TURN_TO_DRAW, (data) => {
             console.log("Socket: YOUR_TURN_TO_DRAW", data);
             this.currentWord = data.word; // Only drawer receives this
        });
        socket.on(SOCKET_EVENTS.DRAWING_UPDATE, canvas.handleIncomingDrawData);
        socket.on(SOCKET_EVENTS.CLEAR_CANVAS_UPDATE, canvas.clearCanvas);
        socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
             console.log("Socket: CHAT_MESSAGE received raw data:", JSON.stringify(data));
             console.log("Socket: CHAT_MESSAGE processed", data);
             this.messages.push({ sender: data.sender, message: data.message, type: data.type || 'chat' });
        });
        socket.on(SOCKET_EVENTS.GUESS_RESULT, (data) => {
             console.log("Socket: GUESS_RESULT received raw data:", JSON.stringify(data));
             console.log("Socket: GUESS_RESULT processed", data);
             if (data.isCorrect) {
                 this.messages.push({ sender: data.playerName, message: `guessed the word! (+${data.pointsAwarded} points)`, type: 'correct-guess' });
                 // Optionally disable guess input for the guesser? Might be annoying if multiple people guess fast.
             }
             // Incorrect guesses are just shown via CHAT_MESSAGE
        });
        socket.on(SOCKET_EVENTS.SCORE_UPDATE, (data) => {
             console.log("Socket: SCORE_UPDATE received raw data:", JSON.stringify(data));
             console.log("Socket: SCORE_UPDATE processed", data);
             if (this.room) {
                 // Update the team score directly from the server event data
                 this.roomTeamScore = data.teamScore;
                 // this.room.players = data.players; // REMOVED - Player list no longer sent here
                 // // Update self from list // REMOVED - No longer needed here
                 // const updatedSelf = data.players.find(p => p.id === this.player?.id);
                 // if (updatedSelf) this.player = { ...updatedSelf };
             }
        });
        socket.on(SOCKET_EVENTS.TIMER_UPDATE, (data) => {
             this.timeLeft = data.timeLeft;
        });
        socket.on(SOCKET_EVENTS.GAME_OVER, (data) => {
             console.log("Socket: GAME_OVER", data);
             // Update final team score
             this.roomTeamScore = data.finalTeamScore;
             this.isDrawing = false;
             this.currentWord = null;
             canvas.setDrawingEnabled(false);
             this.showNotification(`Game Over! ${data.reason}`, 'info', 5000);
             // Transition back to lobby after a delay
             setTimeout(() => {
                 if (this.room && this.player) {
                     // Optionally reset scores here if desired before showing lobby
                     // this.room.players.forEach(p => p.score = 0);
                     this.currentView = VIEWS.LOBBY;
                 } else {
                     this.currentView = VIEWS.INITIAL_SETUP; // Fallback if state is lost
                 }
             }, 5000);
        });
        socket.on(SOCKET_EVENTS.ERROR, (data) => {
             console.error("Socket: ERROR received", data);
             this.showError(`Server Error: ${data.message || 'Unknown error'}`);
        });
        socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
             console.log(`Socket: DISCONNECT`, reason);
             this.showNotification('Disconnected from server.', 'error');
             this.resetState();
             this.currentView = VIEWS.INITIAL_SETUP;
             canvas.clearCanvas();
             canvas.setDrawingEnabled(false);
        });
    }
};

// --- Initialize App ---
console.log("Initializing petite-vue app...");
const app = createApp(appState);
app.mount('#app-container');
console.log("petite-vue mounted to #app-container.");

// Initialize dark mode based on preference/storage
appState.initDarkMode();

// Populate the hint modal content once the app is mounted
populateHintModal('hint-modal-content');

// Make the hint modal draggable after app mount
const hintModalElement = document.getElementById('hint-modal-draggable');
const hintModalHeader = document.getElementById('hint-modal-header');
if (hintModalElement && hintModalHeader) {
    makeDraggable(hintModalElement, hintModalHeader);
} else {
    console.error("Could not find hint modal elements to make draggable.");
}

// Initial canvas setup (optional, if needed before game starts)
// canvas.setCurrentColor(appState.currentColor);
// canvas.setBrushSize(appState.brushSize);